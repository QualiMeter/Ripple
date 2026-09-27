# Architecture Notes — Ripple

## Current system

Ripple is an API-first React frontend integrated with an ASP.NET Core backend. The same UI can run against the real REST/SignalR backend or the in-memory mock implementation.

```text
React UI
   ↓
projectService + typed API interfaces
   ↓
REST adapters and DTO mapping  ← source of truth in HTTP mode
   ↕
SignalR projectChanged deltas
   ↓
ASP.NET Core backend
```

The persistence technology of the backend is outside this repository and is not assumed by the frontend.

## Runtime modes

- `VITE_API_MODE=http` — REST confirms mutations and supplies authoritative project/history data; SignalR synchronizes other clients.
- `VITE_API_MODE=mock` — typed API interfaces use the local project store and pure frontend engines. SignalR is not started.

`VITE_API_URL` contains the backend origin. Backend routes and mapping details are documented in [API_CONTRACTS.md](API_CONTRACTS.md).

## Frontend layers

### `types/`

Stable UI-facing domain models: projects, tasks, employees, dependencies, impact analysis and schedule previews.

### `api/`

Typed endpoint interfaces, the shared HTTP client, ASP.NET transport DTOs and mapping. React components never consume backend DTOs directly. Project list loading uses the lightweight list response; opening a project uses one aggregate project-details request.

### `services/`

Application orchestration and pure domain/presentation analysis:

- current schedule, status and deadline issues;
- finish-to-start validation;
- critical tasks and calendar slack;
- affected downstream tasks;
- explicit schedule-shift preview validation;
- workspace derived-state rebuilding;
- mock/local History support.

These calculations are isolated from React and can be replaced by backend read models without changing component contracts.

### `realtime/`

One session-wide official SignalR connection joins only the opened project. Events are deduplicated by `eventId`, serialized through an error-isolated queue and applied as task/employee/dependency/project deltas. Initial connection failures retry with bounded backoff. Reconnect performs one full project resync because events may have been missed.

Complete event payloads are applied without network requests. Incomplete task and employee payloads use targeted GETs; incomplete dependencies may refresh only the dependency list. A full project GET is an exceptional fallback after reconnect or an unrecoverable event application error.

### `components/` and `pages/`

Presentation and interaction only. The project workspace orchestrates Overview, Dependencies, Employees and History. The task editor tracks dirty fields so remote updates do not get overwritten by stale form values.

### `mocks/`

Demo data and stores for autonomous frontend development. UI components do not import mock datasets.

## Core rules

### Finish-to-start

For dependency `A → B`, if `A.endDate = D`, then `B.startDate >= D + 1 calendar day`. Weekends and holidays are intentionally not modeled in the MVP.

Editing a task or dependency never moves other tasks implicitly. The system first analyzes the conflict. Cascading date changes happen only through the explicit preview/confirm schedule-shift flow; completed tasks require manual resolution.

### Criticality and slack

Criticality is derived from current dates and the dependency DAG with a CPM-style backward calculation. Existing gaps between tasks become positive slack. `ProjectTask.isCritical` is retained only for DTO compatibility and is ignored by analytics.

### REST and derived state

REST is the authority for initial loads and mutations. Mutation responses update the local base entities immediately; `rebuildWorkspaceDerivedState` reruns the existing pure analytics without an unnecessary full workspace GET. SignalR makes the update visible in other tabs and clients.

## History and selective Undo

HTTP mode loads project History lazily from the backend and never mixes it with browser-local History. The selected history ID is sent to the transactional selective Undo endpoint. Frontend inverse CRUD is not used in HTTP mode.

After Undo, task/employee/dependency/project SignalR events update affected entities. Duplicate submission is prevented synchronously, and stale `canUndo`, `404`, and `409` states are reconciled against a refreshed History list. If realtime is unavailable after a successful multi-entity Undo, one full project resync is allowed.

Mock mode retains localStorage-backed history and safe frontend inverse operations for supported entries.

## Current scope boundaries

- No authentication or role model in the frontend MVP.
- No working-day calendars, holidays, resource leveling or probabilistic planning.
- Recovery scenario types and the mock heuristic remain for compatibility, but the unimplemented recovery UI is not presented as a product feature.
- Server History details are limited to fields returned by the backend DTO; the UI does not fabricate before/after values.
