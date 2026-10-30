# northstar-api

FastAPI backend for both frontends. Mounts two sub-apps: `/console` (staff, `console.py`) and `/web` (client users, `web.py`). Each emits its own OpenAPI spec that a frontend generates its client from.
Product and architecture context: `../northstar-foundation/README.md`. Reference architecture decisions by ID (`D7`, `invariant 07`).

## Check (run before calling anything done)

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest
```

## Files

- `models.py`: Pydantic models, the single source of truth for the wire contract.
- `kpis.py`: KPI definitions and range aggregation, the methodology. KPI math lives only here, never in a frontend.
- `store.py`: **throwaway** in-memory mock store and seed. Storage only; don't add domain logic here.
- `web.py` / `console.py`: thin routes plus surface-specific DTOs.
- `openapi/*.json`: committed specs. After any route or model change, run `uv run python scripts/dump_openapi.py`. A test fails if they're stale.

## Rules

- **Authorization is server-side.** Every `/companies/{company_id}` route on `/web` depends on `require_company_access`. Writes and area-scoped reads also depend on `require_permission(...)`. A test walks the routes and enforces the first.
- Look nested resources up by `(company_id, id)`, never by `id` alone (BOLA).
- Input DTOs are separate from output models. Updates whitelist their fields via `model_dump(exclude_unset=True)` on a dedicated schema.
- Money is `Decimal`, never float (D46). KPI and chart values stay `float`.
- Ratios over a range are the weighted ratio of summed terms, never a mean of per-period values (D7). A missing weight gives `None`.
- Routes stay sync `def` until a real DB lands. When it does, go fully async or fully sync; never block inside `async def`.
- Bound pagination (`page >= 1`, `1 <= page_size <= 100`) and type query params with enums or `Literal`, not bare `str`.
- Mock-only behaviour (`X-Mock-Fail`, latency, `/__mock/reset`) exists only when `NORTHSTAR_MOCK=1`.
- Before adding a dependency, confirm it exists on PyPI and is the intended package.
- Keep comments minimal.
