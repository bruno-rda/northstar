from decimal import Decimal
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.routing import APIRoute
from pydantic import BaseModel

from models import (
    ActionItem,
    ActionItemOwner,
    ActionItemPriority,
    ActionItemStatus,
    Alert,
    Archetype,
    Area,
    BillingRecord,
    Company,
    CompanyBillingConfig,
    CompanyStatus,
    IntegrationConnection,
    KpiValue,
    MemberAccessUpdate,
    MemberCreate,
    MembershipWithUser,
    PaginatedResponse,
    PeriodType,
    PermissionDefinition,
    PlatformScope,
    Provider,
    Report,
    ReportAttempt,
    ReportEligibility,
    ReportGenerateRequest,
    ReportSummary,
    Staff,
    StrategicContext,
    StrategicDocKey,
    paginate,
)
from store import db


def _operation_id(route: APIRoute) -> str:
    return route.name


def current_staff(x_mock_staff: Annotated[str | None, Header()] = None) -> Staff:
    staff = db.get_staff(x_mock_staff) if x_mock_staff else None
    if staff is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return staff


console_api = FastAPI(
    title="northstar-console API (staff)",
    version="0.1.0",
    separate_input_output_schemas=False,
    generate_unique_id_function=_operation_id,
    dependencies=[Depends(current_staff)],
)

CurrentStaff = Annotated[Staff, Depends(current_staff)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


# ─── Console-specific DTOs ───────────────────────────────────────────────────


class CompanyListItem(BaseModel):
    id: str
    name: str
    industry: str | None
    country: str
    status: CompanyStatus
    connected_integrations_count: int
    join_date: str
    last_report_generated_at: str | None


class IntegrationHealth(BaseModel):
    provider: Provider
    connected: int
    needs_reauth: int
    disconnected: int


class ProviderCount(BaseModel):
    provider: Provider
    count: int


class UsageAnalytics(BaseModel):
    active_companies: int
    reports_generated: int
    integration_health_summary: list[IntegrationHealth]
    total_revenue_reference: Decimal
    most_used_integrations: list[ProviderCount]


class CompanyCreate(BaseModel):
    name: str
    country: str
    industry: str | None = None
    niche: str | None = None
    key_products: list[str] | None = None


class CompanyProfileUpdate(BaseModel):
    name: str | None = None
    industry: str | None = None
    niche: str | None = None
    key_products: list[str] | None = None
    country: str | None = None
    archetype: Archetype | None = None


class CompanyStatusUpdate(BaseModel):
    status: CompanyStatus
    status_note: str | None = None


class StrategicSectionUpdate(BaseModel):
    content: str | None


class BillingConfigUpdate(BaseModel):
    platform_fee_amount: Decimal
    revenue_share_pct: Decimal


class BillingStatusUpdate(BaseModel):
    status: Literal["invoiced", "paid"]


class ActionItemInput(BaseModel):
    owner: ActionItemOwner
    title: str
    description: str
    status: ActionItemStatus
    priority: ActionItemPriority


class ActionItemUpdate(BaseModel):
    owner: ActionItemOwner | None = None
    title: str | None = None
    description: str | None = None
    status: ActionItemStatus | None = None
    priority: ActionItemPriority | None = None


# ─── Companies ───────────────────────────────────────────────────────────────


@console_api.get("/companies")
def get_companies(
    page: Page = 1,
    page_size: PageSize = 20,
    status: CompanyStatus | None = None,
    search: str | None = None,
    industry: str | None = None,
    sort_by: Literal["name", "join_date", "status"] = "name",
    sort_dir: Literal["asc", "desc"] = "asc",
) -> PaginatedResponse[CompanyListItem]:
    companies = db.list_companies(
        status=status, search=search, industry=industry, sort_by=sort_by, sort_dir=sort_dir
    )
    items = [
        CompanyListItem(
            id=c.id,
            name=c.name,
            industry=c.industry,
            country=c.country,
            status=c.status,
            connected_integrations_count=db.connected_integrations_count(c.id),
            join_date=c.join_date,
            last_report_generated_at=db.last_report_generated_at(c.id),
        )
        for c in companies
    ]
    return paginate(items, page, page_size)


@console_api.get("/companies/{company_id}")
def get_company(company_id: str) -> Company:
    return db.get_company(company_id)


@console_api.post("/companies", status_code=201)
def create_company(body: CompanyCreate, staff: CurrentStaff) -> Company:
    return db.create_company(
        name=body.name,
        country=body.country,
        industry=body.industry,
        niche=body.niche,
        key_products=body.key_products or [],
        staff_id=staff.id,
    )


@console_api.patch("/companies/{company_id}/profile")
def update_company_profile(company_id: str, body: CompanyProfileUpdate) -> Company:
    return db.update_company_profile(company_id, body.model_dump(exclude_unset=True))


@console_api.patch("/companies/{company_id}/status")
def update_company_status(company_id: str, body: CompanyStatusUpdate) -> Company:
    return db.update_company_status(company_id, body.status, body.status_note)


# ─── Strategic context ───────────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/strategic-context")
def get_strategic_context(company_id: str) -> StrategicContext:
    return db.get_strategic_context(company_id)


@console_api.put("/companies/{company_id}/strategic-context/{section}")
def update_strategic_context_section(
    company_id: str, section: StrategicDocKey, body: StrategicSectionUpdate, staff: CurrentStaff
) -> StrategicContext:
    return db.update_strategic_context_section(company_id, section, body.content, staff.id)


# ─── Permissions & members ───────────────────────────────────────────────────


@console_api.get("/permissions")
def get_permissions() -> list[PermissionDefinition]:
    return db.get_permission_definitions()


@console_api.get("/companies/{company_id}/members")
def get_company_members(company_id: str) -> list[MembershipWithUser]:
    return db.get_company_members(company_id)


@console_api.post("/companies/{company_id}/members", status_code=201)
def add_company_member(company_id: str, body: MemberCreate) -> MembershipWithUser:
    return db.add_company_member(company_id, body.email, body.name, body.permissions)


@console_api.patch("/companies/{company_id}/members/{membership_id}")
def update_member_access(
    company_id: str, membership_id: str, body: MemberAccessUpdate
) -> MembershipWithUser:
    return db.update_member_access(company_id, membership_id, body.permissions)


@console_api.delete("/companies/{company_id}/members/{membership_id}", status_code=204)
def remove_company_member(company_id: str, membership_id: str) -> None:
    db.remove_company_member(company_id, membership_id)


# ─── Integrations ────────────────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/integrations")
def get_integrations(company_id: str) -> list[IntegrationConnection]:
    return db.get_integrations(company_id)


@console_api.delete("/companies/{company_id}/integrations/{integration_id}", status_code=204)
def disconnect_integration(company_id: str, integration_id: str) -> None:
    db.disconnect_integration(company_id, integration_id)


# ─── KPIs ────────────────────────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/kpis")
def get_kpi_values(
    company_id: str,
    area: Area,
    period_type: PeriodType,
    period_start: str,
    platform_scope: PlatformScope | None = None,
) -> list[KpiValue]:
    return db.get_kpi_values(
        company_id,
        period_type=period_type,
        period_start=period_start,
        period_start_to=None,
        platform_scope=platform_scope,
    )


# ─── Reports ─────────────────────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/reports")
def get_reports(
    company_id: str, area: Area, page: Page = 1, page_size: PageSize = 10
) -> PaginatedResponse[ReportSummary]:
    return paginate(db.get_reports(company_id, area), page, page_size)


@console_api.get("/companies/{company_id}/reports/{report_id}")
def get_report(company_id: str, report_id: str) -> Report:
    return db.get_report(company_id, report_id)


@console_api.get("/companies/{company_id}/reports-eligibility")
def can_generate_report(company_id: str, area: Area) -> ReportEligibility:
    eligible, reason = db.can_generate_report(company_id, area)
    return ReportEligibility(eligible=eligible, blocking_reason=reason)


@console_api.post("/companies/{company_id}/reports/generate")
def generate_report(
    company_id: str, body: ReportGenerateRequest, staff: CurrentStaff
) -> ReportAttempt:
    return db.generate_report(company_id, body.area, staff.id)


@console_api.get("/companies/{company_id}/report-attempts")
def get_report_attempts(
    company_id: str, page: Page = 1, page_size: PageSize = 20
) -> PaginatedResponse[ReportAttempt]:
    return paginate(db.list_report_attempts(company_id), page, page_size)


@console_api.get("/companies/{company_id}/report-attempts/{attempt_id}")
def get_report_attempt(company_id: str, attempt_id: str) -> ReportAttempt:
    return db.get_report_attempt(company_id, attempt_id)


# ─── Action items ────────────────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/action-items")
def get_action_items(company_id: str, area: Area) -> list[ActionItem]:
    return db.get_action_items(company_id, area)


@console_api.post("/companies/{company_id}/reports/{report_id}/action-items", status_code=201)
def create_action_item(
    company_id: str, report_id: str, body: ActionItemInput, staff: CurrentStaff
) -> ActionItem:
    return db.create_action_item(
        company_id,
        report_id,
        owner=body.owner,
        title=body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        actor_id=staff.id,
    )


@console_api.patch("/companies/{company_id}/action-items/{action_item_id}")
def update_action_item(
    company_id: str, action_item_id: str, body: ActionItemUpdate, staff: CurrentStaff
) -> ActionItem:
    return db.update_action_item(
        company_id, action_item_id, body.model_dump(exclude_unset=True), staff.id
    )


@console_api.delete("/companies/{company_id}/action-items/{action_item_id}", status_code=204)
def delete_action_item(company_id: str, action_item_id: str) -> None:
    db.delete_action_item(company_id, action_item_id)


# ─── Alerts & notifications ──────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/alerts")
def get_alerts(
    company_id: str,
    status: Literal["active", "dismissed"],
    page: Page = 1,
    page_size: PageSize = 20,
) -> PaginatedResponse[Alert]:
    return paginate(db.get_alerts(company_id, status), page, page_size)


@console_api.post("/companies/{company_id}/alerts/{alert_id}/dismiss")
def dismiss_alert(company_id: str, alert_id: str, staff: CurrentStaff) -> Alert:
    return db.dismiss_alert(company_id, alert_id, staff.id)


# ─── Billing ─────────────────────────────────────────────────────────────────


@console_api.get("/companies/{company_id}/billing")
def get_billing_record(company_id: str, period_month: str) -> BillingRecord:
    return db.get_billing_record(company_id, period_month)


@console_api.get("/companies/{company_id}/billing/config")
def get_billing_config(company_id: str) -> CompanyBillingConfig:
    return db.get_billing_config(company_id)


@console_api.put("/companies/{company_id}/billing/config")
def update_billing_config(company_id: str, body: BillingConfigUpdate) -> CompanyBillingConfig:
    return db.update_billing_config(company_id, body.platform_fee_amount, body.revenue_share_pct)


@console_api.patch("/companies/{company_id}/billing/{billing_record_id}/status")
def update_billing_status(
    company_id: str, billing_record_id: str, body: BillingStatusUpdate, staff: CurrentStaff
) -> BillingRecord:
    return db.update_billing_status(company_id, billing_record_id, body.status, staff.id)


# ─── Usage analytics ─────────────────────────────────────────────────────────


def _count_by_status(
    integrations: list[IntegrationConnection], provider: Provider, status: str
) -> int:
    return sum(1 for i in integrations if i.provider == provider and i.status == status)


@console_api.get("/analytics/usage")
def get_usage_analytics(date_from: str, date_to: str) -> UsageAnalytics:
    providers = list(Provider)
    integrations = db.all_integrations()
    return UsageAnalytics(
        active_companies=sum(1 for c in db.all_companies() if c.status == "active"),
        reports_generated=sum(1 for a in db.all_report_attempts() if a.outcome == "succeeded"),
        integration_health_summary=[
            IntegrationHealth(
                provider=p,
                connected=_count_by_status(integrations, p, "connected"),
                needs_reauth=_count_by_status(integrations, p, "needs_reauth"),
                disconnected=_count_by_status(integrations, p, "disconnected"),
            )
            for p in providers
        ],
        total_revenue_reference=sum(
            (b.period_revenue for b in db.all_billing_records()), Decimal("0")
        ),
        most_used_integrations=sorted(
            (
                ProviderCount(provider=p, count=sum(1 for i in integrations if i.provider == p))
                for p in providers
            ),
            key=lambda pc: pc.count,
            reverse=True,
        ),
    )
