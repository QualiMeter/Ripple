# Architecture Notes — Ripple

This document is intentionally stack-neutral until the team locks the implementation stack.

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
- isCritical

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

## Service boundaries

### Project service
CRUD projects and tasks.

### Dependency service
Validate and manage task graph.
Reject cycles.

### Schedule engine
Pure/domain service.
Input: project + tasks + dependencies.
Output:
- recalculated dates;
- impacted task ids;
- projected project end;
- critical tasks;
- risk states.

### Recovery engine
Input: recalculated project state.
Output: candidate recovery scenarios with expected impact.

## Important technical constraint
Keep the schedule engine independent from the UI and persistence layer.
It should be testable with plain objects.

## API sketch
- GET /projects
- POST /projects
- GET /projects/:id
- PATCH /projects/:id
- POST /projects/:id/tasks
- PATCH /tasks/:id
- DELETE /tasks/:id
- POST /projects/:id/dependencies
- DELETE /dependencies/:id
- POST /projects/:id/recalculate
- GET /projects/:id/impact
- GET /projects/:id/recovery-scenarios

The exact API can be changed once the stack and current repository are known.
