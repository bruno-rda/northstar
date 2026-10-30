from __future__ import annotations

import hashlib
import itertools
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from models import (
    AccessRequest,
    ActionItem,
    ActionItemOwner,
    ActionItemPriority,
    ActionItemStatus,
    Alert,
    AlertSeverity,
    AlertType,
    Area,
    BillingRecord,
    BillingStatus,
    Company,
    CompanyBillingConfig,
    CompanyStatus,
    IntegrationConnection,
    KpiSnapshotItem,
    KpiValue,
    Membership,
    MembershipWithUser,
    NotificationPreference,
    Permission,
    PermissionDefinition,
    PlatformScope,
    Provider,
    Report,
    ReportAttempt,
    ReportSection,
    ReportSummary,
    RevenueRange,
    Staff,
    StrategicContext,
    StrategicDoc,
    StrategicDocKey,
    User,
)


class StoreError(Exception):
    """Domain error carrying an HTTP status; mapped to a response in main.py."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


# ─── Constants / deterministic helpers ───────────────────────────────────────

PERIOD_CURRENT = ("2026-06-01", "2026-06-30")
PERIOD_PREVIOUS = ("2026-05-01", "2026-05-31")
PERIOD_THIS_MONTH = ("2026-07-01", "2026-07-08")

ALL_ALERT_TYPES = (
    "integration_disconnected",
    "token_expiring",
    "report_available",
    "report_generation_failed",
)
FEATURED_KEYS: dict[Area, list[str]] = {
    Area.general: ["net_revenue", "total_orders", "gross_margin"],
    Area.marketing: ["roas", "cac", "cvr"],
}
GENERAL_SALES_SCOPES: list[PlatformScope] = ["aggregated", "amazon", "tiendanube"]


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _seeded_unit(seed: str) -> float:
    """Deterministic 0..1 value so synthesized numbers are stable across runs."""
    digest = hashlib.md5(seed.encode()).digest()
    return int.from_bytes(digest[:4], "big") / 0xFFFFFFFF


def _iso_day(d: datetime) -> str:
    return d.date().isoformat()


def _first_of_month(date_str: str) -> str:
    return f"{date_str[:7]}-01"


def _last_day_of_month(month_start: str) -> str:
    y, m, _ = (int(x) for x in month_start.split("-"))
    nxt = datetime(y + (m // 12), (m % 12) + 1, 1, tzinfo=UTC)
    return _iso_day(nxt - timedelta(days=1))


def _data_end_of_month(month_start: str) -> str:
    if month_start == PERIOD_THIS_MONTH[0]:
        return PERIOD_THIS_MONTH[1]
    return _last_day_of_month(month_start)


def _each_day(start: str, end: str) -> list[str]:
    out: list[str] = []
    d = datetime.fromisoformat(f"{start}T00:00:00+00:00")
    e = datetime.fromisoformat(f"{end}T00:00:00+00:00")
    while d <= e:
        out.append(_iso_day(d))
        d += timedelta(days=1)
    return out


def _month_starts_back(count: int, anchor_month_start: str) -> list[str]:
    y, m, _ = (int(x) for x in anchor_month_start.split("-"))
    out: list[str] = []
    for i in range(count - 1, -1, -1):
        total = (y * 12 + (m - 1)) - i
        out.append(f"{total // 12:04d}-{total % 12 + 1:02d}-01")
    return out


def _daily_raw_weight(date_str: str) -> float:
    dow = datetime.fromisoformat(f"{date_str}T00:00:00+00:00").weekday()  # Mon=0..Sun=6
    weekend = 0.8 if dow >= 5 else 1.05
    return weekend * (0.75 + _seeded_unit(f"day-{date_str}") * 0.5)


class _ProductSeed:
    def __init__(self, id: str, name: str, revenue_weight: float, order_weight: float) -> None:
        self.id = id
        self.name = name
        self.revenue_weight = revenue_weight
        self.order_weight = order_weight


PRODUCT_CATALOG: dict[str, list[_ProductSeed]] = {
    "comp_1": [
        _ProductSeed("sku_clasico_500", "Yerba Clásico 500g", 20, 18),
        _ProductSeed("sku_clasico_1k", "Yerba Clásico 1kg", 15, 10),
        _ProductSeed("sku_organica", "Yerba Orgánica 500g", 12, 10),
        _ProductSeed("sku_termo_prem", "Termo Set Premium", 11, 5),
        _ProductSeed("sku_suave", "Yerba Suave 500g", 8, 8),
        _ProductSeed("sku_despalada", "Yerba Despalada 500g", 7, 6),
        _ProductSeed("sku_termo_cla", "Termo Set Clásico", 6, 5),
        _ProductSeed("sku_bombilla_alp", "Bombilla Alpaca", 5, 11),
        _ProductSeed("sku_barbacua", "Yerba Barbacuá 500g", 4, 4),
        _ProductSeed("sku_mate_imperial", "Mate Imperial", 3.5, 3),
        _ProductSeed("sku_bombilla_ace", "Bombilla Acero", 3, 9),
        _ProductSeed("sku_kids", "Yerba Kids 250g", 2, 4),
        _ProductSeed("sku_combo", "Combo Cebador", 2, 3),
        _ProductSeed("sku_limpiador", "Limpiador de Mate", 1.5, 4),
    ],
}


def _report_sections(area: Area) -> list[ReportSection]:
    if area == "general":
        return [
            ReportSection(
                key="executive_brief",
                title="Executive Brief",
                content="Net revenue and order volume both grew month-over-month, led by "
                "marketplace channels. Margin held steady in the mid-40s.",
            ),
            ReportSection(
                key="top_priorities",
                title="Top Priorities",
                content="Protect inventory on best-sellers and lock in improved fulfillment "
                "rates before the next demand peak.",
            ),
            ReportSection(
                key="ops_health",
                title="Operations Health",
                content="Fulfillment SLAs are within target. One SKU is trending toward a "
                "stockout within two weeks.",
            ),
            ReportSection(
                key="forecast",
                title="Forecast",
                content="At the current sell-through rate, next month is projected to land "
                "slightly above this period.",
            ),
        ]
    return [
        ReportSection(
            key="marketing_brief",
            title="Marketing Brief",
            content="Paid efficiency improved: ROAS rose and CAC fell. The top Meta campaign "
            "is under-spending relative to its efficiency.",
        ),
        ReportSection(
            key="channel_performance",
            title="Channel Performance",
            content="Meta leads on efficiency; Google search holds steady. Retargeting is "
            "not yet live.",
        ),
        ReportSection(
            key="top_marketing_priorities",
            title="Top Marketing Priorities",
            content="Scale the top campaign, stand up retargeting, and refresh creative "
            "before fatigue sets in.",
        ),
        ReportSection(
            key="campaign_health",
            title="Campaign Health",
            content="Current creative has been live for 6+ weeks and is showing early signs "
            "of fatigue.",
        ),
    ]


def _snapshot(area: Area) -> list[KpiSnapshotItem]:
    if area == "general":
        return [
            KpiSnapshotItem(kpi_key="net_revenue", platform_scope="aggregated", value=18400),
            KpiSnapshotItem(kpi_key="total_orders", platform_scope="aggregated", value=612),
            KpiSnapshotItem(kpi_key="gross_margin", platform_scope="aggregated", value=47.2),
        ]
    return [
        KpiSnapshotItem(kpi_key="roas", platform_scope="aggregated", value=4.8),
        KpiSnapshotItem(kpi_key="cac", platform_scope="aggregated", value=12.5),
        KpiSnapshotItem(kpi_key="cvr", platform_scope="aggregated", value=3.2),
    ]


class Store:
    staff: list[Staff]
    users: list[User]
    permission_definitions: list[PermissionDefinition]
    companies: list[Company]
    members: list[MembershipWithUser]
    integrations: list[IntegrationConnection]
    kpi_values: list[KpiValue]
    report_attempts: list[ReportAttempt]
    reports: list[Report]
    action_items: list[ActionItem]
    alerts: list[Alert]
    billing_records: list[BillingRecord]
    strategic_contexts: list[StrategicContext]
    notification_prefs: list[NotificationPreference]
    access_requests: list[AccessRequest]

    def __init__(self) -> None:
        self._ids = itertools.count(1000)
        # settle-on-read report generation: attempt_id -> (settle_at, area, triggered_by)
        self._pending: dict[str, tuple[datetime, Area, str]] = {}
        self.report_gen_delay_seconds: float = 5.0
        self._seed()

    def _next_id(self, prefix: str) -> str:
        return f"{prefix}_{next(self._ids)}"

    def reset(self) -> None:
        """Re-seed to the default dataset in place (POST /__mock/reset)."""
        self._ids = itertools.count(1000)
        self._pending = {}
        self._seed()

    # ─── People ──────────────────────────────────────────────────────────────

    def get_staff(self, staff_id: str) -> Staff | None:
        return next((s for s in self.staff if s.id == staff_id), None)

    def get_user(self, user_id: str) -> User | None:
        return next((u for u in self.users if u.id == user_id), None)

    def get_permission_definitions(self) -> list[PermissionDefinition]:
        return list(self.permission_definitions)

    # ─── Companies ───────────────────────────────────────────────────────────

    def all_companies(self) -> list[Company]:
        return list(self.companies)

    def get_company(self, company_id: str) -> Company:
        c = next((c for c in self.companies if c.id == company_id), None)
        if c is None:
            raise StoreError(404, "Company not found")
        return c

    def connected_integrations_count(self, company_id: str) -> int:
        return sum(
            1
            for i in self.integrations
            if i.company_id == company_id and i.status == "connected"
        )

    def last_report_generated_at(self, company_id: str) -> str | None:
        times = [
            a.triggered_at
            for a in self.report_attempts
            if a.company_id == company_id and a.outcome == "succeeded"
        ]
        return max(times) if times else None

    def list_companies(
        self,
        *,
        status: str | None,
        search: str | None,
        industry: str | None,
        sort_by: str,
        sort_dir: str,
    ) -> list[Company]:
        results = list(self.companies)
        if search:
            q = search.lower()
            results = [c for c in results if q in c.name.lower()]
        if status:
            results = [c for c in results if c.status == status]
        if industry:
            results = [c for c in results if c.industry == industry]

        status_order = ["active", "onboarding", "created", "suspended", "churned"]
        if sort_by == "join_date":
            results.sort(key=lambda c: c.join_date)
        elif sort_by == "status":
            results.sort(key=lambda c: status_order.index(c.status))
        else:
            results.sort(key=lambda c: c.name.lower())
        if sort_dir == "desc":
            results.reverse()
        return results

    def create_company(
        self,
        *,
        name: str,
        country: str,
        industry: str | None,
        niche: str | None,
        key_products: list[str],
        staff_id: str,
    ) -> Company:
        now = _now()
        company = Company(
            id=self._next_id("comp"),
            name=name,
            country=country,
            industry=industry,
            niche=niche,
            key_products=key_products,
            archetype=None,
            status=CompanyStatus.created,
            status_note=None,
            join_date=now[:10],
            created_by_staff_id=staff_id,
            created_at=now,
            updated_at=now,
        )
        self.companies.insert(0, company)
        self.strategic_contexts.insert(0, _empty_context(company.id))
        return company

    def update_company_profile(
        self, company_id: str, patch: dict[str, object]
    ) -> Company:
        c = self.get_company(company_id)
        updated = c.model_copy(update={**patch, "updated_at": _now()})
        self._replace(self.companies, updated)
        return updated

    def update_company_status(
        self, company_id: str, status: str, status_note: str | None
    ) -> Company:
        c = self.get_company(company_id)
        updated = c.model_copy(
            update={"status": status, "status_note": status_note, "updated_at": _now()}
        )
        self._replace(self.companies, updated)
        return updated

    # ─── Members ─────────────────────────────────────────────────────────────

    def get_company_members(self, company_id: str) -> list[MembershipWithUser]:
        return [m for m in self.members if m.company_id == company_id]

    def get_user_memberships(self, user_id: str) -> list[Membership]:
        return [m for m in self.members if m.user_id == user_id]

    def add_company_member(
        self, company_id: str, email: str, name: str | None, permissions: list[Permission]
    ) -> MembershipWithUser:
        now = _now()
        user = next((u for u in self.users if u.email.lower() == email.lower()), None)
        if user is None:
            user = User(
                id=self._next_id("user"),
                name=name or email.split("@")[0],
                email=email,
                created_at=now,
            )
            self.users.append(user)
        member = MembershipWithUser(
            id=self._next_id("mem"),
            user_id=user.id,
            company_id=company_id,
            permissions=permissions,
            created_at=now,
            user=user,
        )
        self.members.append(member)
        return member

    def update_member_access(
        self, company_id: str, membership_id: str, permissions: list[Permission]
    ) -> MembershipWithUser:
        company_members = self.get_company_members(company_id)
        target = next((m for m in company_members if m.id == membership_id), None)
        if target is None:
            raise StoreError(404, "Membership not found")
        other_managers = [
            m
            for m in company_members
            if m.id != membership_id and Permission.manage_people in m.permissions
        ]
        if (
            Permission.manage_people in target.permissions
            and not other_managers
            and Permission.manage_people not in permissions
        ):
            raise StoreError(422, "At least one member must be able to manage people")
        updated = target.model_copy(update={"permissions": permissions})
        self._replace(self.members, updated)
        return updated

    def remove_company_member(self, company_id: str, membership_id: str) -> None:
        company_members = self.get_company_members(company_id)
        target = next((m for m in company_members if m.id == membership_id), None)
        if target is None:
            raise StoreError(404, "Membership not found")
        remaining_managers = [
            m
            for m in company_members
            if m.id != membership_id and Permission.manage_people in m.permissions
        ]
        if Permission.manage_people in target.permissions and not remaining_managers:
            raise StoreError(422, "At least one member must be able to manage people")
        self.members = [m for m in self.members if m.id != membership_id]

    # ─── Integrations ────────────────────────────────────────────────────────

    def all_integrations(self) -> list[IntegrationConnection]:
        return list(self.integrations)

    def get_integrations(self, company_id: str) -> list[IntegrationConnection]:
        return [i for i in self.integrations if i.company_id == company_id]

    def disconnect_integration(self, company_id: str, integration_id: str) -> None:
        for i in self.integrations:
            if i.id == integration_id and i.company_id == company_id:
                self._replace(self.integrations, i.model_copy(update={"status": "disconnected"}))
                return
        raise StoreError(404, "Integration not found")

    def connect_integration(
        self, company_id: str, provider: Provider, user_id: str
    ) -> IntegrationConnection:
        now = _now()
        fields = {
            "status": "connected",
            "connected_at": now,
            "last_sync_at": now,
            "last_successful_sync_at": now,
        }
        for i in self.integrations:
            if i.company_id == company_id and i.provider == provider:
                updated = i.model_copy(update=fields)
                self._replace(self.integrations, updated)
                return updated
        connection = IntegrationConnection(
            id=self._next_id("int"),
            company_id=company_id,
            provider=provider,
            connected_by_user_id=user_id,
            **fields,  # type: ignore[arg-type]
        )
        self.integrations.append(connection)
        return connection

    # ─── KPIs ────────────────────────────────────────────────────────────────

    def get_kpi_values(
        self,
        company_id: str,
        *,
        period_type: str,
        period_start: str,
        period_start_to: str | None,
        platform_scope: str | None,
    ) -> list[KpiValue]:
        def in_range(k: KpiValue) -> bool:
            if period_start_to:
                return period_start <= k.period_start <= period_start_to
            return k.period_start == period_start

        return [
            k
            for k in self.kpi_values
            if k.company_id == company_id
            and k.period_type == period_type
            and in_range(k)
            and (platform_scope is None or k.platform_scope == platform_scope)
        ]

    def _kpi_lookup(
        self, company_id: str, kpi_key: str, scope: str, month_start: str
    ) -> float | None:
        row = next(
            (
                k
                for k in self.kpi_values
                if k.company_id == company_id
                and k.kpi_key == kpi_key
                and k.platform_scope == scope
                and k.period_start == month_start
                and k.status == "ok"
            ),
            None,
        )
        return row.value if row else None

    def _range_total(
        self, company_id: str, kpi_key: str, scope: str, start: str, end: str
    ) -> float:
        total = 0.0
        for day in _each_day(start, end):
            month_start = _first_of_month(day)
            if day > _data_end_of_month(month_start):
                continue
            v = self._kpi_lookup(company_id, kpi_key, scope, month_start)
            if v is None:
                continue
            total += v / len(_each_day(month_start, _data_end_of_month(month_start)))
        return total

    def _month_weight_sum(self, month_start: str) -> float:
        return sum(
            _daily_raw_weight(d) for d in _each_day(month_start, _data_end_of_month(month_start))
        )

    def get_daily_sales(
        self, company_id: str, period_start: str, period_end: str, scope: str
    ) -> list[tuple[str, float, int]]:
        points: list[tuple[str, float, int]] = []
        for day in _each_day(period_start, period_end):
            month_start = _first_of_month(day)
            if day > _data_end_of_month(month_start):
                continue
            monthly_revenue = self._kpi_lookup(company_id, "net_revenue", scope, month_start)
            if monthly_revenue is None:
                continue
            monthly_orders = self._kpi_lookup(company_id, "total_orders", scope, month_start) or 0
            weight = _daily_raw_weight(day) / self._month_weight_sum(month_start)
            points.append((day, round(monthly_revenue * weight), round(monthly_orders * weight)))
        return points

    def get_product_contribution(
        self, company_id: str, period_start: str, period_end: str, scope: str
    ) -> list[tuple[str, str, float, int]]:
        catalog = PRODUCT_CATALOG.get(company_id, [])
        total_revenue = self._range_total(company_id, "net_revenue", scope, period_start, period_end)
        total_orders = self._range_total(company_id, "total_orders", scope, period_start, period_end)
        if not catalog or total_revenue <= 0:
            return []
        return [
            (
                p.id,
                p.name,
                round(total_revenue * p.revenue_weight / 100),
                round(total_orders * p.order_weight / 100),
            )
            for p in catalog
        ]

    def dashboard_current_featured(self, company_id: str, area: Area) -> list[KpiValue]:
        featured = FEATURED_KEYS[area]
        return [
            k
            for k in self.kpi_values
            if k.company_id == company_id
            and k.kpi_key in featured
            and k.platform_scope == "aggregated"
            and k.period_start == PERIOD_CURRENT[0]
        ]

    # ─── Reports ─────────────────────────────────────────────────────────────

    def _settle_pending(self) -> None:
        now = datetime.now(UTC)
        due = [aid for aid, (settle_at, _, _) in self._pending.items() if now >= settle_at]
        for attempt_id in due:
            _, area, triggered_by = self._pending.pop(attempt_id)
            report = Report(
                id=self._next_id("rep"),
                company_id=self._attempt(attempt_id).company_id,
                area=area,
                period_type="monthly",
                period_start="2026-07-01",
                period_end="2026-07-31",
                generated_at=_now(),
                triggered_by_user_id=triggered_by,
                headline="Your latest report is ready — open it to see this period's priorities.",
                sections=_report_sections(area),
                action_items=[],
                kpi_snapshot=_snapshot(area),
                pdf_url=f"/mock/reports/{self._next_id('pdf')}.pdf",
            )
            self.reports.insert(0, report)
            attempt = self._attempt(attempt_id)
            self._replace(
                self.report_attempts,
                attempt.model_copy(
                    update={
                        "outcome": "succeeded",
                        "last_checkpoint": "pdf_rendered",
                        "report_id": report.id,
                    }
                ),
            )
            label = "General" if area == "general" else "Marketing"
            self.alerts.insert(
                0,
                Alert(
                    id=self._next_id("al"),
                    company_id=report.company_id,
                    type=AlertType.report_available,
                    severity=AlertSeverity.info,
                    message=f"Your {label} report for July 2026 is ready to view.",
                    related_integration_id=None,
                    related_report_id=report.id,
                    created_at=_now(),
                    dismissed_at=None,
                    dismissed_by_user_id=None,
                ),
            )

    def _attempt(self, attempt_id: str) -> ReportAttempt:
        a = next((a for a in self.report_attempts if a.id == attempt_id), None)
        if a is None:
            raise StoreError(404, "Report attempt not found")
        return a

    def get_reports(self, company_id: str, area: Area) -> list[ReportSummary]:
        self._settle_pending()
        reports = [
            r for r in self.reports if r.company_id == company_id and r.area == area
        ]
        reports.sort(key=lambda r: r.generated_at, reverse=True)
        return [
            ReportSummary(
                id=r.id,
                company_id=r.company_id,
                area=r.area,
                period_type=r.period_type,
                period_start=r.period_start,
                period_end=r.period_end,
                generated_at=r.generated_at,
                kpi_snapshot=r.kpi_snapshot,
                headline=r.headline,
            )
            for r in reports
        ]

    def get_report(self, company_id: str, report_id: str) -> Report:
        self._settle_pending()
        report = next(
            (r for r in self.reports if r.id == report_id and r.company_id == company_id), None
        )
        if report is None:
            raise StoreError(404, "Report not found")
        items = [a for a in self.action_items if a.report_id == report.id]
        return report.model_copy(update={"action_items": items})

    def can_generate_report(self, company_id: str, area: Area) -> tuple[bool, str | None]:
        self._settle_pending()
        required = (
            [Provider.amazon, Provider.tiendanube]
            if area == "general"
            else [Provider.meta_ads, Provider.google_analytics]
        )
        company_integrations = self.get_integrations(company_id)
        has_connected = any(
            i.provider == p and i.status == "connected"
            for p in required
            for i in company_integrations
        )
        in_progress = any(
            a.company_id == company_id and a.area == area and a.outcome == "in_progress"
            for a in self.report_attempts
        )
        if in_progress:
            return False, "A report is already being generated for this area."
        if has_connected:
            return True, None
        has_broken = any(
            i.provider == p and i.status in ("needs_reauth", "error")
            for p in required
            for i in company_integrations
        )
        if has_broken:
            return False, "An integration needs to be reconnected before a report can be generated."
        label = "Amazon or Tiendanube" if area == "general" else "Meta Ads or Google Analytics"
        return (
            False,
            f"An integration needs to be connected before a report can be generated. "
            f"Connect {label} to continue.",
        )

    def generate_report(
        self, company_id: str, area: Area, triggered_by_user_id: str
    ) -> ReportAttempt:
        eligible, reason = self.can_generate_report(company_id, area)
        if not eligible:
            raise StoreError(400, reason or "Report generation is not currently eligible.")
        attempt = ReportAttempt(
            id=self._next_id("ra"),
            company_id=company_id,
            area=area,
            period_type="monthly",
            triggered_by_user_id=triggered_by_user_id,
            triggered_at=_now(),
            outcome="in_progress",
            last_checkpoint="kpi_validation",
            failure_reason=None,
            report_id=None,
        )
        self.report_attempts.insert(0, attempt)
        settle_at = datetime.now(UTC) + timedelta(seconds=self.report_gen_delay_seconds)
        self._pending[attempt.id] = (settle_at, area, triggered_by_user_id)
        return attempt

    def get_report_attempt(self, company_id: str, attempt_id: str) -> ReportAttempt:
        self._settle_pending()
        a = next(
            (a for a in self.report_attempts if a.id == attempt_id and a.company_id == company_id),
            None,
        )
        if a is None:
            raise StoreError(404, "Report attempt not found")
        return a

    def get_latest_report_attempt(self, company_id: str, area: Area) -> ReportAttempt | None:
        self._settle_pending()
        attempts = [
            a for a in self.report_attempts if a.company_id == company_id and a.area == area
        ]
        attempts.sort(key=lambda a: a.triggered_at, reverse=True)
        return attempts[0] if attempts else None

    def list_report_attempts(self, company_id: str) -> list[ReportAttempt]:
        self._settle_pending()
        attempts = [a for a in self.report_attempts if a.company_id == company_id]
        attempts.sort(key=lambda a: a.triggered_at, reverse=True)
        return attempts

    def all_report_attempts(self) -> list[ReportAttempt]:
        self._settle_pending()
        return list(self.report_attempts)

    # ─── Action items ────────────────────────────────────────────────────────

    def get_action_items(self, company_id: str, area: Area) -> list[ActionItem]:
        self._settle_pending()
        area_report_ids = {
            r.id for r in self.reports if r.company_id == company_id and r.area == area
        }
        return [
            a
            for a in self.action_items
            if a.company_id == company_id and a.report_id in area_report_ids
        ]

    def action_item_area(self, company_id: str, action_item_id: str) -> Area:
        item = next(
            (a for a in self.action_items if a.id == action_item_id and a.company_id == company_id),
            None,
        )
        if item is None:
            raise StoreError(404, "Action item not found")
        return self.get_report(company_id, item.report_id).area

    def create_action_item(
        self,
        company_id: str,
        report_id: str,
        *,
        owner: ActionItemOwner,
        title: str,
        description: str,
        status: ActionItemStatus,
        priority: ActionItemPriority,
        actor_id: str,
    ) -> ActionItem:
        is_done = status == "done"
        item = ActionItem(
            id=self._next_id("ai"),
            report_id=report_id,
            company_id=company_id,
            owner=owner,
            title=title,
            description=description,
            status=status,
            priority=priority,
            completed_at=_now() if is_done else None,
            completed_by_user_id=actor_id if is_done else None,
        )
        self.action_items.append(item)
        return item

    def update_action_item(
        self, company_id: str, action_item_id: str, patch: dict[str, object], actor_id: str
    ) -> ActionItem:
        current = next(
            (
                a
                for a in self.action_items
                if a.id == action_item_id and a.company_id == company_id
            ),
            None,
        )
        if current is None:
            raise StoreError(404, "Action item not found")
        merged = current.model_copy(update=patch)
        is_done = merged.status == "done"
        completed_at = (current.completed_at or _now()) if is_done else None
        completed_by = (current.completed_by_user_id or actor_id) if is_done else None
        updated = merged.model_copy(
            update={"completed_at": completed_at, "completed_by_user_id": completed_by}
        )
        self._replace(self.action_items, updated)
        return updated

    def delete_action_item(self, company_id: str, action_item_id: str) -> None:
        self.action_item_area(company_id, action_item_id)  # 404 if it isn't this company's
        self.action_items = [
            a
            for a in self.action_items
            if not (a.id == action_item_id and a.company_id == company_id)
        ]

    # ─── Alerts & notifications ──────────────────────────────────────────────

    def get_alerts(self, company_id: str, status: str) -> list[Alert]:
        self._settle_pending()
        alerts = [
            a
            for a in self.alerts
            if a.company_id == company_id
            and (a.dismissed_at is None if status == "active" else a.dismissed_at is not None)
        ]
        alerts.sort(key=lambda a: a.created_at, reverse=True)
        return alerts

    def dismiss_alert(self, company_id: str, alert_id: str, actor_id: str) -> Alert:
        target = next(
            (a for a in self.alerts if a.id == alert_id and a.company_id == company_id), None
        )
        if target is None:
            raise StoreError(404, "Alert not found")
        updated = target.model_copy(
            update={"dismissed_at": _now(), "dismissed_by_user_id": actor_id}
        )
        self._replace(self.alerts, updated)
        return updated

    def get_notification_preferences(self, user_id: str) -> list[NotificationPreference]:
        return [p for p in self.notification_prefs if p.user_id == user_id]

    def update_notification_preference(
        self, user_id: str, alert_type: str, in_app_enabled: bool, email_enabled: bool
    ) -> NotificationPreference:
        updated = NotificationPreference(
            user_id=user_id,
            alert_type=alert_type,  # type: ignore[arg-type]
            in_app_enabled=in_app_enabled,
            email_enabled=email_enabled,
        )
        for idx, p in enumerate(self.notification_prefs):
            if p.user_id == user_id and p.alert_type == alert_type:
                self.notification_prefs[idx] = updated
                return updated
        self.notification_prefs.append(updated)
        return updated

    # ─── Strategic context (console) ─────────────────────────────────────────

    def get_strategic_context(self, company_id: str) -> StrategicContext:
        ctx = next((c for c in self.strategic_contexts if c.company_id == company_id), None)
        if ctx is None:
            raise StoreError(404, "Strategic context not found")
        return ctx

    def update_strategic_context_section(
        self, company_id: str, section: StrategicDocKey, content: str | None, staff_id: str
    ) -> StrategicContext:
        ctx = self.get_strategic_context(company_id)
        doc = StrategicDoc(content=content, updated_at=_now(), updated_by_staff_id=staff_id)
        updated = ctx.model_copy(update={section: doc})
        for idx, c in enumerate(self.strategic_contexts):
            if c.company_id == company_id:
                self.strategic_contexts[idx] = updated
        return updated

    # ─── Billing (console) ───────────────────────────────────────────────────

    def all_billing_records(self) -> list[BillingRecord]:
        return list(self.billing_records)

    def get_billing_record(self, company_id: str, period_month: str) -> BillingRecord:
        r = next(
            (
                b
                for b in self.billing_records
                if b.company_id == company_id and b.period_month == period_month
            ),
            None,
        )
        if r is None:
            raise StoreError(404, "Billing record not found")
        return r

    def get_billing_config(self, company_id: str) -> CompanyBillingConfig:
        records = [b for b in self.billing_records if b.company_id == company_id]
        if not records:
            raise StoreError(404, "No billing agreement configured")
        latest = max(records, key=lambda b: b.period_month)
        return CompanyBillingConfig(
            company_id=company_id,
            platform_fee_amount=latest.platform_fee_amount,
            revenue_share_pct=latest.revenue_share_pct,
        )

    def update_billing_config(
        self, company_id: str, platform_fee_amount: Decimal, revenue_share_pct: Decimal
    ) -> CompanyBillingConfig:
        period_month = _current_billing_period_month()
        existing = next(
            (
                b
                for b in self.billing_records
                if b.company_id == company_id and b.period_month == period_month
            ),
            None,
        )
        if existing is None:
            self.billing_records.append(
                BillingRecord(
                    id=self._next_id("br"),
                    company_id=company_id,
                    period_month=period_month,
                    platform_fee_amount=platform_fee_amount,
                    revenue_share_pct=revenue_share_pct,
                    period_revenue=Decimal("0"),
                    revenue_share_amount=Decimal("0"),
                    status="pending",
                    status_updated_by_staff_id=None,
                )
            )
        else:
            self._replace(
                self.billing_records,
                existing.model_copy(
                    update={
                        "platform_fee_amount": platform_fee_amount,
                        "revenue_share_pct": revenue_share_pct,
                    }
                ),
            )
        return CompanyBillingConfig(
            company_id=company_id,
            platform_fee_amount=platform_fee_amount,
            revenue_share_pct=revenue_share_pct,
        )

    def update_billing_status(
        self, company_id: str, billing_record_id: str, status: BillingStatus, staff_id: str
    ) -> BillingRecord:
        target = next(
            (
                b
                for b in self.billing_records
                if b.id == billing_record_id and b.company_id == company_id
            ),
            None,
        )
        if target is None:
            raise StoreError(404, "Billing record not found")
        updated = target.model_copy(
            update={"status": status, "status_updated_by_staff_id": staff_id}
        )
        self._replace(self.billing_records, updated)
        return updated

    # ─── Access requests (web) ───────────────────────────────────────────────

    def submit_access_request(
        self,
        *,
        name: str,
        email: str,
        company_name: str,
        country: str | None,
        website: str | None,
        monthly_revenue: RevenueRange | None,
        note: str | None,
    ) -> AccessRequest:
        if any(u.email.lower() == email.lower() for u in self.users):
            raise StoreError(409, "This email already has access. Please sign in instead.")
        req = AccessRequest(
            id=self._next_id("req"),
            name=name,
            email=email,
            company_name=company_name,
            country=country,
            website=website,
            monthly_revenue=monthly_revenue,
            note=note,
            created_at=_now(),
        )
        self.access_requests.insert(0, req)
        return req

    # ─── internals ───────────────────────────────────────────────────────────

    def _replace[M: (
        Company,
        MembershipWithUser,
        IntegrationConnection,
        ReportAttempt,
        ActionItem,
        Alert,
        BillingRecord,
    )](self, collection: list[M], updated: M) -> None:
        for idx, item in enumerate(collection):
            if item.id == updated.id:
                collection[idx] = updated
                return

    def _kpi(
        self,
        company_id: str,
        kpi_key: str,
        scope: PlatformScope,
        period: tuple[str, str],
        value: float | None,
        status: str,
    ) -> KpiValue:
        return KpiValue(
            id=self._next_id("kpi"),
            company_id=company_id,
            kpi_key=kpi_key,
            platform_scope=scope,
            period_type="monthly",
            period_start=period[0],
            period_end=period[1],
            value=value,
            status=status,  # type: ignore[arg-type]
            computed_at=f"{period[1]}T08:00:00Z" if status == "ok" else None,
        )

    def _generate_general_history(self) -> list[KpiValue]:
        months = _month_starts_back(24, PERIOD_CURRENT[0])
        pinned = {PERIOD_PREVIOUS[0], PERIOD_CURRENT[0]}
        rows: list[KpiValue] = []
        for idx, month_start in enumerate(months):
            if month_start in pinned:
                continue
            period = (month_start, _last_day_of_month(month_start))
            month_num = int(month_start[5:7])
            trend = 11000 + idx * 320
            seasonal = 1.14 if month_num in (11, 12) else 0.9 if month_num == 1 else 1.0
            noise = 0.9 + _seeded_unit(f"rev-{month_start}") * 0.2
            agg_revenue = round(trend * seasonal * noise / 100) * 100
            amazon_share = 0.58 + _seeded_unit(f"share-{month_start}") * 0.06
            amazon_revenue = round(agg_revenue * amazon_share / 100) * 100
            rev_by_scope = {
                "aggregated": agg_revenue,
                "amazon": amazon_revenue,
                "tiendanube": agg_revenue - amazon_revenue,
            }
            aov = 29 + _seeded_unit(f"aov-{month_start}") * 4
            for scope in GENERAL_SALES_SCOPES:
                rev = rev_by_scope[scope]
                rows.append(self._kpi("comp_1", "net_revenue", scope, period, rev, "ok"))
                rows.append(
                    self._kpi("comp_1", "total_orders", scope, period, round(rev / aov), "ok")
                )
            margin = 43.5 + _seeded_unit(f"mgn-{month_start}") * 4.5
            rows.append(
                self._kpi("comp_1", "gross_margin", "aggregated", period, round(margin * 10) / 10, "ok")
            )
        return rows

    def _generate_marketing_history(self, general: list[KpiValue]) -> list[KpiValue]:
        by_month: dict[str, dict[str, float]] = {}
        for row in general:
            if row.platform_scope == "aggregated" and row.value is not None:
                by_month.setdefault(row.period_start, {})[row.kpi_key] = row.value

        rows: list[KpiValue] = []
        for month_start, facts in sorted(by_month.items()):
            revenue, orders = facts.get("net_revenue"), facts.get("total_orders")
            if revenue is None or orders is None:
                continue
            period = (month_start, _last_day_of_month(month_start))

            ad_spend = round(revenue * (0.10 + _seeded_unit(f"spend-{month_start}") * 0.04))
            new_customers = round(orders * (0.28 + _seeded_unit(f"newc-{month_start}") * 0.08))
            sessions = round(orders / (0.027 + _seeded_unit(f"cvr-{month_start}") * 0.008))
            roas = 4.0 + _seeded_unit(f"roas-{month_start}") * 1.2

            rows += [
                self._kpi("comp_1", "ad_spend", "aggregated", period, ad_spend, "ok"),
                self._kpi("comp_1", "new_customers", "aggregated", period, new_customers, "ok"),
                self._kpi("comp_1", "sessions", "aggregated", period, sessions, "ok"),
                self._kpi("comp_1", "roas", "aggregated", period, round(roas * 10) / 10, "ok"),
                self._kpi(
                    "comp_1", "cac", "aggregated", period,
                    round(ad_spend / new_customers * 10) / 10, "ok",
                ),
                self._kpi(
                    "comp_1", "cvr", "aggregated", period,
                    round(orders / sessions * 1000) / 10, "ok",
                ),
            ]
        return rows

    def _seed(self) -> None:
        self.staff = [
            Staff(id="staff_1", name="Bruno Ramírez", email="bruno@gonorthstar.com"),
            Staff(id="staff_2", name="María González", email="maria@gonorthstar.com"),
        ]
        self.permission_definitions = [
            PermissionDefinition(key=Permission.view_general, label="View General", group="Area visibility"),
            PermissionDefinition(key=Permission.view_marketing, label="View Marketing", group="Area visibility"),
            PermissionDefinition(key=Permission.create_general_report, label="Generate General reports", group="Reports"),
            PermissionDefinition(key=Permission.create_marketing_report, label="Generate Marketing reports", group="Reports"),
            PermissionDefinition(key=Permission.manage_integrations, label="Manage integrations", group="Integrations"),
            PermissionDefinition(key=Permission.manage_people, label="Manage people", group="People"),
            PermissionDefinition(key=Permission.manage_billing, label="Manage billing", group="Ownership"),
            PermissionDefinition(key=Permission.transfer_ownership, label="Transfer ownership", group="Ownership"),
        ]

        u = User
        self.users = [
            u(id="user_1", name="Carlos Mendez", email="carlos@matelargo.com", created_at="2025-09-01T10:00:00Z"),
            u(id="user_1b", name="Lucía Martínez", email="lucia@matelargo.com", created_at="2025-09-05T10:00:00Z"),
            u(id="user_1c", name="Martín Ibarra", email="martin@matelargo.com", created_at="2026-02-10T10:00:00Z"),
            u(id="user_2", name="Ana García", email="ana@fuerzanatural.mx", created_at="2025-10-15T14:00:00Z"),
            u(id="user_2b", name="Luis Fernández", email="luis@fuerzanatural.mx", created_at="2025-11-20T10:00:00Z"),
            u(id="user_3", name="Diego Torres", email="diego@techwearba.com", created_at="2026-04-01T11:00:00Z"),
            u(id="user_3b", name="Camila Ruiz", email="camila@techwearba.com", created_at="2026-04-15T10:00:00Z"),
            u(id="user_4", name="Sofía Rojas", email="sofia@casaverde.co", created_at="2026-06-01T09:00:00Z"),
            u(id="user_5", name="Roberto Silva", email="roberto@sportify.com.ar", created_at="2025-11-01T10:00:00Z"),
            u(id="user_6", name="Valentina Cruz", email="valentina@lunacosmetics.cl", created_at="2025-08-15T09:00:00Z"),
            u(id="user_6b", name="Javier Paredes", email="javier@lunacosmetics.cl", created_at="2025-09-10T09:00:00Z"),
            u(id="user_8", name="Nicolás Fabbri", email="nicolas@brighthome.uy", created_at="2026-05-15T11:00:00Z"),
            u(id="user_renata", name="Renata Ibarra", email="renata@insightgrowth.co", created_at="2026-01-10T09:00:00Z"),
        ]
        users_by_id = {usr.id: usr for usr in self.users}

        # comp_2 = onboarding (empty), comp_3 = active — one truth reconciling the two mocks.
        self.companies = [
            _company("comp_1", "Mate Largo", "Food & Beverage", "Yerba mate & infusions", ["Yerba mate blends", "Bombillas", "Termo sets"], "Argentina", "catalizador_digital", "active", "2025-09-01", "staff_1"),
            _company("comp_2", "Fuerza Natural", "Health & Wellness", "Organic supplements", ["Protein powders", "Vitamins", "Collagen"], "Mexico", "operador_estancado", "onboarding", "2025-10-15", "staff_2"),
            _company("comp_3", "TechWear BA", "Fashion", "Performance streetwear", ["Hoodies", "Tech pants", "Caps"], "Argentina", None, "active", "2026-04-01", "staff_1"),
            _company("comp_4", "CasaVerde Home", "Home & Living", None, ["Planters", "Eco furniture"], "Colombia", None, "created", "2026-06-01", "staff_2"),
            _company("comp_5", "Sportify AR", "Sports & Outdoors", "Trail running gear", ["Running shoes", "Hydration packs", "GPS watches"], "Argentina", "operador_estancado", "suspended", "2025-11-01", "staff_1", "Billing overdue since April 2026"),
            _company("comp_6", "Luna Cosmetics", "Beauty", "Clean beauty & skincare", ["Serums", "SPF moisturizers", "Lip care"], "Chile", "catalizador_digital", "active", "2025-08-15", "staff_1"),
            _company("comp_7", "Andes Digital", "Technology", "SaaS tools for SMBs", ["Inventory software", "POS systems"], "Peru", None, "churned", "2025-03-01", "staff_2", "Client chose competitor in March 2026"),
            _company("comp_8", "BrightHome", "Home Decor", "Scandinavian-inspired décor", ["Cushions", "Lamps", "Wall art"], "Uruguay", None, "onboarding", "2026-05-15", "staff_1"),
        ]

        def mem(mid: str, uid: str, cid: str, perms: list[Permission], created: str) -> MembershipWithUser:
            return MembershipWithUser(
                id=mid, user_id=uid, company_id=cid, permissions=perms,
                created_at=created, user=users_by_id[uid],
            )

        full = [
            Permission.view_general, Permission.create_general_report, Permission.manage_integrations,
            Permission.manage_people, Permission.manage_billing, Permission.transfer_ownership,
        ]
        full_both = [
            Permission.view_general, Permission.view_marketing, Permission.create_general_report,
            Permission.create_marketing_report, Permission.manage_integrations,
            Permission.manage_people, Permission.manage_billing, Permission.transfer_ownership,
        ]
        self.members = [
            mem("mem_1", "user_1", "comp_1", full, "2025-09-01T10:00:00Z"),
            mem("mem_2", "user_1b", "comp_1", [Permission.view_general, Permission.view_marketing, Permission.create_general_report, Permission.manage_integrations, Permission.manage_people], "2025-09-05T10:00:00Z"),
            mem("mem_8", "user_1c", "comp_1", [Permission.view_marketing], "2026-02-10T10:00:00Z"),
            mem("mem_r1", "user_renata", "comp_1", [Permission.view_general, Permission.view_marketing, Permission.create_general_report, Permission.create_marketing_report, Permission.manage_integrations, Permission.manage_people], "2026-01-15T09:00:00Z"),
            mem("mem_3", "user_2", "comp_2", full, "2025-10-15T14:00:00Z"),
            mem("mem_9", "user_2b", "comp_2", [Permission.view_general, Permission.create_general_report, Permission.manage_integrations, Permission.manage_people], "2025-11-20T10:00:00Z"),
            mem("mem_r2", "user_renata", "comp_2", [Permission.view_general, Permission.create_general_report, Permission.manage_integrations, Permission.manage_people], "2026-01-15T09:00:00Z"),
            mem("mem_4", "user_3", "comp_3", full_both, "2026-04-01T11:00:00Z"),
            mem("mem_10", "user_3b", "comp_3", [Permission.view_general], "2026-04-15T10:00:00Z"),
            mem("mem_r3", "user_renata", "comp_3", [Permission.view_general], "2026-04-05T09:00:00Z"),
            mem("mem_5", "user_4", "comp_4", full, "2026-06-01T09:00:00Z"),
            mem("mem_6", "user_5", "comp_5", full, "2025-11-01T10:00:00Z"),
            mem("mem_7", "user_6", "comp_6", full_both, "2025-08-15T09:00:00Z"),
            mem("mem_11", "user_6b", "comp_6", [Permission.view_marketing, Permission.create_marketing_report, Permission.manage_integrations, Permission.manage_people], "2025-09-10T09:00:00Z"),
            mem("mem_12", "user_8", "comp_8", full, "2026-05-15T11:00:00Z"),
        ]

        def integ(iid: str, cid: str, provider: str, status: str, uid: str, connected: str, last: str | None, last_ok: str | None) -> IntegrationConnection:
            return IntegrationConnection(
                id=iid, company_id=cid, provider=provider, status=status,  # type: ignore[arg-type]
                connected_by_user_id=uid, connected_at=connected,
                last_sync_at=last, last_successful_sync_at=last_ok,
            )

        # comp_2 intentionally has no integrations (onboarding / empty states).
        self.integrations = [
            integ("int_1", "comp_1", "amazon", "connected", "user_1", "2025-09-10T10:00:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_2", "comp_1", "tiendanube", "connected", "user_1", "2025-09-10T10:05:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_3", "comp_1", "meta_ads", "connected", "user_1", "2025-09-12T14:00:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_10", "comp_1", "google_analytics", "connected", "user_1", "2025-09-15T09:00:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_6", "comp_3", "tiendanube", "needs_reauth", "user_3", "2026-04-05T10:00:00Z", "2026-06-20T06:00:00Z", "2026-06-15T06:00:00Z"),
            integ("int_12", "comp_3", "meta_ads", "connected", "user_3", "2026-04-05T10:10:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_7", "comp_5", "amazon", "disconnected", "user_5", "2025-11-10T10:00:00Z", "2026-04-30T06:00:00Z", "2026-04-28T06:00:00Z"),
            integ("int_13", "comp_5", "tiendanube", "disconnected", "user_5", "2025-11-05T10:00:00Z", "2026-04-30T06:00:00Z", "2026-04-25T06:00:00Z"),
            integ("int_8", "comp_6", "amazon", "connected", "user_6", "2025-08-20T10:00:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_9", "comp_6", "meta_ads", "connected", "user_6", "2025-08-20T10:05:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_14", "comp_6", "tiendanube", "connected", "user_6", "2025-08-25T10:00:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
            integ("int_15", "comp_7", "tiendanube", "disconnected", "user_8", "2025-03-05T10:00:00Z", "2026-03-01T06:00:00Z", "2026-02-25T06:00:00Z"),
            integ("int_17", "comp_8", "tiendanube", "connected", "user_8", "2026-05-20T10:00:00Z", "2026-07-01T06:00:00Z", "2026-07-01T06:00:00Z"),
        ]

        general_history = self._generate_general_history()
        self.kpi_values = (
            self._seed_kpis() + general_history + self._generate_marketing_history(general_history)
        )

        self.report_attempts = self._seed_attempts()
        self.reports = self._seed_reports()
        self.action_items = self._seed_action_items()
        self.alerts = self._seed_alerts()
        self.billing_records = self._seed_billing()
        self.strategic_contexts = [_empty_context(c.id) for c in self.companies]
        self.notification_prefs = [
            NotificationPreference(user_id=usr.id, alert_type=t, in_app_enabled=True, email_enabled=True)  # type: ignore[arg-type]
            for usr in self.users
            for t in ALL_ALERT_TYPES
        ]
        self.access_requests = []

    def _seed_kpis(self) -> list[KpiValue]:
        k = self._kpi
        cur, prev, this_m = PERIOD_CURRENT, PERIOD_PREVIOUS, PERIOD_THIS_MONTH
        rows: list[KpiValue] = [
            k("comp_1", "net_revenue", "aggregated", cur, 18400, "ok"),
            k("comp_1", "net_revenue", "aggregated", prev, 16800, "ok"),
            k("comp_1", "net_revenue", "amazon", cur, 11000, "ok"),
            k("comp_1", "net_revenue", "amazon", prev, 10000, "ok"),
            k("comp_1", "net_revenue", "tiendanube", cur, 7400, "ok"),
            k("comp_1", "net_revenue", "tiendanube", prev, 6800, "ok"),
            k("comp_1", "total_orders", "aggregated", cur, 612, "ok"),
            k("comp_1", "total_orders", "aggregated", prev, 570, "ok"),
            k("comp_1", "total_orders", "amazon", cur, 360, "ok"),
            k("comp_1", "total_orders", "tiendanube", cur, 252, "ok"),
            k("comp_1", "gross_margin", "aggregated", cur, 47.2, "ok"),
            k("comp_1", "gross_margin", "aggregated", prev, 45.8, "ok"),
            k("comp_1", "roas", "aggregated", cur, 4.8, "ok"),
            k("comp_1", "roas", "aggregated", prev, 4.3, "ok"),
            k("comp_1", "cac", "aggregated", cur, 12.5, "ok"),
            k("comp_1", "cac", "aggregated", prev, 13.9, "ok"),
            k("comp_1", "cvr", "aggregated", cur, 3.2, "ok"),
            k("comp_1", "cvr", "aggregated", prev, 2.9, "ok"),
            # Weights for the rate metrics above, back-derived so the pinned rates are
            # reproduced exactly: cac == ad_spend / new_customers, cvr == orders / sessions.
            k("comp_1", "ad_spend", "aggregated", cur, 2300, "ok"),
            k("comp_1", "ad_spend", "aggregated", prev, 2100, "ok"),
            k("comp_1", "new_customers", "aggregated", cur, 184, "ok"),
            k("comp_1", "new_customers", "aggregated", prev, 151, "ok"),
            k("comp_1", "sessions", "aggregated", cur, 19125, "ok"),
            k("comp_1", "sessions", "aggregated", prev, 19655, "ok"),
            k("comp_1", "net_revenue", "aggregated", this_m, 4950, "ok"),
            k("comp_1", "net_revenue", "amazon", this_m, 2950, "ok"),
            k("comp_1", "net_revenue", "tiendanube", this_m, 2000, "ok"),
            k("comp_1", "total_orders", "aggregated", this_m, 165, "ok"),
            k("comp_1", "gross_margin", "aggregated", this_m, 47.5, "ok"),
        ]
        for key in ("net_revenue", "total_orders", "gross_margin", "roas", "cac", "cvr"):
            rows.append(k("comp_2", key, "aggregated", cur, None, "not_available"))
        rows += [
            k("comp_3", "net_revenue", "aggregated", cur, None, "error"),
            k("comp_3", "net_revenue", "aggregated", prev, 9200, "ok"),
            k("comp_3", "total_orders", "aggregated", cur, None, "error"),
            k("comp_3", "total_orders", "aggregated", prev, 340, "ok"),
            k("comp_3", "gross_margin", "aggregated", cur, None, "error"),
            k("comp_3", "gross_margin", "aggregated", prev, 41.0, "ok"),
        ]
        return rows

    def _seed_attempts(self) -> list[ReportAttempt]:
        def ra(rid: str, cid: str, area: str, uid: str, at: str, outcome: str, checkpoint: str | None, reason: str | None, report_id: str | None) -> ReportAttempt:
            return ReportAttempt(
                id=rid, company_id=cid, area=area, period_type="monthly",  # type: ignore[arg-type]
                triggered_by_user_id=uid, triggered_at=at, outcome=outcome,  # type: ignore[arg-type]
                last_checkpoint=checkpoint, failure_reason=reason, report_id=report_id,
            )

        return [
            ra("ra_1", "comp_1", "general", "user_1", "2026-06-15T10:00:00Z", "succeeded", "pdf_rendered", None, "rep_1"),
            ra("ra_2", "comp_1", "marketing", "user_1", "2026-06-15T10:05:00Z", "succeeded", "pdf_rendered", None, "rep_2"),
            ra("ra_6", "comp_1", "general", "user_1", "2026-05-15T10:00:00Z", "succeeded", "pdf_rendered", None, "rep_5"),
            ra("ra_3", "comp_2", "general", "user_2", "2026-06-01T09:00:00Z", "succeeded", "pdf_rendered", None, "rep_3"),
            ra("ra_4", "comp_3", "general", "user_3", "2026-06-10T11:00:00Z", "failed", "kpi_validation", "Integration tiendanube requires reauthorization. KPIs net_revenue and total_orders have status=error.", None),
            ra("ra_5", "comp_6", "general", "user_6", "2026-06-20T11:00:00Z", "succeeded", "pdf_rendered", None, "rep_4"),
        ]

    def _seed_reports(self) -> list[Report]:
        def rep(rid: str, cid: str, area: Area, pstart: str, pend: str, gen: str, uid: str, headline: str) -> Report:
            return Report(
                id=rid, company_id=cid, area=area, period_type="monthly",
                period_start=pstart, period_end=pend, generated_at=gen,
                triggered_by_user_id=uid, headline=headline,
                sections=_report_sections(area), action_items=[],
                kpi_snapshot=_snapshot(area), pdf_url=f"/mock/reports/{rid}.pdf",
            )

        return [
            rep("rep_1", "comp_1", Area.general, "2026-06-01", "2026-06-30", "2026-06-15T10:00:00Z", "user_1",
                "June closed up 9.5% to $18,400 in net revenue — Amazon volume did the heavy lifting. Clásico 500g runs out in ~12 days."),
            rep("rep_2", "comp_1", Area.marketing, "2026-06-01", "2026-06-30", "2026-06-15T10:05:00Z", "user_1",
                "Paid efficiency improved — ROAS reached 4.8x and CAC fell to $12.50. Clear room to scale the top Meta campaign."),
            rep("rep_5", "comp_1", Area.general, "2026-05-01", "2026-05-31", "2026-05-15T10:00:00Z", "user_1",
                "May held steady at $16,800 in net revenue with margins in the mid-40s — a stable base heading into June."),
            rep("rep_3", "comp_2", Area.general, "2026-05-01", "2026-05-31", "2026-06-01T09:00:00Z", "user_2",
                "First general report generated during onboarding."),
            rep("rep_4", "comp_6", Area.general, "2026-06-01", "2026-06-30", "2026-06-20T11:00:00Z", "user_6",
                "Luna Cosmetics grew across both channels this period."),
        ]

    def _seed_action_items(self) -> list[ActionItem]:
        def ai(aid: str, rid: str, owner: ActionItemOwner, title: str, desc: str, status: ActionItemStatus, priority: str, done_at: str | None, by: str | None) -> ActionItem:
            return ActionItem(
                id=aid, report_id=rid, company_id="comp_1", owner=owner, title=title,
                description=desc, status=status, priority=priority,  # type: ignore[arg-type]
                completed_at=done_at, completed_by_user_id=by,
            )

        return [
            ai("ai_1", "rep_1", "client", "Restock best-selling Clásico 500g", "Inventory is projected to run out within 12 days at the current sell-through rate.", "pending", "high", None, None),
            ai("ai_2", "rep_1", "northstar", "Negotiate improved Amazon FBA rates", "Current fulfillment costs are eroding margin faster than Tiendanube's.", "in_progress", "medium", None, None),
            ai("ai_3", "rep_1", "client", "Update product photography for the Bombilla line", "Conversion on this listing is trailing the rest of the catalog.", "done", "low", "2026-06-20T15:00:00Z", "user_1"),
            ai("ai_4", "rep_2", "client", "Increase budget on the top-performing Meta campaign", "It is currently under-spending relative to its efficiency.", "pending", "medium", None, None),
            ai("ai_5", "rep_2", "northstar", "Set up retargeting audience segments", "No retargeting is currently running, leaving conversion volume on the table.", "in_progress", "medium", None, None),
            ai("ai_6", "rep_2", "client", "Approve the new ad creative batch", "Current creative has been live for 6+ weeks and is showing early signs of fatigue.", "pending", "low", None, None),
        ]

    def _seed_alerts(self) -> list[Alert]:
        def al(aid: str, cid: str, typ: str, sev: str, msg: str, int_id: str | None, rep_id: str | None, created: str, dismissed: str | None, by: str | None) -> Alert:
            return Alert(
                id=aid, company_id=cid, type=typ, severity=sev, message=msg,  # type: ignore[arg-type]
                related_integration_id=int_id, related_report_id=rep_id,
                created_at=created, dismissed_at=dismissed, dismissed_by_user_id=by,
            )

        return [
            al("al_1", "comp_1", "report_available", "info", "Your Marketing report for June 2026 is ready to view.", None, "rep_2", "2026-06-15T10:05:00Z", None, None),
            al("al_2", "comp_1", "report_available", "info", "Your General report for June 2026 is ready to view.", None, "rep_1", "2026-06-15T10:00:00Z", "2026-06-16T11:00:00Z", "user_1"),
            al("al_3", "comp_3", "token_expiring", "warning", "Your Tiendanube connection needs to be reauthorized to keep KPIs and reports up to date.", "int_6", None, "2026-06-20T08:00:00Z", None, None),
            al("al_4", "comp_3", "report_generation_failed", "warning", "Your last report couldn't be generated because a KPI couldn't be computed correctly.", None, None, "2026-06-10T11:05:00Z", None, None),
            al("al_5", "comp_5", "integration_disconnected", "critical", "Amazon integration for Sportify AR was disconnected on April 30.", "int_7", None, "2026-04-30T06:10:00Z", None, None),
        ]

    def _seed_billing(self) -> list[BillingRecord]:
        def br(bid: str, cid: str, month: str, fee: str, pct: str, revenue: str, status: BillingStatus, by: str | None) -> BillingRecord:
            basis, rate = Decimal(revenue), Decimal(pct)
            return BillingRecord(
                id=bid, company_id=cid, period_month=month,
                platform_fee_amount=Decimal(fee), revenue_share_pct=rate,
                period_revenue=basis,
                revenue_share_amount=(basis * rate / Decimal("100")).quantize(Decimal("0.01")),
                status=status, status_updated_by_staff_id=by,
            )

        return [
            br("br_1", "comp_1", "2026-07", "500", "7.5", "14500", "invoiced", "staff_1"),
            br("br_2", "comp_2", "2026-07", "300", "7.0", "9200", "pending", None),
            br("br_3", "comp_6", "2026-07", "400", "8.0", "17000", "paid", "staff_2"),
            br("br_4", "comp_5", "2026-07", "350", "6.5", "9000", "pending", None),
        ]


def _company(
    cid: str,
    name: str,
    industry: str | None,
    niche: str | None,
    key_products: list[str],
    country: str,
    archetype: str | None,
    status: str,
    join_date: str,
    staff_id: str,
    status_note: str | None = None,
) -> Company:
    return Company(
        id=cid, name=name, industry=industry, niche=niche, key_products=key_products,
        country=country, archetype=archetype, status=status,  # type: ignore[arg-type]
        status_note=status_note, join_date=join_date,
        created_by_staff_id=staff_id,
        created_at=f"{join_date}T10:00:00Z", updated_at=f"{join_date}T10:00:00Z",
    )


def _empty_doc() -> StrategicDoc:
    return StrategicDoc(content=None, updated_at=None, updated_by_staff_id=None)


def _empty_context(company_id: str) -> StrategicContext:
    return StrategicContext(
        company_id=company_id,
        icp_justification=_empty_doc(),
        brand_brief=_empty_doc(),
        brand_icp=_empty_doc(),
        market_research=_empty_doc(),
        product_specifications=_empty_doc(),
        product_documentation=_empty_doc(),
    )


def _current_billing_period_month() -> str:
    now = datetime.now(UTC)
    year, month = (now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12)
    return f"{year:04d}-{month:02d}"


db = Store()
