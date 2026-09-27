# Frontend API contracts

The UI consumes stable domain models from `src/types`. ASP.NET transport DTOs and all field/status conversions live in `src/api/backend`; React components never consume backend DTOs directly.

## Runtime selection

- `VITE_API_MODE=mock` (default) uses the in-memory MVP implementation.
- `VITE_API_MODE=http` uses the Railway ASP.NET API.
- `VITE_API_URL` is the origin only; the client adds `/api/v1`. The default is `https://mvp-action.up.railway.app`.

The checked contract is the supplied OpenAPI document (`v1.json`). Scalar is available at `/scalar` on the backend.

## Backend routes

### Projects and users

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/{id}`
- `PUT /api/v1/projects/{id}`
- `DELETE /api/v1/projects/{id}`
- `GET /api/v1/users`
- `GET /api/v1/users/{id}`

The backend calls the target date `endDate`; frontend domain models call it `targetEndDate`. Project updates are partial in the UI, while the service supplies the already loaded project to the adapter so it can send the full required PUT body without a preliminary GET.

There is no separate backend workspace endpoint. `GET /api/v1/projects/{id}` returns the aggregate `ProjectDetailsDto` (`employees`, `tasks`, `dependencies`, boundary warnings, and project fields), so initial workspace loading uses one project-details request. Project description is currently `''`. Owner names are resolved through the Users API and cached for the browser session.

`GET /api/v1/projects` maps to a lightweight `ProjectNavigationItem` containing only list fields, `taskCount`, and `employeeCount`. Sidebar loading never composes workspaces and therefore always uses one list request regardless of the number of projects. It does not fabricate health, progress, owner, or projected-end values absent from `ProjectListItemDto`.

Project summary fields are read models: projected end is the latest current task end (or the project target for an empty project), progress is the percentage of equally weighted tasks whose status is `Completed`, and health is derived from current conflicts, delayed tasks, and target overrun.

Project deletion returns an empty success response. After it succeeds, the frontend clears project-scoped session analysis and reloads the project list. The mock adapter also removes all project tasks, employees, dependencies, and project session state.

### Employees

- `GET /api/v1/projects/{projectId}/employees`
- `POST /api/v1/projects/{projectId}/employees`
- `PUT /api/v1/projects/{projectId}/employees/{employeeId}`
- `DELETE /api/v1/projects/{projectId}/employees/{employeeId}`

The adapter maps `EmployeeDto` to the project-scoped frontend `Employee`. Before deletion, the frontend blocks employees who still have assigned project tasks; the backend remains the final authority for the DELETE request.

`EmployeeDto` also contains nullable `phone` and `email`. The current name-only UI sends both fields as `null` on create and preserves their current values on update.

### Tasks

- `GET /api/v1/projects/{projectId}/tasks`
- `POST /api/v1/projects/{projectId}/tasks`
- `GET /api/v1/projects/{projectId}/tasks/{taskId}`
- `PUT /api/v1/projects/{projectId}/tasks/{taskId}`
- `DELETE /api/v1/projects/{projectId}/tasks/{taskId}?confirm=true`

Backend `name` maps to frontend `title`. Backend status conversion is explicit:

| Backend | Frontend |
| --- | --- |
| `NotStarted` | `not-started` |
| `InProgress` | `in-progress` |
| `Completed` | `completed` |
| `Delayed` | `delayed` |

`Delayed` maps to the computed UI risk marker; completed tasks never map to current risk. `ProjectTask.isCritical` remains a compatibility field fixed to `false`; criticality comes only from the local critical-path analysis.

The backend does not currently return planned/baseline dates. In HTTP mode, the adapter initializes them from the first task fetch and preserves them in a session-only cache. A newly created task is seeded with its entered dates. A full browser reload starts a new baseline session; persistent planned dates require a future backend contract extension.

Task POST/PUT responses are `TaskMutationResponse`; the adapter unwraps `task` and `analysis`. The confirmed task is upserted into the current workspace and derived presentation state is rebuilt locally, without a project-details refetch. DELETE removes the task and its incident edges locally after REST success.

For a finish-to-start dependency, `PUT` with `status=Completed` is invalid while any direct predecessor is not completed. The frontend validates this before the request for immediate UX, and the ASP.NET backend is expected to enforce the same business rule and return `409 Conflict` with a user-readable message. Starting the task (`InProgress`) remains allowed and produces a consistency warning instead of a blocking error.

### Dependencies

- `POST /api/v1/projects/{projectId}/dependencies`
- `DELETE /api/v1/projects/{projectId}/dependencies/{predecessorId}/{successorId}`

The POST body contains only `predecessorTaskId` and `successorTaskId`; the only MVP dependency type is finish-to-start. Since backend edges have no ID, the adapter creates a deterministic UI ID from the two task IDs. Deletion resolves that ID back to the endpoint coordinates. Backend analysis is retained after both mutations, and the local edge collection is updated without a project-details refetch.

### Explicit schedule shift

- `POST /api/v1/projects/{projectId}/tasks/{taskId}/shift-preview` (no request body)
- `POST /api/v1/projects/{projectId}/tasks/{taskId}/shift-confirm`

The preview route always uses the conflict/source task explicitly selected by the UI. Confirmation sends `{ "confirmProjectEndDate": false }` by default. If the preview changes the project end date, the UI offers a separate explicit confirmation action; only that action sends `{ "confirmProjectEndDate": true }`. After a successful confirmation the confirmed preview updates task dates locally; an explicitly confirmed backend target-date change updates the project target locally. Completed tasks returned with `completedRequiresManualResolution` are displayed as manual-resolution warnings, not silently shifted.

## Realtime project deltas

HTTP mode maintains one session-wide official SignalR client connected to `${VITE_API_URL}/hubs/projects`. It listens for `projectChanged`, joins an opened project through `JoinProject(projectId)`, and leaves it through `LeaveProject(projectId)`. Mock mode never creates a SignalR connection.

Realtime envelopes keep `entity` and `action` as open strings. Known `project`, `task`, `employee`, and dependency changes are applied idempotently to the current workspace; the live Railway hub currently names dependency events `task_dependency`, so the client accepts both that value and the documented `dependency`. `history`/`change_history` updates the separately loaded history cache, and unknown future values are safely ignored. A bounded cache retains the latest 300 `eventId` values to suppress duplicate delivery. Full entity data is used directly. Incomplete task or employee events use their GET-by-id endpoints, while an incomplete dependency event may refresh only the dependency list.

REST remains the mutation confirmation and source of truth: successful responses update the originating tab immediately, and SignalR updates other tabs. Normal events never refetch the full project. After SignalR reconnects, the client rejoins the current project and performs exactly one full project-details resynchronization because events may have been missed while offline. A severely incomplete project event may also use a full project-details GET as an exceptional fallback. Realtime connection or targeted-fetch failures leave the last valid REST workspace usable.

## Local analytics and session state

HTTP mode still uses the pure frontend services for critical path, current unresolved dependency/date conflicts, status consistency, overdue deadlines, project-boundary warnings, risk display, and aggregate metrics. `rebuildWorkspaceDerivedState` reruns those existing services after a confirmed REST mutation or realtime base-entity delta; it introduces no parallel business rules. These services stay behind the workspace adapter and can later be replaced by backend read models without UI changes.

`ImpactAnalysis` exposes both `criticalTaskIds` and `slackDaysByTaskId`. They come from the same single critical-path calculation while the workspace read model is built; React components only present the prepared result and never recalculate CPM.

The adapter stores the latest mutation context per project for the browser session: typed `LastChange`, source task, affected task IDs, backend analysis, and the prior projected end. Initial load uses neutral `session-started` context, not a fabricated task edit. `affectedTaskIds` describes only the latest change; `currentIssues` is recomputed from the complete current graph.

Recovery scenarios remain in domain types for compatibility, but the unimplemented “Как сохранить срок” UI is hidden until a real API/engine is available.

## Project history

- `GET /api/v1/projects/{projectId}/history`
- `POST /api/v1/projects/{projectId}/history/{historyId}/undo`

In HTTP mode the backend is the only history source of truth. History is loaded lazily on the first visit to the tab, cached in memory for the frontend session, sorted newest first, and rendered 50 entries at a time. `ChangeHistoryDto` contains only `id`, `operationType`, `description`, `createdAt`, and `canUndo`; the UI does not invent before/after snapshots absent from the contract. Selective Undo posts the exact selected ID and relies on the backend transaction rather than frontend inverse CRUD. A `404` or `409` refreshes only server history and produces a localized message.

History SignalR events update the in-memory history when they contain a complete DTO; otherwise they trigger only the history GET. Undo entity deltas continue through the normal task/employee/dependency/project realtime handlers. When realtime is unavailable after successful Undo, one full project GET is allowed as a multi-entity synchronization fallback.

Mock mode retains the existing frontend-only `ProjectHistoryStorage`, focused before/after snapshots, and safe inverse operations. Its records stay in `localStorage` but are never merged into HTTP-mode server history.

## Error and browser behavior

`apiRequest` normalizes base/path slashes, accepts empty `200` and `204` responses, and extracts messages from ASP.NET ProblemDetails (`detail`, `message`, `title`, or validation `errors`). Pages surface these messages and do not remain in an endless loading state.

The frontend intentionally has no dev proxy. The Railway API must allow the frontend origin with CORS, including `OPTIONS` preflight for JSON mutation requests. At integration time the live host returned `405` for `OPTIONS /api/v1/projects` and no `Access-Control-Allow-Origin`; browser HTTP mode therefore requires a backend CORS configuration change.
