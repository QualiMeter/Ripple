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
- `DELETE /api/tasks/{taskId}`
- `POST /api/projects/{projectId}/recalculate`
- `GET /api/projects/{projectId}/recovery-scenarios`

### Task update flow

`PATCH /api/tasks/{taskId}` accepts a partial `TaskUpdateRequest` with `title`, `startDate`, `endDate`, `durationDays`, `assigneeId`, and `status`, and returns the updated task.

The frontend then reloads `GET /api/projects/{projectId}/workspace` so the UI receives a single consistent read model containing recalculated tasks, project dates, and impact analysis. In mock mode the same sequence is preserved: `TasksApi` updates the in-memory store, `scheduleEngine` propagates finish-to-start shifts, and `ProjectsApi` rebuilds the workspace. The React layer does not invoke schedule calculations directly.

Mock schedule recalculation keeps immutable planned dates (`plannedStartDate` and `plannedEndDate`) separate from user overrides and derived dates. Every update rebuilds the dependency graph from that baseline, allowing both delay propagation and recovery. `ImpactAnalysis.affectedTaskIds` describes tasks whose dates changed because of the latest update; it is independent from persistent task `riskState`.

TypeScript contracts live in `src/types/`. Once Swagger is available, generated backend DTOs should be mapped to these stable UI-facing models rather than imported throughout presentation components.
