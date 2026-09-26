# Frontend API contracts

The frontend currently runs in `mock` mode and preserves the same UI-facing contract intended for the future ASP.NET Core API.

## Runtime selection

- `VITE_API_MODE=mock` (default): dynamically loads the in-memory mock implementation.
- `VITE_API_MODE=http`: sends REST requests to `VITE_API_URL`.

React components only use `projectService`; they do not import seed data, API transport, or schedule rules.

## Workspace read model

`GET /api/projects/{projectId}/workspace`

Returns one `ProjectWorkspace` containing:

- `project`: summary, dates, health, progress;
- `tasks`: typed task records;
- `dependencies`: finish-to-start edges;
- `assignees`: people referenced by tasks;
- `impact`: current impact analysis;
- `recoveryScenarios`: deadline recovery candidates.

The combined workspace route is a frontend read-model proposal. The final ASP.NET API may expose separate endpoints; mapping/composition must remain inside `api/` or `services/`.

## Draft mutation and analysis routes

- `PATCH /api/tasks/{taskId}`
- `POST /api/projects/{projectId}/tasks`
- `DELETE /api/tasks/{taskId}`
- `POST /api/projects/{projectId}/dependencies`
- `DELETE /api/dependencies/{dependencyId}`
- `POST /api/projects/{projectId}/recalculate`
- `GET /api/projects/{projectId}/recovery-scenarios`

### Task update flow

`PATCH /api/tasks/{taskId}` accepts a partial `TaskUpdateRequest` with `title`, `startDate`, `endDate`, `durationDays`, `assigneeId`, and `status`, and returns the updated task.

The frontend then reloads `GET /api/projects/{projectId}/workspace` so the UI receives a single consistent read model containing recalculated tasks, project dates, and impact analysis. In mock mode the same sequence is preserved: `TasksApi` updates the in-memory store, `scheduleEngine` propagates finish-to-start shifts, and `ProjectsApi` rebuilds the workspace. The React layer does not invoke schedule calculations directly.

Mock schedule recalculation keeps immutable planned dates (`plannedStartDate` and `plannedEndDate`) separate from user overrides and derived dates. Every update rebuilds the dependency graph from that baseline, allowing both delay propagation and recovery. `ImpactAnalysis.affectedTaskIds` describes tasks whose dates changed because of the latest update; it is independent from persistent task `riskState`.

`POST /api/projects/{projectId}/tasks` accepts `TaskCreateRequest` with `title`, `startDate`, `endDate`, optional `durationDays`, `assigneeId`, and `status`. It returns the created task. The entered dates become both its current and immutable planned dates.

`DELETE /api/tasks/{taskId}` returns `204 No Content`. The backend must remove every dependency whose predecessor or successor is the deleted task before recalculating and returning the next workspace read model.

Completed tasks represent recorded work: schedule propagation must not move them, and they cannot be returned as current `at-risk` tasks.

### Last change context

`ImpactAnalysis.lastChange` is a typed discriminated union. It distinguishes task field updates, task creation/deletion, and dependency creation/deletion. Task updates contain only fields whose values actually changed, including dates, duration, status, and assignee. This context describes the user action; `affectedTaskIds`, deadline fields, and reasons describe its calculated consequences separately.

`previousProjectEndDate` and `projectEndChangeDays` compare the forecast immediately before and after the latest mutation. `deadlineShiftDays` remains the current deviation from the project's target date; these values must not be conflated when a non-schedule edit occurs on an already delayed project.

### Dependency mutation flow

`POST /api/projects/{projectId}/dependencies` accepts a `CreateDependencyRequest` with `predecessorTaskId`, `successorTaskId`, and `type`. The MVP accepts only `finish-to-start` and returns the created `Dependency`.

`DELETE /api/dependencies/{dependencyId}` removes one edge and returns `204 No Content`. Both mutations are followed by a workspace reload. In mock mode, `DependenciesApi` validates and updates the in-memory graph, then the service layer rebuilds the schedule and impact analysis before `ProjectsApi` returns the new workspace.

The domain validation rejects self-dependencies, duplicate edges, and any edge that would create a directed cycle. The HTTP backend must enforce the same invariants and return a structured validation error whose message can be shown to the user.

TypeScript contracts live in `src/types/`. Once Swagger is available, generated backend DTOs should be mapped to these stable UI-facing models rather than imported throughout presentation components.
