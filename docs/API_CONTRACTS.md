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
- `currentIssues`: unresolved schedule conflicts recomputed from the complete current graph;
- `recoveryScenarios`: deadline recovery candidates.

The combined workspace route is a frontend read-model proposal. The final ASP.NET API may expose separate endpoints; mapping/composition must remain inside `api/` or `services/`.

## Draft mutation and analysis routes

- `PATCH /api/tasks/{taskId}`
- `POST /api/projects/{projectId}/tasks`
- `DELETE /api/tasks/{taskId}`
- `POST /api/projects/{projectId}/dependencies`
- `DELETE /api/dependencies/{dependencyId}`
- `POST /api/projects/{projectId}/impact/analyze`
- `POST /api/projects/{projectId}/schedule-shift/preview`
- `POST /api/projects/{projectId}/schedule-shift/apply`
- `GET /api/projects/{projectId}/recovery-scenarios`

### Task update flow

`PATCH /api/tasks/{taskId}` accepts a partial `TaskUpdateRequest` with `title`, `startDate`, `endDate`, `assigneeId`, and `status`, and returns the updated task. Duration is derived from the two dates and is not an editable MVP field.

The frontend then reloads `GET /api/projects/{projectId}/workspace` so the UI receives a single consistent read model containing the saved task, project dates, warnings, and impact analysis. An ordinary mutation never changes any other task dates. Assignee changes do not run schedule analysis.

`ImpactAnalysis.affectedTaskIds` describes the downstream tasks considered by the latest analysis; it is independent from persistent task `riskState`. Conflicting finish-to-start dates are returned as reasons, without silently correcting the schedule.

`CurrentProjectIssues` is a separate computed read model. Its `scheduleConflicts` and `affectedTaskIds` describe unresolved problems in the complete current graph, not only consequences of the latest mutation. Creating an unrelated task can produce an empty last-change impact while existing current issues remain visible.

Each analysis reason is a structured result with `severity` (`info`, `warning`, or `error`), `sourceTaskId`, `affectedTaskIds`, `reason`, `consequence`, and an optional action (`open-task` or `preview-shift`). Status analysis uses the same result model:

- completing a task reports immediately available successors when all their predecessors are complete and distinguishes whether their planned start date has arrived;
- delaying a task warns its unfinished direct successors without changing or stopping them;
- starting a task reports unfinished predecessors;
- reopening a completed task warns its unfinished direct successors.

Completed tasks are immutable for automatic schedule shifts. A finish-to-start/date conflict involving a completed task remains visible as a manual-resolution warning.

`POST /api/projects/{projectId}/tasks` accepts `TaskCreateRequest` with `title`, `startDate`, `endDate`, `assigneeId`, and `status`. It returns the created task. The entered dates become both its current and immutable planned dates.

`DELETE /api/tasks/{taskId}` returns `204 No Content`. The backend must remove every dependency whose predecessor or successor is the deleted task, analyze the remaining graph, and leave every remaining task date unchanged.

Completed tasks represent recorded work: schedule propagation must not move them, and they cannot be returned as current `at-risk` tasks.

### Last change context

`ImpactAnalysis.lastChange` is a typed discriminated union. It distinguishes task field updates, task creation/deletion, dependency creation/deletion, and a confirmed automatic schedule shift. Task updates contain only fields whose values actually changed, including dates, status, and assignee. This context describes the user action; `affectedTaskIds`, deadline fields, and reasons describe its calculated consequences separately.

`previousProjectEndDate` and `projectEndChangeDays` compare the forecast immediately before and after the latest mutation. `deadlineShiftDays` remains the current deviation from the project's target date; these values must not be conflated when a non-schedule edit occurs on an already delayed project.

### Dependency mutation flow

`POST /api/projects/{projectId}/dependencies` accepts a `CreateDependencyRequest` with `predecessorTaskId`, `successorTaskId`, and `type`. The MVP accepts only `finish-to-start` and returns the created `Dependency`.

`DELETE /api/dependencies/{dependencyId}` removes one edge and returns `204 No Content`. Both mutations are followed by a workspace reload and impact analysis. They never change task dates automatically. A conflicting new edge is reported as a warning and may be resolved through the explicit shift flow.

### Explicit schedule shift flow

`POST /api/projects/{projectId}/schedule-shift/preview` accepts `ScheduleShiftPreviewRequest` with an explicit `sourceTaskId` and performs a non-mutating finish-to-start calculation from that source in the current graph. It must not infer the source from the latest workspace mutation. It returns `ScheduleShiftPreview` with current and proposed dates, calendar-day shifts for each affected task, and current/proposed project finish dates. Weekends and holidays are not special cases. Completed tasks are never proposed for movement.

`POST /api/projects/{projectId}/schedule-shift/apply` accepts the preview and applies it only after user confirmation. The backend should validate that the preview still matches current project state and reject stale input. Canceling the preview performs no write.

MVP task statuses are `not-started` (Не в работе), `in-progress` (В работе), `completed` (Закончено), and `delayed` (Задерживается). `delayed` is a manual status and is not equivalent to computed `riskState`.

The domain validation rejects self-dependencies, duplicate edges, and any edge that would create a directed cycle. The HTTP backend must enforce the same invariants and return a structured validation error whose message can be shown to the user.

Before graph validation, both dependency endpoints must verify that the predecessor and successor exist and belong to the project named in the route. Cross-project and missing-task references are rejected. The task edit panel and dependency graph both call the same `DependenciesApi`; neither mutates the workspace directly.

TypeScript contracts live in `src/types/`. Once Swagger is available, generated backend DTOs should be mapped to these stable UI-facing models rather than imported throughout presentation components.
