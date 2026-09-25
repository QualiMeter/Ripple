# MVP Plan — Ripple

## Demo story
Use a preconfigured software project with 8–10 tasks.

Example chain:
Requirements → UX Design → Backend API → Frontend Integration → QA → Release

Plus parallel tasks such as:
DB Schema, Infrastructure, Documentation.

### Demo moment
1. Open project.
2. Show that it currently meets the deadline.
3. Increase duration / shift due date of a key task.
4. Ripple recalculates dependent tasks.
5. UI highlights:
   - affected tasks;
   - new project deadline;
   - critical path / critical tasks;
   - risks.
6. Open “Save the deadline”.
7. Apply or preview one recovery scenario.
8. Show project returning closer to the target date.

## MVP priority

### P0 — Must work
- project/task model;
- dependencies;
- edit task;
- recalculate dates;
- impacted task list;
- project deadline shift;
- risk/critical state;
- clear timeline or dependency view.

### P1 — Strong demo
- animated/visual propagation of impact;
- before/after comparison;
- change summary;
- recovery suggestions;
- seed demo project.

### P2 — Nice to have
- multiple projects;
- auth;
- comments;
- activity history;
- advanced analytics;
- export;
- notifications.

## Suggested calculations

### Dependency propagation
For finish-to-start dependency A → B:
B cannot start before A is completed.

If A moves later:
- recompute earliest possible start for B;
- update B end date;
- continue propagation through descendants.

### Project deadline
Project finish = max(end date of all terminal tasks).

### Criticality
Start simple:
- mark tasks on the longest dependency chain to project finish as critical;
- optionally compute slack later.

### Risk
A task may be risky if:
- projected finish exceeds its planned deadline;
- it has zero/low slack;
- it blocks many downstream tasks;
- it is already overdue and incomplete.

Keep the explanation visible in the UI.

## Recovery scenarios
Possible MVP heuristics:
- reduce duration of a critical task;
- move an independent task in parallel;
- reassign a task to a faster/available assignee;
- remove/change a dependency only when user explicitly confirms;
- combine two safe actions.

Recovery suggestions should show expected effect:
“Project finish: Sep 30 → Sep 28”.
