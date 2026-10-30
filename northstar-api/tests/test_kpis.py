from fastapi.testclient import TestClient

from kpis import aggregate
from models import KpiStatus, KpiValue
from store import db

OWNER = {"X-Mock-User": "user_renata"}  # comp_1, both areas


def _rows(start: str = "2026-01-01", end: str = "2026-06-30") -> list[KpiValue]:
    return db.get_kpi_values(
        "comp_1",
        period_type="monthly",
        period_start=start,
        period_start_to=end,
        platform_scope=None,
    )


def _ok(rows: list[KpiValue], key: str, scope: str = "aggregated") -> dict[str, float]:
    return {
        r.period_start: r.value
        for r in rows
        if r.kpi_key == key and r.platform_scope == scope and r.status == "ok" and r.value
    }


def test_ratio_over_range_is_weighted_never_a_mean() -> None:
    rows = _rows()
    roas, spend = _ok(rows, "roas"), _ok(rows, "ad_spend")
    exact = sum(roas[p] * spend[p] for p in roas) / sum(spend[p] for p in roas)
    mean = sum(roas.values()) / len(roas)

    result = aggregate(rows, "roas", "aggregated")

    assert result == round(exact, 1)
    assert result != round(mean + 1e-9, 1)  # the seed is uneven enough that the two diverge


def test_additive_metrics_sum_at_the_requested_scope() -> None:
    rows = _rows()
    assert aggregate(rows, "net_revenue", "amazon") == sum(
        _ok(rows, "net_revenue", "amazon").values()
    )
    assert aggregate(rows, "net_revenue", "amazon") != aggregate(rows, "net_revenue", "aggregated")


def test_ratio_ignores_platform_scope() -> None:
    rows = _rows()
    assert aggregate(rows, "gross_margin", "amazon") == aggregate(
        rows, "gross_margin", "aggregated"
    )


def _kpi(key: str, period: str, value: float) -> KpiValue:
    return KpiValue(
        id=f"{key}-{period}",
        company_id="c",
        kpi_key=key,
        platform_scope="aggregated",
        period_type="monthly",
        period_start=period,
        period_end=period,
        value=value,
        status=KpiStatus.ok,
        computed_at=None,
    )


def test_missing_weight_for_any_period_is_none() -> None:
    rows = [
        _kpi("roas", "2026-01-01", 4.0),
        _kpi("roas", "2026-02-01", 6.0),
        _kpi("ad_spend", "2026-01-01", 100),
    ]
    assert aggregate(rows, "roas", "aggregated") is None


def test_no_data_is_none() -> None:
    assert aggregate([], "net_revenue", "aggregated") is None
    assert aggregate([], "roas", "aggregated") is None


def test_summary_endpoint_matches_aggregate(client: TestClient) -> None:
    r = client.get(
        "/web/companies/comp_1/kpis/summary",
        params={"area": "marketing", "period_start": "2026-01-01", "period_end": "2026-06-30"},
        headers=OWNER,
    )
    assert r.status_code == 200
    by_key = {v["kpi_key"]: v["value"] for v in r.json()}
    assert by_key["roas"] == aggregate(_rows(), "roas", "aggregated")
    assert "net_revenue" not in by_key


def test_kpi_values_are_filtered_by_area(client: TestClient) -> None:
    r = client.get(
        "/web/companies/comp_1/kpis",
        params={"area": "general", "period_type": "monthly", "period_start": "2026-06-01"},
        headers=OWNER,
    )
    keys = {v["kpi_key"] for v in r.json()}
    assert keys == {"net_revenue", "total_orders", "gross_margin"}
