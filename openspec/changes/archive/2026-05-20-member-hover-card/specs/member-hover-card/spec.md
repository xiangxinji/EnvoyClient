## ADDED Requirements

### Requirement: Hover card appears on member entry hover
The sidebar SHALL display a hover information card when the user hovers over a member entry (avatar + name row) in the member list. The card SHALL appear after a short delay to avoid flickering during fast mouse movement.

#### Scenario: Hover shows card
- **WHEN** the user hovers over a member entry in the sidebar member list for 150ms
- **THEN** a hover card appears positioned to the right of the member entry

#### Scenario: Mouse leave hides card
- **WHEN** the user moves the mouse away from the member entry
- **THEN** the hover card is hidden after a 100ms delay
- **WHEN** the user moves the mouse into the hover card before the 100ms delay
- **THEN** the hover card remains visible

#### Scenario: Fast mouse movement does not trigger card
- **WHEN** the user moves the mouse quickly across multiple member entries without pausing
- **THEN** no hover card is shown (150ms show delay prevents this)

### Requirement: Hover card displays member information
The hover card SHALL display the member's avatar (initial), name, role badge, online status, responsibilities, and capabilities. Fields that are empty or undefined SHALL NOT be displayed.

#### Scenario: Member with full information
- **WHEN** a member has id "Alice", role "member", status "online", responsibilities "前端开发", capabilities "React, Vue"
- **THEN** the hover card displays: avatar initial "A", name "Alice", role badge "member", status indicator "Online", section "Responsibilities: 前端开发", section "Capabilities: React, Vue"

#### Scenario: Leader with basic information
- **WHEN** a leader entry is hovered and the leader has no responsibilities or capabilities data
- **THEN** the hover card displays: avatar initial, name, role badge "leader", status indicator; no responsibilities or capabilities sections are shown

#### Scenario: Member with partial information
- **WHEN** a member has responsibilities but no capabilities
- **THEN** the responsibilities section is shown, and the capabilities section is omitted entirely

### Requirement: Hover card uses glass design system
The hover card SHALL follow the Glass Design System standard layer (`--glass-bg`, `backdrop-filter: blur`, `--glass-border`) with heavy shadow (`--glass-shadow-heavy`).

#### Scenario: Glass styling
- **WHEN** the hover card is rendered
- **THEN** it uses `--glass-bg` background, `backdrop-filter: blur(var(--glass-blur))`, `--glass-border` border, and `--glass-shadow-heavy` box-shadow

### Requirement: Hover card positioned via Teleport
The hover card SHALL be rendered via `<Teleport to="body">` and positioned with `position: fixed` based on the trigger element's bounding rect. The card SHALL be positioned to the right of the member entry by default.

#### Scenario: Default right-side positioning
- **WHEN** there is sufficient space to the right of the member entry
- **THEN** the card is positioned with its left edge at `rect.right + 4px` and vertically centered on the entry

#### Scenario: Right-side overflow fallback
- **WHEN** the card would overflow the right edge of the viewport
- **THEN** the card is positioned to the left of the member entry (`left = rect.left - cardWidth - 4px`)

### Requirement: Tool entries do not trigger hover card
The hover card SHALL only appear for member entries in the member list. Tool entries (Cloud Resources, Task Center, Task Dispatch) SHALL NOT trigger the hover card.

#### Scenario: Hover on tool entry
- **WHEN** the user hovers over a tool entry (e.g., Task Center)
- **THEN** no hover card appears
