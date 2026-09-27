# MVP Plan — Ripple

This document records the current status of the hackathon MVP. Product behavior is described in [README.md](../README.md), the presentation flow in [DEMO.md](DEMO.md), and transport details in [API_CONTRACTS.md](API_CONTRACTS.md).

## Demo story

Use a project with at least eight tasks, multiple employees and a dependency chain such as:

```text
Требования → UX → API аналитики → Интеграция интерфейса → QA → Релиз
```

The key demo moment is an explicit task-date change followed by impact analysis, schedule-shift preview, realtime synchronization and selective History Undo. Ordinary edits only save user-entered values; they do not silently shift downstream tasks.

## Current MVP status

### Done — core case

- Project create/edit/delete and multi-project navigation.
- Project-scoped employee create/edit/delete and task assignment.
- Task create/edit/delete with dates, assignee and four MVP statuses.
- Finish-to-start dependency graph with cycle prevention.
- Timeline and draggable dependency graph.
- Current schedule, status, deadline and project-boundary issues.
- Affected downstream tasks from the latest change.
- Computed critical tasks and calendar slack.
- Overdue task presentation and earliest-start constraints.
- Task-plan filters for attention, all, critical, buffer, conflicts and overdue.
- Explicit cascade shift preview and confirmation, including separate confirmation when project target end changes.
- Completed-task protection and frontend validation of backend shift previews.
- HTTP API integration without N+1 project/workspace loading.
- SignalR delta updates, event deduplication, reconnect resync and initial-connect retry.
- Multi-tab-safe task editing with dirty-field conflict handling.
- Responsive desktop/mobile UI.

### Done — counter-feature

- Lazy backend History in HTTP mode.
- Transactional selective Undo by chosen history ID.
- Realtime restoration of affected project entities.
- Duplicate/stale Undo protection and `404`/`409` reconciliation.
- Separate localStorage-backed History for mock mode.

### Partial / compatibility only

- Recovery scenario domain types and a mock heuristic remain in the codebase, but no recovery-suggestion UI is claimed for the current integrated product.
- Planned/baseline task dates are session-local in HTTP mode because the backend task DTO does not currently expose persistent baselines.
- Server History details show only fields supplied by its DTO; no synthetic before/after data is created.

### Deferred

- Authentication, authorization and project roles.
- Working-day calendars, weekends/holiday rules and resource leveling.
- Probabilistic CPM/PERT and advanced analytics.
- Portfolio, sharing, notifications, comments and export.
- A full recovery-recommendation engine beyond the explicit schedule-shift flow.

## Calculation rules kept for MVP

- All durations and shifts use calendar days.
- For finish-to-start `A → B`, `B.startDate` must be at least `A.endDate + 1 day`.
- Multiple predecessors constrain a successor by the latest predecessor end plus one day.
- Criticality is computed from the current dependency DAG and dates; existing gaps produce positive slack.
- Completed tasks can belong to a critical chain but are excluded from «Требуют внимания» and are never shifted automatically.
- Manual status `Delayed` and computed overdue/risk indicators are separate concepts.
