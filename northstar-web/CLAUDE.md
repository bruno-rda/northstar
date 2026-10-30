# northstar-web

The client-facing Growth OS app (`/web` surface of northstar-api). React 19 + Vite + TanStack Query + Tailwind v4, with a generated hey-api client.
Product and architecture context: `../northstar-foundation/README.md`.

## Check (run before calling anything done)

```bash
npm run build && npm run lint   # build = gen:api + tsc -b + vite build
```

## API client

- `src/api/` is **generated and gitignored**. Never edit it. Regenerate with `npm run gen:api` from the committed `openapi.json`.
- `openapi.json` is synced from northstar-api (`uv run python scripts/dump_openapi.py` there). If you need a type or field that isn't generated, fix the backend schema; never re-declare it here.
- Mock auth: `src/lib/apiClient.ts` sends `X-Mock-User` (a stub until Firebase Auth lands, D23).

## Rules

- All server state goes through TanStack Query. Queries spread the generated `*Options()` from `@/api/@tanstack/react-query.gen`. Mutations wrap SDK calls in a typed `mutationFn` and invalidate with `invalidateOperations(queryClient, companyId, ['getX', ...])` from `src/lib/queryKeys.ts`. No hand-written query keys, no fetching in `useEffect`, no server data copied into zustand.
- Use generated enums and types (`Object.values(CompanyStatus)`, `ActionItemStatus`, ...). Never hand-list union members.
- Every query-backed view handles **loading, error and empty as three distinct states**. An error must never render as the empty state; use `ErrorState` with a retry.
- Show errors through `getErrorMessage(err)` from `src/lib/errors.ts`. FastAPI 422 `detail` is an array.
- Every mutation has an `onError` toast and invalidates every operation whose answer it changes.
- No KPI aggregation in the frontend. Definitions (`useKpiDefinitions`) and range values (`/kpis/summary`) come from northstar-api. The only comparison math is `movement()` in `src/lib/kpiDefinitions.ts`.
- Date-only strings (`YYYY-MM-DD`) are calendar dates. Format them with `timeZone: 'UTC'` (`formatDate`), never through local `new Date()` math.
- Hiding UI by permission is UX only. northstar-api is the authority.
- Several components and formatters are duplicated in `../northstar-console` (Modal, Pagination, Select, Skeleton, Toasts, ProfileMenu, Badge, Card, formatters). Change both copies together.
- Before adding a dependency, confirm it exists on npm and is the intended package.
- Keep comments minimal.
