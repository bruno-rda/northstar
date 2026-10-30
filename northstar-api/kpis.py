"""KPI definitions and range aggregation: the methodology. The seed of step 03's registry."""

import math
from collections.abc import Sequence

from models import Area, KpiAggregation, KpiDefinition, KpiStatus, KpiUnit, KpiValue, PlatformScope

SUM = KpiAggregation(method="sum")


def _weighted(by: str) -> KpiAggregation:
    return KpiAggregation(method="weighted", by=by)


def _define(
    key: str, label: str, unit: KpiUnit, area: Area, higher_is_better: bool, agg: KpiAggregation
) -> KpiDefinition:
    return KpiDefinition(
        key=key,
        label=label,
        unit=unit,
        area=area,
        higher_is_better=higher_is_better,
        aggregation=agg,
    )


KPI_DEFINITIONS: dict[str, KpiDefinition] = {
    d.key: d
    for d in [
        _define("net_revenue", "Total Sales", "currency", Area.general, True, SUM),
        _define("total_orders", "Total Orders", "count", Area.general, True, SUM),
        _define(
            "gross_margin", "Margin", "percentage", Area.general, True, _weighted("net_revenue")
        ),
        _define("ad_spend", "Ad Spend", "currency", Area.marketing, False, SUM),
        _define("new_customers", "New Customers", "count", Area.marketing, True, SUM),
        _define("sessions", "Sessions", "count", Area.marketing, True, SUM),
        _define(
            "roas", "Return on Ads Spend", "ratio", Area.marketing, True, _weighted("ad_spend")
        ),
        _define(
            "cac",
            "Customer Acquisition Cost",
            "currency",
            Area.marketing,
            False,
            _weighted("new_customers"),
        ),
        _define(
            "cvr", "Conversion Rate", "percentage", Area.marketing, True, _weighted("sessions")
        ),
    ]
}


def in_area(kpi_key: str, area: Area) -> bool:
    definition = KPI_DEFINITIONS.get(kpi_key)
    return definition is not None and definition.area == area


def _round_half_up(value: float, digits: int) -> float:
    # Matches the JavaScript Math.round the dashboard used, so numbers don't shift in the move.
    factor = 10.0**digits
    return math.floor(value * factor + 0.5) / factor


def _ok(rows: Sequence[KpiValue], kpi_key: str, scope: str) -> dict[str, float]:
    return {
        r.period_start: r.value
        for r in rows
        if r.kpi_key == kpi_key
        and r.platform_scope == scope
        and r.status == KpiStatus.ok
        and r.value is not None
    }


def aggregate(
    rows: Sequence[KpiValue], kpi_key: str, platform_scope: PlatformScope
) -> float | None:
    """A KPI over every period in `rows`, or None when there is no honest answer.

    Additive metrics sum at the requested scope. Ratios only exist at aggregated scope and are
    weighted by their denominator for the same period; if any period lacks that weight the
    result is None, never a plausible-looking partial.
    """
    definition = KPI_DEFINITIONS[kpi_key]
    agg = definition.aggregation
    if agg.method == "sum":
        values = _ok(rows, kpi_key, platform_scope)
        return _round_half_up(sum(values.values()), 0) if values else None

    if agg.by is None:
        raise ValueError(f"{kpi_key}: weighted aggregation needs a denominator")
    rates = _ok(rows, kpi_key, "aggregated")
    weights = _ok(rows, agg.by, "aggregated")
    if not rates or any(period not in weights for period in rates):
        return None
    total_weight = sum(weights[period] for period in rates)
    if total_weight <= 0:
        return None
    weighted = sum(rate * weights[period] for period, rate in rates.items())
    return _round_half_up(weighted / total_weight, 1)
