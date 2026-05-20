## ADDED Requirements

### Requirement: Search input at sidebar top
The sidebar SHALL display a search input at the top of the panel, above the Tools section. The input SHALL be always visible and not collapsible.

#### Scenario: Initial render shows search input
- **WHEN** the sidebar is rendered
- **THEN** a search input with placeholder text is displayed at the very top, above the "Tools" header

#### Scenario: Search input is clearable
- **WHEN** the user has typed text into the search input
- **THEN** a clear button (✕) SHALL be displayed on the right side of the input
- **WHEN** the user clicks the clear button
- **THEN** the search input text is cleared and the filter is reset

### Requirement: Filter tools by name
The search SHALL filter the Tools section entries (Cloud Resources, Task Center, Task Dispatch) based on their display name. The filter SHALL be case-insensitive substring matching against the i18n-translated tool label.

#### Scenario: Matching a tool name
- **WHEN** the user types a query that is a case-insensitive substring of a tool's display name
- **THEN** only matching tools are shown in the Tools section

#### Scenario: No tool matches
- **WHEN** the user types a query that matches no tool names
- **THEN** the Tools section is hidden entirely

### Requirement: Filter members by name, responsibilities, or capabilities
The search SHALL filter members using OR semantics across three fields: `id` (name), `responsibilities`, and `capabilities`. The filter SHALL be case-insensitive substring matching. Empty or undefined fields SHALL be ignored in matching.

#### Scenario: Match by member name
- **WHEN** the user types a query that is a case-insensitive substring of a member's `id`
- **THEN** that member is included in the filtered results

#### Scenario: Match by responsibilities
- **WHEN** the user types a query that is a case-insensitive substring of a member's `responsibilities` field
- **THEN** that member is included in the filtered results, even if the name does not match

#### Scenario: Match by capabilities
- **WHEN** the user types a query that is a case-insensitive substring of a member's `capabilities` field
- **THEN** that member is included in the filtered results, even if the name does not match

#### Scenario: Member with empty optional fields
- **WHEN** a member has no `responsibilities` or `capabilities` values
- **THEN** only the `id` field is considered for matching; the search does not error or produce false positives

### Requirement: Display match source hint for members
When a member is matched via `responsibilities` or `capabilities` (not by name), the sidebar SHALL display the matching field as a small subtitle below the member entry, indicating why the result matched.

#### Scenario: Match via responsibilities
- **WHEN** a member matches only through the `responsibilities` field
- **THEN** a subtitle line is displayed below the member name showing `Responsibilities: <matched value>`

#### Scenario: Match via capabilities
- **WHEN** a member matches only through the `capabilities` field
- **THEN** a subtitle line is displayed below the member name showing `Capabilities: <matched value>`

#### Scenario: Match via name only
- **WHEN** a member matches through the `id` field (name)
- **THEN** no subtitle hint is displayed

#### Scenario: Match via multiple fields
- **WHEN** a member matches through both name and responsibilities/capabilities
- **THEN** no subtitle hint is displayed (name match takes priority)

### Requirement: Empty state when no results
When the search query matches no tools and no members, the sidebar SHALL display an empty state message.

#### Scenario: No matches at all
- **WHEN** the user types a query that matches no tools and no members
- **THEN** an empty state message (e.g., "No results") is displayed in place of both sections

### Requirement: Ctrl+K keyboard shortcut to focus search
The system SHALL provide a `Ctrl+K` keyboard shortcut that focuses the search input. This shortcut SHALL only work when the application window is focused.

#### Scenario: Focus search with Ctrl+K
- **WHEN** the user presses `Ctrl+K` and the app window is focused
- **THEN** the search input receives focus

#### Scenario: Escape clears and blurs search
- **WHEN** the search input is focused and the user presses `Escape`
- **THEN** the search query is cleared and the input loses focus

### Requirement: Keyboard navigation on filtered results
The existing `↑↓` arrow key navigation SHALL operate on the filtered result list rather than the full unfiltered list. When no search is active, navigation SHALL behave identically to the current implementation.

#### Scenario: Arrow keys with active search
- **WHEN** the user has typed a search query and presses `↑` or `↓`
- **THEN** the selection cycles through only the filtered tools and members

#### Scenario: Arrow keys without search
- **WHEN** the search input is empty
- **THEN** arrow key navigation works on the full unfiltered list (unchanged behavior)
