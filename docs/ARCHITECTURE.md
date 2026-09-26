# Architecture Notes — Ripple

## Locked stack assumptions
Frontend:
- React
- Vite
- TypeScript

Backend:
- C# ASP.NET Core
- REST API
- OpenAPI / Swagger expected for integration

The backend is developed separately and may not be available during early frontend work.

## Frontend architecture principle
Build API-first.

UI components must not depend directly on mock datasets.
All data access goes through typed API/service abstractions.

Current:
`UI -> API/service abstraction -> mocks/local calculation`

Later:
`UI -> API client -> ASP.NET Core REST API`

This should allow switching from mocks to the real backend without rewriting pages/components.

## Core domain entities

### Project
- id
- name
- startDate
- targetEndDate
- projectedEndDate

### Task
- id
- projectId
- title
- startDate
- endDate or duration
- assigneeId
- status
- riskState
- isCritical (legacy DTO compatibility only; analytics must not read it)

### Dependency
- id
- predecessorTaskId
- successorTaskId
- type (MVP can start with finish-to-start)

### Assignee
- id
- name
- role
- optional availability/capacity fields

### ChangeEvent
Useful for impact comparison:
- id
- projectId
- taskId
- field
- oldValue
- newValue
- createdAt

### ImpactAnalysis
Recommended response model:
- affectedTaskIds
- criticalTaskIds
- atRiskTaskIds
- previousProjectEndDate
- projectedProjectEndDate
- deadlineShiftDays
- requiresIntervention
- optional explanations/reasons

`criticalTaskIds` is computed from current task dates and finish-to-start dependencies with a CPM-style backward pass. The current latest task end is the project end for this analysis. Existing calendar gaps become positive slack; all tasks with `slackDays <= 0` are critical. The mutable legacy `Task.isCritical` field is ignored.

## Frontend layers

### `types/`
Domain and API-facing TypeScript types.

### `api/`
HTTP client and endpoint functions.
Use `VITE_API_URL` as backend base URL.

### `mocks/`
Demo data only.
No UI component should import mock datasets directly.

### `services/`
Temporary frontend-side business logic such as schedule recalculation while backend is unavailable.

### `components/` and `pages/`
Presentation and user interaction.
No persistence or network implementation details here.

## Service boundaries

### Project service
CRUD projects and tasks.

### Dependency service
Validate and manage task graph.
Reject cycles.

### Schedule engine
For the frontend MVP, this may temporarily run client-side.

Input:
- project
- tasks
- dependencies

Output:
- recalculated dates
- impacted task ids
- projected project end
- critical tasks
- risk states

When backend support is ready, replace this calculation path with the ASP.NET impact endpoint while keeping the UI contract stable.

### Recovery engine
Input: recalculated project state.
Output: candidate recovery scenarios with expected impact.

This may also begin client-side and later move to the backend.

## Suggested API contract
Exact routes may change once backend Swagger/OpenAPI is available.

- GET /api/projects
- POST /api/projects
- GET /api/projects/{id}
- PATCH /api/projects/{id}
- POST /api/projects/{id}/tasks
- PATCH /api/tasks/{id}
- DELETE /api/tasks/{id}
- POST /api/projects/{id}/dependencies
- DELETE /api/dependencies/{id}
- POST /api/projects/{id}/recalculate
- GET /api/projects/{id}/impact
- GET /api/projects/{id}/recovery-scenarios

## Integration rule
When the backend publishes OpenAPI/Swagger:
1. compare real endpoints and DTOs with this draft;
2. update the API layer/mappers;
3. keep UI-facing models stable where practical;
4. do not spread backend-specific DTO differences across React components.
