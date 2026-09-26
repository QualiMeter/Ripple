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
- `GET /api/v1/users`
- `GET /api/v1/users/{id}`

The backend calls the target date `endDate`; frontend domain models call it `targetEndDate`. Project updates are partial in the UI, but the adapter fetches the current project and sends the full required PUT body.

There is no backend workspace endpoint. `ProjectWorkspace` is composed in the adapter from `ProjectDetailsDto` (`employees`, `tasks`, `dependencies`, and project fields) plus local replaceable analytics. Project description is currently `''`. Owner names are resolved through the Users API and cached for the browser session.

Project summary fields are read models: projected end is the latest current task end (or the project target for an empty project), progress is the average of task progress (`Completed = 100`, other statuses `0`), and health is derived from current conflicts, delayed tasks, and target overrun.

### Employees

- `GET /api/v1/projects/{projectId}/employees`
- `POST /api/v1/projects/{projectId}/employees`
- `PUT /api/v1/projects/{projectId}/employees/{employeeId}`

The adapter maps `EmployeeDto` to the project-scoped frontend `Employee`. The MVP does not expose employee deletion.

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

Task POST/PUT responses are `TaskMutationResponse`; the adapter unwraps `task` and retains `analysis` as the latest session change context.

### Dependencies

- `POST /api/v1/projects/{projectId}/dependencies`
- `DELETE /api/v1/projects/{projectId}/dependencies/{predecessorId}/{successorId}`

The POST body contains only `predecessorTaskId` and `successorTaskId`; the only MVP dependency type is finish-to-start. Since backend edges have no ID, the adapter creates a deterministic UI ID from the two task IDs. Deletion resolves that ID back to the endpoint coordinates. Backend analysis is retained after both mutations.

### Explicit schedule shift

- `POST /api/v1/projects/{projectId}/tasks/{taskId}/shift-preview` (no request body)
- `POST /api/v1/projects/{projectId}/tasks/{taskId}/shift-confirm`

The preview route always uses the conflict/source task explicitly selected by the UI. Confirmation sends `{ "confirmProjectEndDate": false }`. Completed tasks returned with `completedRequiresManualResolution` are displayed as manual-resolution warnings, not silently shifted.

## Local analytics and session state

HTTP mode still uses the pure frontend services for critical path, current unresolved dependency/date conflicts, project-boundary warnings, risk display, and aggregate metrics. These stay behind the workspace adapter and can later be replaced by backend read models without UI changes.

The adapter stores the latest mutation context per project for the browser session: typed `LastChange`, source task, affected task IDs, backend analysis, and the prior projected end. Initial load uses neutral `session-started` context, not a fabricated task edit. `affectedTaskIds` describes only the latest change; `currentIssues` is recomputed from the complete current graph.

Recovery scenarios remain in domain types for compatibility, but the unimplemented “Как сохранить срок” UI is hidden until a real API/engine is available.

## Error and browser behavior

`apiRequest` normalizes base/path slashes, accepts empty `200` and `204` responses, and extracts messages from ASP.NET ProblemDetails (`detail`, `message`, `title`, or validation `errors`). Pages surface these messages and do not remain in an endless loading state.

The frontend intentionally has no dev proxy. The Railway API must allow the frontend origin with CORS, including `OPTIONS` preflight for JSON mutation requests. At integration time the live host returned `405` for `OPTIONS /api/v1/projects` and no `Access-Control-Allow-Origin`; browser HTTP mode therefore requires a backend CORS configuration change.
