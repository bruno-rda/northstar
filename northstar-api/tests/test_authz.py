from typing import Any

import pytest
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from store import db
from web import require_company_access, web_api

OWNER = {"X-Mock-User": "user_1"}  # comp_1, every permission but view_marketing
MARKETING_ONLY = {"X-Mock-User": "user_1c"}  # comp_1, view_marketing only
OUTSIDER = {"X-Mock-User": "user_2"}  # no comp_1 membership
STAFF = {"X-Mock-Staff": "staff_1"}


def _calls(dependant: Dependant) -> set[Any]:
    found = {dependant.call}
    for sub in dependant.dependencies:
        found |= _calls(sub)
    return found


@pytest.mark.parametrize(
    "route",
    [r for r in web_api.routes if isinstance(r, APIRoute) and "{company_id}" in r.path],
    ids=lambda r: f"{sorted(r.methods)[0]} {r.path}",
)
def test_every_company_route_checks_membership(route: APIRoute) -> None:
    assert require_company_access in _calls(route.dependant)


def test_missing_mock_header_is_401(client: TestClient) -> None:
    assert client.get("/web/me/memberships").status_code == 401
    assert client.get("/console/companies").status_code == 401


def test_non_member_is_403(client: TestClient) -> None:
    r = client.get("/web/companies/comp_1/integrations", headers=OUTSIDER)
    assert r.status_code == 403


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("post", "/web/companies/comp_1/members", {"email": "x@y.com", "permissions": []}),
        ("patch", "/web/companies/comp_1/members/mem_2", {"permissions": []}),
        ("delete", "/web/companies/comp_1/members/mem_2", None),
        ("post", "/web/companies/comp_1/integrations/amazon/oauth", None),
        ("post", "/web/companies/comp_1/integrations/amazon/oauth/complete", None),
        ("delete", "/web/companies/comp_1/integrations/int_1", None),
        ("post", "/web/companies/comp_1/reports/generate", {"area": "general"}),
    ],
)
def test_writes_require_permission(
    client: TestClient, method: str, path: str, body: dict[str, Any] | None
) -> None:
    r = client.request(method, path, json=body, headers=MARKETING_ONLY)
    assert r.status_code == 403, r.text


def test_area_reads_require_view_permission(client: TestClient) -> None:
    kpis = "/web/companies/comp_1/kpis?period_type=monthly&period_start=2026-06-01&area="
    assert client.get(kpis + "general", headers=MARKETING_ONLY).status_code == 403
    assert client.get(kpis + "marketing", headers=MARKETING_ONLY).status_code == 200
    assert client.get(kpis + "general", headers=OWNER).status_code == 200


def test_report_detail_checks_the_reports_area(client: TestClient) -> None:
    listing = client.get("/web/companies/comp_1/reports?area=general", headers=OWNER).json()
    report_id = listing["items"][0]["id"]
    path = f"/web/companies/comp_1/reports/{report_id}"
    assert client.get(path, headers=OWNER).status_code == 200
    assert client.get(path, headers=MARKETING_ONLY).status_code == 403


def test_member_with_permission_can_write(client: TestClient) -> None:
    r = client.post(
        "/web/companies/comp_1/members",
        json={"email": "new@example.com", "permissions": ["view_general"]},
        headers=OWNER,
    )
    assert r.status_code == 201


def test_page_size_is_bounded(client: TestClient) -> None:
    base = "/web/companies/comp_1/alerts?status=active"
    assert client.get(f"{base}&page_size=101", headers=OWNER).status_code == 422
    assert client.get(f"{base}&page=0", headers=OWNER).status_code == 422


def test_nested_resources_are_scoped_to_their_company(client: TestClient) -> None:
    record = next(b for b in db.billing_records if b.company_id == "comp_1")
    r = client.patch(
        f"/console/companies/comp_2/billing/{record.id}/status",
        json={"status": "invoiced"},
        headers=STAFF,
    )
    assert r.status_code == 404
    missing = client.delete("/web/companies/comp_1/integrations/int_nope", headers=OWNER)
    assert missing.status_code == 404


def test_mock_endpoints_absent_without_northstar_mock(client: TestClient) -> None:
    assert client.post("/__mock/reset").status_code == 404
