## ADDED Requirements

### Requirement: Starlight documentation integration
The system SHALL use Astro Starlight as the documentation framework, serving docs under the `/docs` path with sidebar navigation, full-text search, and content rendering.

#### Scenario: User opens documentation
- **WHEN** user navigates to `/docs`
- **THEN** Starlight renders a documentation page with left sidebar navigation, main content area, and right table-of-contents

### Requirement: Documentation content structure
The system SHALL provide documentation pages organized as follows: Getting Started, Chat, Tasks, AI Features, Deployment. Each page SHALL be authored in Markdown.

#### Scenario: User navigates to getting-started doc
- **WHEN** user navigates to `/docs/getting-started`
- **THEN** a getting-started guide is displayed with installation steps and first-run instructions

#### Scenario: Sidebar navigation reflects content structure
- **WHEN** user views any doc page
- **THEN** the sidebar lists: Getting Started, Chat, Tasks, AI Features, Deployment as top-level items

### Requirement: Minimum documentation content
The system SHALL include the following minimum documentation content in both Chinese and English:

1. **Getting Started**: Installation, first launch, joining a team
2. **Chat**: Sending messages, channels, mentions
3. **Tasks**: Creating tasks, task lifecycle, task dispatch
4. **AI Features**: AI suggestions, auto-reply, Agent execution
5. **Deployment**: Self-hosting the Manager server, system requirements

#### Scenario: All doc pages have content
- **WHEN** user navigates to any doc page
- **THEN** the page contains meaningful content (not placeholder text) with at least 3 paragraphs

### Requirement: Documentation search
The system SHALL provide full-text search across all documentation pages via Starlight's built-in Pagefind integration.

#### Scenario: User searches documentation
- **WHEN** user types a search query in the docs search bar
- **THEN** matching doc pages are listed with highlighted excerpts

### Requirement: Documentation previous/next navigation
The system SHALL provide previous/next page navigation at the bottom of each doc page, following the content structure order.

#### Scenario: User navigates between doc pages
- **WHEN** user finishes reading "Getting Started" and clicks "Next"
- **THEN** the browser navigates to "Chat" documentation
