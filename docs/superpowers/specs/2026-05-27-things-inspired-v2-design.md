# More Than Todo V2: Things-Inspired Planning Design

## Goal

V2 should make the app feel closer to Things 3: calm, structured, immediately understandable, and useful without setup. The goal is not to copy Things 3 feature-for-feature. The goal is to adopt the product ideas that make it feel good:

- clear task timing states
- lightweight project structure
- fast navigation
- restrained but meaningful icons
- useful progress feedback
- pastel, readable analytics

This version keeps the existing local-first IndexedDB model and manual import/export. It does not add accounts, sync, team features, or a full external calendar integration.

## References

- Things scheduling model: Today, Upcoming, Anytime, Someday, repeating tasks, deadlines. Source: https://culturedcode.com/things/support/articles/2803579/
- Things project headings. Source: https://culturedcode.com/things/support/articles/2803577/
- Things tags and inherited tag behavior. Source: https://culturedcode.com/things/support/articles/2803581/
- Things Quick Find across lists, projects, areas, tags, and headings. Source: https://culturedcode.com/things/support/articles/2803584/

## Product Model

### Default Lists

The left navigation should move from a generic todo app model to a Things-like timing model:

- `Inbox`: unprocessed tasks with no clear timing or destination.
- `Today`: tasks intended for today, including overdue scheduled tasks.
- `Upcoming`: future scheduled tasks. This view owns list/week/month planning.
- `Anytime`: open tasks that are actionable but not scheduled for a date.
- `Someday`: open tasks intentionally deferred.
- `Logbook`: completed tasks, replacing the current mental model of a trash-only completed list.
- `Deadlines`: tasks with a deadline, sorted by urgency.
- `Trash`: deleted tasks only, kept separate from completed tasks.
- `Projects`: user-created work streams.

V2 should stop treating completed tasks as “trash.” Completion belongs in Logbook. Deletion belongs in Trash.

### Task Fields

Extend `Task` with:

- `startDate?: DateKey`: when it should appear in Today/Upcoming.
- `deadline?: DateKey`: hard deadline, distinct from scheduling.
- `status`: keep `open` and `completed`, and add `deleted` or equivalent soft-delete state.
- `someday?: boolean`: explicit deferred state.
- `checklist?: ChecklistItem[]`: lightweight subtasks.
- `headingId?: string`: optional project section.

Current `scheduledDate` can be migrated or treated as `startDate`. The implementation should preserve existing user data and avoid destructive migration.

### Project Structure

Add project headings:

- A project can contain multiple headings.
- A task can belong to one heading.
- Headings are local project sections, not global tags.
- Today can group tasks by project/heading when useful.

This gives Things-like structure without building a full nested outline system.

## Views

### Today

Today remains the primary screen. It should show:

- grouped task list by project or heading
- clean checkbox rows with subtle icons and minimal chips
- overdue and today start-date tasks
- quick add that defaults to Today
- right panel details

Today should include a compact progress area:

- today completion percent
- total open today tasks
- focus minutes
- urgent deadline count

### Upcoming

Upcoming gets a segmented view switch:

- `List`: future tasks grouped by date.
- `Week`: seven-day planner with drag-to-day scheduling.
- `Month`: month grid with pastel density dots and selected-day task list.

The week/month views should schedule tasks by changing `startDate`, not duplicate tasks.

### Anytime

Anytime shows open actionable tasks without start dates and not marked Someday. It is the place for tasks that can be done whenever the user has time.

### Someday

Someday shows deferred tasks. It should be easy to move a task from Someday to Today, Upcoming, or Anytime.

### Logbook

Logbook shows completed tasks grouped by completion date. Users can restore a completed task from here. It is not a trash can.

### Deadlines

Deadlines shows open tasks with `deadline`, sorted by nearest deadline first. It should visually separate overdue, due soon, and later.

## Visual Design

The UI should become less toy-like and more tool-like:

- reduce saturated fills
- use pastel colors mostly in analytics, small tags, and project markers
- avoid frequent hover jumping
- use icon + label only where it improves scanability
- keep cards for real framed tools and repeated items, not every section
- use thin separators and calm whitespace

### Pastel Analytics Palette

Use a pastel multi-color palette for charts:

- blue: `#B8D8FF`
- rose: `#F7C8D8`
- mint: `#BEE7D3`
- amber: `#FFE2A8`
- lavender: `#D9C8FF`
- neutral: `#E8EEF7`

Charts should answer one question each:

- donut/pie: distribution by project, area, or tag
- bar trend: completed tasks or focus minutes over the week
- stat cards: today status only

Avoid decorative charts that do not help the user decide what to do next.

## Data And Architecture

Keep the current repository/store boundary:

- domain selectors calculate view membership and analytics
- store owns mutation flows and persistence coordination
- repository remains IndexedDB-backed
- import/export format should get a V2 schema version when fields change

New domain modules should be added instead of growing `App.tsx` further:

- `domain/planning.ts`: Today/Upcoming/Anytime/Someday/Deadline selectors.
- `domain/analytics.ts`: completion rate, project distribution, weekly trend.
- `domain/calendar.ts`: week and month grid helpers.

Components should be extracted from `App.tsx` as the implementation grows:

- `Sidebar`
- `TaskList`
- `PlanningViews`
- `AnalyticsPanel`
- `TaskDetails`
- `PomodoroPanel`

## Import/Export Compatibility

V1 JSON imports should still work. Import should normalize missing V2 fields:

- missing `startDate` uses existing `scheduledDate`
- missing `deadline` remains empty
- missing `checklist` becomes empty array
- missing `someday` becomes false

V2 export should include a clear schema version.

## Testing

Add tests before implementation:

- selector tests for Today, Upcoming, Anytime, Someday, Logbook, Deadlines
- week and month grid tests
- task migration/normalization tests
- checklist mutation tests
- heading grouping tests
- import V1 to V2 compatibility test
- component tests for view switching and chart rendering

## Implementation Phases

### Phase 1: Things-like navigation and task states

Add Anytime, Someday, Logbook, Deadlines. Separate completion from deletion. Update sidebar icons, labels, tips, and selectors.

### Phase 2: Week and month planning

Add Upcoming view mode switch: list/week/month. Week view supports drag-to-day scheduling. Month view shows density and selected-day tasks.

### Phase 3: Project headings and checklists

Add project headings and task checklist editing. Show headings inside project and Today groupings.

### Phase 4: Pastel analytics

Add analytics panel with donut distribution, weekly trend bars, and useful stat cards. Keep charts compact and decision-oriented.

## Non-Goals

- no account system
- no cloud sync
- no full external calendar integration
- no natural-language parser in V2
- no nested projects or arbitrary tree structures
- no complex recurring rule editor beyond current V1 repeat scope

## Open Decision

The recommended first implementation slice is Phase 1 plus the basic shell of Phase 2. That gives the largest usability improvement without waiting for all analytics and project structure work.
