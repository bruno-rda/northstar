from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel

# ─── String union types ──────────────────────────────────────────────────────

PlatformScope = Literal["amazon", "tiendanube", "meta_ads", "google_analytics", "aggregated"]
IntegrationStatus = Literal["connected", "needs_reauth", "disconnected", "error"]
PeriodType = Literal["biweekly", "monthly", "quarterly"]
KpiCategory = Literal[
    "orders_transactions",
    "advertising_spend",
    "sessions_funnel",
    "pricing_elasticity",
    "inventory_logistics",
    "reviews",
]
KpiUnit = Literal["currency", "percentage", "count", "ratio", "days"]
ReportOutcome = Literal["succeeded", "failed", "in_progress"]
ReportSectionKey = Literal[
    "executive_brief",
    "portfolio_architecture",
    "top_priorities",
    "ops_health",
    "forecast",
    "marketing_brief",
    "channel_performance",
    "top_marketing_priorities",
    "campaign_health",
]
BillingStatus = Literal["pending", "invoiced", "paid"]
PermissionGroup = Literal["Area visibility", "Reports", "Integrations", "People", "Ownership"]


class Permission(StrEnum):
    """The granular permissions the backend recognizes (RBAC is permissions-only)."""

    view_general = "view_general"
    view_marketing = "view_marketing"
    create_general_report = "create_general_report"
    create_marketing_report = "create_marketing_report"
    manage_integrations = "manage_integrations"
    manage_people = "manage_people"
    manage_billing = "manage_billing"
    transfer_ownership = "transfer_ownership"


class CompanyStatus(StrEnum):
    created = "created"
    onboarding = "onboarding"
    active = "active"
    suspended = "suspended"
    churned = "churned"


class Archetype(StrEnum):
    operador_estancado = "operador_estancado"
    catalizador_digital = "catalizador_digital"


class Provider(StrEnum):
    amazon = "amazon"
    tiendanube = "tiendanube"
    meta_ads = "meta_ads"
    google_analytics = "google_analytics"


class StrategicDocKey(StrEnum):
    icp_justification = "icp_justification"
    brand_brief = "brand_brief"
    brand_icp = "brand_icp"
    market_research = "market_research"
    product_specifications = "product_specifications"
    product_documentation = "product_documentation"


class Area(StrEnum):
    general = "general"
    marketing = "marketing"


class KpiStatus(StrEnum):
    ok = "ok"
    error = "error"
    pending = "pending"
    not_available = "not_available"


class AlertType(StrEnum):
    integration_disconnected = "integration_disconnected"
    token_expiring = "token_expiring"  # noqa: S105  (alert type, not a secret)
    report_available = "report_available"
    report_generation_failed = "report_generation_failed"


class AlertSeverity(StrEnum):
    info = "info"
    warning = "warning"
    critical = "critical"


class ActionItemOwner(StrEnum):
    client = "client"
    northstar = "northstar"


class ActionItemStatus(StrEnum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"


class ActionItemPriority(StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class RevenueRange(StrEnum):
    lt_10k = "lt_10k"
    range_10k_50k = "10k_50k"
    range_50k_200k = "50k_200k"
    range_200k_plus = "200k_plus"
    undisclosed = "undisclosed"


# ─── People ──────────────────────────────────────────────────────────────────


class Staff(BaseModel):
    """Internal NORTHSTAR person (Google Workspace SSO). Was `admin_user`."""

    id: str
    name: str
    email: str


class User(BaseModel):
    """Client-company person (Firebase magic link)."""

    id: str
    name: str
    email: str
    created_at: str


# ─── Company ─────────────────────────────────────────────────────────────────


class Company(BaseModel):
    id: str
    name: str
    industry: str | None
    niche: str | None
    key_products: list[str]
    country: str
    archetype: Archetype | None
    status: CompanyStatus
    status_note: str | None
    join_date: str
    created_by_staff_id: str
    created_at: str
    updated_at: str


# ─── Membership & permissions ────────────────────────────────────────────────


class Membership(BaseModel):
    id: str
    user_id: str
    company_id: str
    permissions: list[Permission]
    created_at: str


class MembershipWithUser(Membership):
    user: User


class PermissionDefinition(BaseModel):
    key: Permission
    label: str
    group: PermissionGroup


# ─── Integrations ────────────────────────────────────────────────────────────


class IntegrationConnection(BaseModel):
    id: str
    company_id: str
    provider: Provider
    status: IntegrationStatus
    connected_by_user_id: str
    connected_at: str
    last_sync_at: str | None
    last_successful_sync_at: str | None


# ─── KPIs ────────────────────────────────────────────────────────────────────


class KpiAggregation(BaseModel):
    """How a metric composes over a multi-period range (D7).

    `sum` for flow metrics. `weighted` for ratios: weighted by their own denominator (`by`),
    which makes the result the ratio of the summed terms. There is deliberately no mean.
    """

    method: Literal["sum", "weighted"]
    by: str | None = None


class KpiDefinition(BaseModel):
    key: str
    label: str
    unit: KpiUnit
    area: Area
    higher_is_better: bool
    aggregation: KpiAggregation


class KpiRangeValue(BaseModel):
    kpi_key: str
    platform_scope: PlatformScope
    value: float | None


class KpiValue(BaseModel):
    id: str
    company_id: str
    kpi_key: str
    platform_scope: PlatformScope
    period_type: PeriodType
    period_start: str
    period_end: str
    value: float | None
    status: KpiStatus
    computed_at: str | None


class KpiSnapshotItem(BaseModel):
    kpi_key: str
    platform_scope: str
    value: float | None


# ─── Reports & action items ──────────────────────────────────────────────────


class ReportSection(BaseModel):
    key: ReportSectionKey
    title: str
    content: str


class ActionItem(BaseModel):
    id: str
    report_id: str
    company_id: str
    owner: ActionItemOwner
    title: str
    description: str
    status: ActionItemStatus
    priority: ActionItemPriority
    completed_at: str | None
    completed_by_user_id: str | None


class Report(BaseModel):
    id: str
    company_id: str
    area: Area
    period_type: PeriodType
    period_start: str
    period_end: str
    generated_at: str
    triggered_by_user_id: str
    # Single-sentence state-of-the-business read for the dashboard. The console
    # simply ignores this field; it is the superset entity for both surfaces.
    headline: str
    sections: list[ReportSection]
    action_items: list[ActionItem]
    kpi_snapshot: list[KpiSnapshotItem]
    pdf_url: str


class ReportSummary(BaseModel):
    id: str
    company_id: str
    area: Area
    period_type: PeriodType
    period_start: str
    period_end: str
    generated_at: str
    kpi_snapshot: list[KpiSnapshotItem]
    headline: str


class ReportAttempt(BaseModel):
    id: str
    company_id: str
    area: Area
    period_type: PeriodType
    triggered_by_user_id: str
    triggered_at: str
    outcome: ReportOutcome
    last_checkpoint: str | None
    failure_reason: str | None
    report_id: str | None


# ─── Alerts & notifications ──────────────────────────────────────────────────


class Alert(BaseModel):
    id: str
    company_id: str
    type: AlertType
    severity: AlertSeverity
    message: str
    related_integration_id: str | None
    related_report_id: str | None
    created_at: str
    dismissed_at: str | None
    dismissed_by_user_id: str | None


class NotificationPreference(BaseModel):
    user_id: str
    alert_type: AlertType
    in_app_enabled: bool
    email_enabled: bool


# ─── Strategic context (console) ─────────────────────────────────────────────


class StrategicDoc(BaseModel):
    content: str | None
    updated_at: str | None
    updated_by_staff_id: str | None


class StrategicContext(BaseModel):
    company_id: str
    icp_justification: StrategicDoc
    brand_brief: StrategicDoc
    brand_icp: StrategicDoc
    market_research: StrategicDoc
    product_specifications: StrategicDoc
    product_documentation: StrategicDoc


# ─── Billing (console) ───────────────────────────────────────────────────────


class BillingRecord(BaseModel):
    id: str
    company_id: str
    period_month: str
    platform_fee_amount: Decimal
    revenue_share_pct: Decimal
    period_revenue: Decimal
    revenue_share_amount: Decimal
    status: BillingStatus
    status_updated_by_staff_id: str | None


class CompanyBillingConfig(BaseModel):
    company_id: str
    platform_fee_amount: Decimal
    revenue_share_pct: Decimal


# ─── Access requests (public lead capture, web) ──────────────────────────────


class AccessRequest(BaseModel):
    id: str
    name: str
    email: str
    company_name: str
    country: str | None
    website: str | None
    monthly_revenue: RevenueRange | None
    note: str | None
    created_at: str


# ─── Dashboard view models (web) ─────────────────────────────────────────────


class ProductContribution(BaseModel):
    product_id: str
    product_name: str
    revenue: float
    order_count: int
    platform_scope: PlatformScope


class DailySalesPoint(BaseModel):
    date: str
    revenue: float
    order_count: int
    platform_scope: PlatformScope


# ─── Pagination envelope ─────────────────────────────────────────────────────


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


# ─── Request / response payloads (shared by both surfaces) ───────────────────


class MemberCreate(BaseModel):
    email: str
    name: str | None = None
    permissions: list[Permission]


class MemberAccessUpdate(BaseModel):
    permissions: list[Permission]


class ReportGenerateRequest(BaseModel):
    area: Area


class NotificationPreferenceUpdate(BaseModel):
    alert_type: AlertType
    in_app_enabled: bool
    email_enabled: bool


class OAuthRedirect(BaseModel):
    redirect_url: str


class ReportEligibility(BaseModel):
    eligible: bool
    blocking_reason: str | None


def paginate[T](items: list[T], page: int, page_size: int) -> PaginatedResponse[T]:
    start = (page - 1) * page_size
    return PaginatedResponse(
        items=items[start : start + page_size],
        total=len(items),
        page=page,
        page_size=page_size,
    )
