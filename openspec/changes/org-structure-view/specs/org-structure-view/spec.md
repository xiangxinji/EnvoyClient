## ADDED Requirements

### Requirement: Org structure page entry point
The system SHALL provide a `__org__` entry in the sidebar Tools section. Clicking it SHALL set `selectedPeer` to `"__org__"` and render the `OrgView` component.

#### Scenario: User opens org structure view
- **WHEN** user clicks the org structure entry in the sidebar Tools section
- **THEN** the right panel switches to render the OrgView component
- **AND** the sidebar entry shows as active (highlighted)

#### Scenario: Org entry appears in sidebar search
- **WHEN** user types a search query in the sidebar
- **THEN** the org structure entry SHALL appear in filtered tools if the query matches its label

### Requirement: Two-layer tree layout with dagre
The system SHALL render a top-to-bottom tree using dagre layout with the Leader node at the top and all Member nodes below. All nodes SHALL be non-draggable.

#### Scenario: Rendering with online and offline members
- **WHEN** the org view is loaded and there are 1 leader and N members
- **THEN** the leader node SHALL appear at the top center
- **AND** all member nodes SHALL appear in a row below the leader
- **AND** edges connect the leader to each member

#### Scenario: Member sort order
- **WHEN** member nodes are laid out
- **THEN** online members SHALL appear before offline members
- **AND** within each group, members with more active tasks (running + pending + reviewing) SHALL appear first

### Requirement: Leader node display
The system SHALL render the current user as a Leader node with a larger card showing avatar, nickname, a crown icon, and task summary counts.

#### Scenario: Leader node content
- **WHEN** the current user has role "leader"
- **THEN** the leader node SHALL display avatar (or initial), nickname, and a crown icon
- **AND** task summary showing only non-zero counts: ⏳running ✅completed ❌failed 🔍reviewing

### Requirement: Member node display
The system SHALL render each member as a card node showing avatar, nickname, online status dot, task summary, and truncated responsibilities.

#### Scenario: Online member with tasks
- **WHEN** a member is online and has tasks in various statuses
- **THEN** the node SHALL show a green status dot, avatar, nickname
- **AND** task summary with only non-zero counts: ⏳running ✅completed ❌failed 🔍reviewing
- **AND** responsibilities text truncated to one line

#### Scenario: Online member with no tasks
- **WHEN** a member is online but has zero tasks
- **THEN** the node SHALL show a green status dot and "✨ 空闲" text instead of task counts

#### Scenario: Offline member
- **WHEN** a member is offline
- **THEN** the node SHALL use a dashed border and reduced opacity (0.5)
- **AND** show a gray status dot and "离线" text
- **AND** NOT show task counts or responsibilities

### Requirement: Edge styling by member status
Edges SHALL use solid lines for online members and dashed lines for offline members.

#### Scenario: Edge visual differentiation
- **WHEN** an edge connects the leader to an online member
- **THEN** the edge SHALL be a solid line
- **WHEN** an edge connects the leader to an offline member
- **THEN** the edge SHALL be a dashed line with reduced opacity

### Requirement: Real-time updates
The org view SHALL reactively update when member online status or task status changes, without requiring manual refresh.

#### Scenario: Member goes online
- **WHEN** a member transitions from offline to online
- **THEN** their node SHALL update to show green status dot, solid border, full opacity
- **AND** the connecting edge SHALL switch from dashed to solid
- **AND** the node SHALL move ahead of offline members in layout

#### Scenario: Task status changes
- **WHEN** a task status changes via WebSocket "task" event
- **THEN** the affected member's task summary counts SHALL update immediately
- **AND** the layout SHALL re-sort if the active task count order changes

### Requirement: Vue Flow lazy loading
The `@vue-flow/core` library and related dependencies SHALL be loaded lazily when the OrgView is first rendered, not included in the main bundle.

#### Scenario: Initial page load
- **WHEN** the application first loads on the chat view
- **THEN** Vue Flow dependencies SHALL NOT be in the initial JavaScript bundle
- **WHEN** user navigates to the org view
- **THEN** Vue Flow dependencies SHALL be loaded on demand
