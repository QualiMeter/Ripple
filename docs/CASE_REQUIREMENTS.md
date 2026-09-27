# Case Requirements — Ripple

## Business problem
A project plan changes in real work: a task takes longer, an employee becomes unavailable, requirements change, or a contractor is delayed.

The product should help a project manager understand not just the edited date itself, but the consequences for the rest of the project.

## Required capabilities

### 1. Project creation
User can:
- create a project;
- set project name and dates;
- add tasks;
- set task deadline/duration;
- assign a responsible person;
- set task status.

### 2. Dependencies
Tasks must support dependencies.
The user should understand:
- which tasks depend on others;
- which future tasks can be affected by a change.

### 3. Project management
User can:
- change task dates;
- change status;
- change assignee;
- add, delete, or edit a task;
- change task dependencies.

### 4. Impact analysis
After a task change, the system should help determine:
- which downstream tasks are affected;
- whether the overall project deadline changed;
- which tasks are at risk;
- which tasks are most critical;
- whether intervention is required.

### 5. Project representation
The UI must make it easy to understand:
- sequence of work;
- dates;
- dependencies;
- current state;
- potential problems.

The exact representation is up to the team:
timeline, graph, diagram, multiple views, etc.

## Demo constraints
Use a project with:
- 8+ tasks;
- multiple dependencies;
- multiple assignees;
- both completed and unfinished tasks;
- at least one task whose change affects later work.

During the demo, change project/task parameters and show the consequences.

## Scope limit
Do not build a full enterprise project management suite.
The MVP should focus on understanding change consequences and supporting project decisions.

## Counter-feature
Implement one additional working feature that:
- is related to the main case;
- solves an extra user or business problem;
- is integrated into the product.

Preferred Ripple direction:
recovery suggestions / “How to save the deadline”.

## Ripple implementation status

The sections above record the original case requirements. The current hackathon implementation maps to them as follows; this status does not redefine the case.

### Implemented

- Multiple projects with project dates and project-scoped employees.
- Task create/edit/delete, status and assignee changes.
- Finish-to-start dependency create/delete with duplicate, self-link and cycle validation.
- Overview with timeline, task plan, current issues and impact of the latest change.
- Interactive dependency graph with affected, risk and critical states.
- Downstream impact, overdue analysis, start constraints, project-boundary warnings, computed critical tasks and slack.
- Explicit automatic-shift preview and confirmation; ordinary edits never move related tasks silently.
- Responsive desktop/mobile navigation.
- REST source of truth with SignalR multi-tab/client synchronization.

### Counter-feature delivered

Ripple uses backend project History with transactional selective Undo of a chosen entry. Reverted entities are synchronized through SignalR. Mock mode keeps a separate local history implementation.

### Deferred beyond the current MVP

- Authentication and access roles.
- Working calendars, resource leveling and advanced planning analytics.
- The preferred recovery-suggestion concept (“How to save the deadline”) is not exposed as a completed HTTP-mode feature. The explicit schedule-shift preview is implemented, but it is not presented as a broader recovery recommendation engine.
