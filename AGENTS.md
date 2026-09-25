# AGENTS.md — Ripple

## Product
Ripple is a hackathon MVP for project risk and change impact analysis.

Core idea:
when something changes in one task, the system should show the ripple effect across dependent tasks and the project deadline.

## Primary user
Project manager / team lead.

## Main user scenario
1. User creates or opens a project.
2. Project contains tasks with deadlines, assignees, statuses, and dependencies.
3. User changes one task: deadline, status, assignee, or dependency.
4. System recalculates the impact.
5. UI clearly shows:
   - which downstream tasks are affected;
   - whether the overall project deadline changed;
   - which tasks are at risk;
   - which tasks are critical;
   - whether user intervention is needed.
6. User can inspect the project in a timeline / graph / other visual view.

## Hackathon requirements
The demo project must contain:
- at least 8 tasks;
- several dependencies;
- several assignees;
- completed and incomplete tasks;
- at least one task whose change affects downstream work.

The demo must visibly show a parameter change and its consequences.

## Required MVP features
- Create project.
- Set project name and dates.
- CRUD for tasks.
- Task fields:
  - title;
  - start/due dates or duration;
  - assignee;
  - status.
- Manage dependencies between tasks.
- Recalculate consequences after edits.
- Show affected downstream tasks.
- Show whether the project deadline changed.
- Highlight at-risk tasks.
- Highlight critical tasks.
- Clearly show current state, deadlines, dependencies, and potential problems.
- At least one integrated counter-feature that creates extra user value.

## Counter-feature direction
Preferred concept: “How to save the deadline”.

After a risky change, Ripple may suggest recovery scenarios, for example:
- reassign a task;
- shorten a task duration;
- move non-blocking work in parallel;
- change a dependency;
- combine several actions.

This feature must be a working part of the product, not a mock slide.

## Product principles
- The key value is impact analysis, not generic task management.
- Do not turn Ripple into a full Jira/YouTrack clone.
- Every screen should help answer:
  “If something changes now, what happens to the project?”
- Prefer a strong, understandable demo flow over many unfinished features.
- Changes and consequences should be visible immediately.
- Avoid hidden “magic”; the user should understand why a task is marked risky or critical.

## UX direction
Desktop-first modern SaaS interface.

Suggested information architecture:
- Dashboard / Projects
- Project workspace
  - Overview
  - Timeline
  - Dependency graph
  - Risks / Impact
- Task details side panel / modal
- Change impact panel

Important visual behavior:
- impacted tasks should be visually connected to the changed task;
- deadline shifts should be obvious;
- critical/risky tasks need clear states;
- timeline changes should be easy to demonstrate live.

## Engineering rules
- Keep code modular and hackathon-friendly.
- Prefer explicit domain models over UI-only state.
- Impact calculation must be isolated from presentation logic.
- Avoid hardcoding demo results into UI.
- Seed/demo data is allowed, but recalculation must actually work.
- Before large refactors, inspect the current repository first.
- Do not rewrite working parts without a clear reason.
- Keep API/domain contracts documented in docs/.
- Add comments only where logic is non-obvious.
- When implementing a feature, make the smallest complete vertical slice that can be demonstrated.

## Recommended implementation order
1. Domain model: Project, Task, Dependency, Assignee.
2. Demo seed with 8+ tasks.
3. Project workspace and task editing.
4. Dependency-aware date recalculation.
5. Impact/risk highlighting.
6. Timeline / dependency visualization.
7. Counter-feature: recovery scenarios.
8. Polish demo flow and edge cases.

## Definition of Done for the hackathon MVP
A reviewer can:
1. Open a prepared project.
2. Understand its current plan.
3. Change one meaningful task parameter.
4. Immediately see which tasks were affected.
5. See whether the project deadline moved.
6. See critical / at-risk tasks.
7. Understand the reason for the impact.
8. Try at least one recovery scenario.
