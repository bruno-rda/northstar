from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.routing import APIRoute
from pydantic import BaseModel

from kpis import KPI_DEFINITIONS, aggregate, in_area
from models import (
    AccessRequest,
    ActionItem,
    ActionItemStatus,
    Alert,
    Area,
    CompanyStatus,
    DailySalesPoint,
    IntegrationConnection,
    KpiDefinition,
    KpiRangeValue,
    KpiValue,
    MemberAccessUpdate,
    MemberCreate,
    Membership,
    MembershipWithUser,
    NotificationPreference,
    NotificationPreferenceUpdate,
    OAuthRedirect,
    PaginatedResponse,
    PeriodType,
    Permission,
    PermissionDefinition,
    PlatformScope,
    ProductContribution,
    Provider,
    Report,
    ReportAttempt,
    ReportEligibility,
    ReportGenerateRequest,
    ReportSummary,
    RevenueRange,
    User,
    paginate,
)
from store import PERIOD_CURRENT, PERIOD_THIS_MONTH, db

DashboardPosture = Literal["healthy", "attention", "onboarding"]


def _operation_id(route: APIRoute) -> str:
    return route.name


def current_user(x_mock_user: Annotated[str | None, Header()] = None) -> User:
    user = db.get_user(x_mock_user) if x_mock_user else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _membership(user: User, company_id: str) -> Membership | None:
    return next((m for m in db.get_user_memberships(user.id) if m.company_id == company_id), None)


def require_company_access(company_id: str, user: Annotated[User, Depends(current_user)]) -> User:
    if _membership(user, company_id) is None:
        raise HTTPException(status_code=403, detail="You do not have access to this company")
    return user


VIEW_PERMISSION = {Area.general: Permission.view_general, Area.marketing: Permission.view_marketing}
CREATE_REPORT_PERMISSION = {
    Area.general: Permission.create_general_report,
    Area.marketing: Permission.create_marketing_report,
}


def check_permission(user: User, company_id: str, permission: Permission) -> None:
    membership = _membership(user, company_id)
    if membership is None or permission not in membership.permissions:
        raise HTTPException(status_code=403, detail="You do not have permission to do this")


def require_permission(permission: Permission) -> Callable[..., User]:
    def dependency(company_id: str, user: Annotated[User, Depends(require_company_access)]) -> User:
        check_permission(user, company_id, permission)
        return user

    return dependency


def require_area_view(
    company_id: str, area: Area, user: Annotated[User, Depends(require_company_access)]
) -> User:
    check_permission(user, company_id, VIEW_PERMISSION[area])
    return user


web_api = FastAPI(
    title="northstar-web API (user)",
    version="0.1.0",
    separate_input_output_schemas=False,
    generate_unique_id_function=_operation_id,
)

CurrentUser = Annotated[User, Depends(current_user)]
CompanyScopedUser = Annotated[User, Depends(require_company_access)]
_scoped = [Depends(require_company_access)]
_area_view = [Depends(require_area_view)]
_manage_people = [Depends(require_permission(Permission.manage_people))]
_manage_integrations = [Depends(require_permission(Permission.manage_integrations))]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


# ─── Web-specific DTOs ───────────────────────────────────────────────────────


class CompanyRef(BaseModel):
    id: str
    name: str
    status: CompanyStatus


class MembershipWithCompany(Membership):
    company: CompanyRef


class DashboardBriefing(BaseModel):
    period_label: str
    posture: DashboardPosture
    headline: str | None


class Calendar(BaseModel):
    # Last day with data for this company; the frontend anchors every period preset to it.
    data_as_of: str


class AccessRequestInput(BaseModel):
    name: str
    email: str
    company_name: str
    country: str | None = None
    website: str | None = None
    monthly_revenue: RevenueRange | None = None
    note: str | None = None


class ActionItemStatusUpdate(BaseModel):
    status: ActionItemStatus | None = None


# ─── Access requests (public) & my memberships ───────────────────────────────


@web_api.post("/access-requests", status_code=201)
def submit_access_request(body: AccessRequestInput) -> AccessRequest:
    return db.submit_access_request(
        name=body.name,
        email=body.email,
        company_name=body.company_name,
        country=body.country,
        website=body.website,
        monthly_revenue=body.monthly_revenue,
        note=body.note,
    )


@web_api.get("/me/memberships")
def get_my_memberships(user: CurrentUser) -> list[MembershipWithCompany]:
    out: list[MembershipWithCompany] = []
    for m in db.get_user_memberships(user.id):
        c = db.get_company(m.company_id)
        out.append(
            MembershipWithCompany(
                **m.model_dump(),
                company=CompanyRef(id=c.id, name=c.name, status=c.status),
            )
        )
    return out


@web_api.get("/permissions")
def get_permissions() -> list[PermissionDefinition]:
    return db.get_permission_definitions()


# ─── Members ─────────────────────────────────────────────────────────────────


@web_api.get("/companies/{company_id}/members", dependencies=_scoped)
def get_company_members(company_id: str) -> list[MembershipWithUser]:
    return db.get_company_members(company_id)


@web_api.post("/companies/{company_id}/members", status_code=201, dependencies=_manage_people)
def add_company_member(company_id: str, body: MemberCreate) -> MembershipWithUser:
    return db.add_company_member(company_id, body.email, body.name, body.permissions)


@web_api.patch("/companies/{company_id}/members/{membership_id}", dependencies=_manage_people)
def update_member_access(
    company_id: str, membership_id: str, body: MemberAccessUpdate
) -> MembershipWithUser:
    return db.update_member_access(company_id, membership_id, body.permissions)


@web_api.delete(
    "/companies/{company_id}/members/{membership_id}", status_code=204, dependencies=_manage_people
)
def remove_company_member(company_id: str, membership_id: str) -> None:
    db.remove_company_member(company_id, membership_id)


# ─── Integrations ────────────────────────────────────────────────────────────


@web_api.get("/companies/{company_id}/integrations", dependencies=_scoped)
def get_integrations(company_id: str) -> list[IntegrationConnection]:
    return db.get_integrations(company_id)


@web_api.post(
    "/companies/{company_id}/integrations/{provider}/oauth", dependencies=_manage_integrations
)
def start_integration_oauth(company_id: str, provider: Provider) -> OAuthRedirect:
    return OAuthRedirect(redirect_url=f"https://mock-oauth.northstar.io/{provider}?company={company_id}")


@web_api.post("/companies/{company_id}/integrations/{provider}/oauth/complete")
def complete_integration_oauth(
    company_id: str,
    provider: Provider,
    user: Annotated[User, Depends(require_permission(Permission.manage_integrations))],
) -> IntegrationConnection:
    return db.connect_integration(company_id, provider, user.id)


@web_api.delete(
    "/companies/{company_id}/integrations/{integration_id}",
    status_code=204,
    dependencies=_manage_integrations,
)
def disconnect_integration(company_id: str, integration_id: str) -> None:
    db.disconnect_integration(company_id, integration_id)


# ─── KPIs & dashboard ────────────────────────────────────────────────────────


@web_api.get("/companies/{company_id}/kpis", dependencies=_area_view)
def get_kpi_values(
    company_id: str,
    area: Area,
    period_type: PeriodType,
    period_start: str,
    period_start_to: str | None = None,
    platform_scope: PlatformScope | None = None,
) -> list[KpiValue]:
    rows = db.get_kpi_values(
        company_id,
        period_type=period_type,
        period_start=period_start,
        period_start_to=period_start_to,
        platform_scope=platform_scope,
    )
    return [k for k in rows if in_area(k.kpi_key, area)]


@web_api.get("/kpi-definitions")
def get_kpi_definitions(_user: CurrentUser) -> list[KpiDefinition]:
    return list(KPI_DEFINITIONS.values())


@web_api.get("/companies/{company_id}/kpis/summary", dependencies=_area_view)
def get_kpi_summary(
    company_id: str,
    area: Area,
    period_start: str,
    period_end: str,
    platform_scope: PlatformScope = "aggregated",
) -> list[KpiRangeValue]:
    """Every KPI in `area` aggregated over the monthly periods starting in [start, end]."""
    rows = db.get_kpi_values(
        company_id,
        period_type="monthly",
        period_start=period_start,
        period_start_to=period_end,
        platform_scope=None,
    )
    return [
        KpiRangeValue(
            kpi_key=d.key,
            platform_scope=platform_scope,
            value=aggregate(rows, d.key, platform_scope),
        )
        for d in KPI_DEFINITIONS.values()
        if d.area == area
    ]


_general_view = [Depends(require_permission(Permission.view_general))]


@web_api.get("/companies/{company_id}/product-contribution", dependencies=_general_view)
def get_product_contribution(
    company_id: str,
    period_start: str,
    period_end: str,
    platform_scope: PlatformScope = "aggregated",
) -> list[ProductContribution]:
    return [
        ProductContribution(
            product_id=pid,
            product_name=name,
            revenue=revenue,
            order_count=orders,
            platform_scope=platform_scope,
        )
        for pid, name, revenue, orders in db.get_product_contribution(
            company_id, period_start, period_end, platform_scope
        )
    ]


@web_api.get("/companies/{company_id}/daily-sales", dependencies=_general_view)
def get_daily_sales(
    company_id: str,
    period_start: str,
    period_end: str,
    platform_scope: PlatformScope = "aggregated",
) -> list[DailySalesPoint]:
    return [
        DailySalesPoint(
            date=day,
            revenue=revenue,
            order_count=orders,
            platform_scope=platform_scope,
        )
        for day, revenue, orders in db.get_daily_sales(
            company_id, period_start, period_end, platform_scope
        )
    ]


@web_api.get("/companies/{company_id}/calendar", dependencies=_scoped)
def get_calendar(company_id: str) -> Calendar:
    return Calendar(data_as_of=PERIOD_THIS_MONTH[1])


@web_api.get("/companies/{company_id}/dashboard-briefing", dependencies=_area_view)
def get_dashboard_briefing(company_id: str, area: Area) -> DashboardBriefing:
    current = db.dashboard_current_featured(company_id, area)
    reports = db.get_reports(company_id, area)
    any_ok = any(k.status == "ok" for k in current)
    any_error = any(k.status == "error" for k in current)
    posture: DashboardPosture
    if not reports and not any_ok:
        posture = "onboarding"
    elif any_error or not any_ok:
        posture = "attention"
    else:
        posture = "healthy"
    return DashboardBriefing(
        period_label=datetime.fromisoformat(PERIOD_CURRENT[1]).strftime("%B %Y"),
        posture=posture,
        headline=reports[0].headline if reports else None,
    )


# ─── Reports ─────────────────────────────────────────────────────────────────


@web_api.get("/companies/{company_id}/reports", dependencies=_area_view)
def get_reports(
    company_id: str, area: Area, page: Page = 1, page_size: PageSize = 10
) -> PaginatedResponse[ReportSummary]:
    return paginate(db.get_reports(company_id, area), page, page_size)


@web_api.get("/companies/{company_id}/reports/{report_id}", dependencies=_scoped)
def get_report(company_id: str, report_id: str, user: CompanyScopedUser) -> Report:
    report = db.get_report(company_id, report_id)
    check_permission(user, company_id, VIEW_PERMISSION[report.area])
    return report


@web_api.get("/companies/{company_id}/reports-eligibility", dependencies=_area_view)
def can_generate_report(company_id: str, area: Area) -> ReportEligibility:
    eligible, reason = db.can_generate_report(company_id, area)
    return ReportEligibility(eligible=eligible, blocking_reason=reason)


@web_api.post("/companies/{company_id}/reports/generate")
def generate_report(
    company_id: str, body: ReportGenerateRequest, user: CompanyScopedUser
) -> ReportAttempt:
    check_permission(user, company_id, CREATE_REPORT_PERMISSION[body.area])
    return db.generate_report(company_id, body.area, user.id)


@web_api.get("/companies/{company_id}/latest-report-attempt", dependencies=_area_view)
def get_latest_report_attempt(company_id: str, area: Area) -> ReportAttempt | None:
    return db.get_latest_report_attempt(company_id, area)


# ─── Action items ────────────────────────────────────────────────────────────


@web_api.get("/companies/{company_id}/action-items", dependencies=_area_view)
def get_action_items(company_id: str, area: Area) -> list[ActionItem]:
    return db.get_action_items(company_id, area)


@web_api.patch("/companies/{company_id}/action-items/{action_item_id}")
def update_action_item(
    company_id: str, action_item_id: str, body: ActionItemStatusUpdate, user: CompanyScopedUser
) -> ActionItem:
    check_permission(
        user, company_id, VIEW_PERMISSION[db.action_item_area(company_id, action_item_id)]
    )
    return db.update_action_item(
        company_id, action_item_id, body.model_dump(exclude_unset=True), user.id
    )


# ─── Alerts & notifications ──────────────────────────────────────────────────


@web_api.get("/companies/{company_id}/alerts", dependencies=_scoped)
def get_alerts(
    company_id: str,
    status: Literal["active", "dismissed"],
    page: Page = 1,
    page_size: PageSize = 20,
) -> PaginatedResponse[Alert]:
    return paginate(db.get_alerts(company_id, status), page, page_size)


@web_api.post("/companies/{company_id}/alerts/{alert_id}/dismiss")
def dismiss_alert(company_id: str, alert_id: str, user: CompanyScopedUser) -> Alert:
    return db.dismiss_alert(company_id, alert_id, user.id)


@web_api.get("/notification-preferences")
def get_notification_preferences(user: CurrentUser) -> list[NotificationPreference]:
    return db.get_notification_preferences(user.id)


@web_api.put("/notification-preferences")
def update_notification_preference(
    body: NotificationPreferenceUpdate, user: CurrentUser
) -> NotificationPreference:
    return db.update_notification_preference(
        user.id, body.alert_type, body.in_app_enabled, body.email_enabled
    )
