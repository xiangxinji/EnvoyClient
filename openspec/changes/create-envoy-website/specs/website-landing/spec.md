## ADDED Requirements

### Requirement: Landing page layout with glass design system
The system SHALL render landing pages (home, features, download) using a Mac-inspired frosted glass design language, reusing the design tokens from the main project (`--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`, `--accent`, `--radius-*`).

#### Scenario: User visits homepage in light mode
- **WHEN** user navigates to `/` with light mode preference
- **THEN** the page renders with `--bg-primary: #ffffff` background, frosted glass navigation bar using `--glass-bg: rgba(255,255,255,0.6)` + `backdrop-filter: blur(20px)`, and accent color `#2daa82`

#### Scenario: User visits homepage in dark mode
- **WHEN** user navigates to `/` with dark mode preference
- **THEN** the page renders with `--bg-primary: #0d0d0f` background, frosted glass navigation bar using `--glass-bg: rgba(28,28,30,0.6)` + `backdrop-filter: blur(20px)`, and accent color `#2ea87a`

### Requirement: Homepage hero section with Mac window showcase
The system SHALL display a hero section that highlights team social and task dispatch features, using a macOS window-style container (`MacWindow` component) to showcase product screenshots.

#### Scenario: Hero renders with product preview
- **WHEN** user views the homepage hero section
- **THEN** a macOS-style window is displayed with traffic lights (red/yellow/green dots), title bar, and product screenshot showing chat interface and task panel

#### Scenario: Hero call-to-action buttons
- **WHEN** user views the hero section
- **THEN** two CTA buttons are visible: primary "Download Envoy" button (accent color) and secondary "View Docs" link

### Requirement: Features page with capability cards
The system SHALL render a features page showcasing core capabilities (chat, tasks, AI) in a grid of glass-styled cards.

#### Scenario: Feature cards display
- **WHEN** user navigates to `/features`
- **THEN** feature cards are displayed in a responsive grid, each with an icon, title, description, and glass card background using `--glass-bg-light` + `--glass-border`

### Requirement: Download page with platform options
The system SHALL provide a download page with platform-specific download buttons (macOS, Windows).

#### Scenario: User visits download page
- **WHEN** user navigates to `/download`
- **THEN** download buttons for macOS and Windows are displayed, each with the appropriate icon and file size info

### Requirement: MacWindow component
The system SHALL provide a reusable `MacWindow` component that simulates a macOS application window with title bar and content slot.

#### Scenario: MacWindow renders with content
- **WHEN** MacWindow component is used with slot content
- **THEN** it displays a container with macOS title bar (traffic lights + centered title), rounded corners (`--radius-xl`), glass shadow (`--glass-shadow-heavy`), and slot content in the body area

### Requirement: Decorative orb elements
The system SHALL render decorative gradient orb elements (matching `--orb-*` variables) as background decorations on landing pages.

#### Scenario: Orbs visible on hero section
- **WHEN** user views the homepage
- **THEN** semi-transparent green gradient orbs (`--orb-1` through `--orb-4`) are positioned behind the hero content as ambient decoration

### Requirement: Global navigation bar
The system SHALL render a fixed glass navigation bar with logo, page links, language toggle, and theme toggle.

#### Scenario: Navigation links work
- **WHEN** user clicks "Features" in the nav bar
- **THEN** browser navigates to `/features` (or `/en/features` for English)

#### Scenario: Language toggle
- **WHEN** user clicks the language toggle in nav bar
- **THEN** the page switches between Chinese and English versions

### Requirement: Responsive layout
The system SHALL render all landing pages responsively, adapting layout for mobile (<768px), tablet (768-1024px), and desktop (>1024px).

#### Scenario: Mobile layout
- **WHEN** viewport width is less than 768px
- **THEN** navigation collapses to hamburger menu, hero stacks vertically, feature cards display in single column

### Requirement: Dark/light theme toggle
The system SHALL support manual theme toggle and respect system preference, using `html.dark` class switching.

#### Scenario: User toggles theme
- **WHEN** user clicks the theme toggle button
- **THEN** the page switches between light and dark CSS variable sets
