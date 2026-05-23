## ADDED Requirements

### Requirement: Color theme selection
The system SHALL provide three color themes: "default" (green), "blue" (tech blue), "purple" (dark purple). The user SHALL be able to select a theme from SettingsGeneral via a GlassSelect dropdown.

#### Scenario: User selects a different theme
- **WHEN** user picks "blue" from the theme selector in SettingsGeneral
- **THEN** the accent color and all derived variables switch to blue immediately without page reload

#### Scenario: Default theme on first launch
- **WHEN** no theme preference exists in localStorage
- **THEN** the system SHALL use "default" (green) theme

### Requirement: Theme persistence
The selected theme SHALL be stored in localStorage under key `envoy-color-theme`. It SHALL persist across sessions and SHALL NOT sync to yml or backend.

#### Scenario: Theme preference survives restart
- **WHEN** user selects "purple" theme and restarts the app
- **THEN** the purple theme is active on next launch

### Requirement: Dark purple forced dark mode
When `colorTheme` is "purple", the system SHALL force dark mode background and accent colors regardless of the light/dark toggle state. The light/dark toggle in TitleBar SHALL be disabled or hidden.

#### Scenario: User selects dark purple while in light mode
- **WHEN** user is in light mode and selects "purple" theme
- **THEN** the interface switches to dark background with purple accent immediately

#### Scenario: User tries to toggle light/dark while in purple theme
- **WHEN** user is in "purple" theme and clicks the light/dark toggle
- **THEN** the toggle SHALL have no effect and remain in dark state

#### Scenario: User switches away from purple theme
- **WHEN** user switches from "purple" to "default" theme
- **THEN** the light/dark toggle is re-enabled and the previous light/dark preference is restored

### Requirement: CSS variable overrides per theme
Each theme SHALL override the following accent-derived CSS variables in both light and dark modes (except purple which is unified): `--accent`, `--accent-hover`, `--accent-light`, `--bubble-mine`, `--sidebar-active`, `--task-running-border`, `--task-running-bg`, `--task-running-text`, `--md-link-color`, `--orb-1` through `--orb-4`, `--text-on-accent`.

#### Scenario: Blue theme applies correct colors
- **WHEN** data-theme="blue" is set on <html>
- **THEN** --accent is #3b82f6 (light) or #60a5fa (dark), and all derived variables reflect blue accent

#### Scenario: Purple theme applies unified dark colors
- **WHEN** data-theme="purple" is set on <html>
- **THEN** --accent is #8b5cf6, background variables match dark mode values, with no difference between light and dark class states
