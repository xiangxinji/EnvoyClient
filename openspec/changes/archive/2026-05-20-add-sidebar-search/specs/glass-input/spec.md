## ADDED Requirements

### Requirement: GlassInput base control component
The system SHALL provide a `GlassInput.vue` component as a base form control following the Glass Design System. The component SHALL be a reusable text input with consistent styling.

#### Scenario: Basic rendering
- **WHEN** a `GlassInput` is rendered with a `placeholder` prop
- **THEN** an input element is displayed with the placeholder text, 36px height, `--glass-bg-light` background, and `--glass-border` border

#### Scenario: Two-way binding via v-model
- **WHEN** the component is used with `v-model="value"`
- **THEN** typing in the input updates the bound value, and programmatically changing the value updates the displayed text

#### Scenario: Clearable mode
- **WHEN** the component receives a `clearable` prop and the input has text
- **THEN** a clear button (✕) is displayed on the right side
- **WHEN** the clear button is clicked
- **THEN** the value is set to empty string and the `clear` event is emitted

#### Scenario: Dark and light mode support
- **WHEN** the theme switches between dark and light mode
- **THEN** the input appearance adapts via CSS variables (`--glass-bg-light`, `--glass-border`, `--text-*`) without hardcoded colors

### Requirement: GlassInput styling conventions
The component SHALL conform to the project's base control encapsulation rules: 36px height, box-sizing border-box, and use CSS variables exclusively.

#### Scenario: Consistent dimensions
- **WHEN** the GlassInput is rendered
- **THEN** the component has `height: 36px`, `box-sizing: border-box`, and `padding: 0 14px`

#### Scenario: Focus state
- **WHEN** the input receives focus
- **THEN** the border color changes to `--accent` to indicate focus state

#### Scenario: Icon slot for search
- **WHEN** the component is used with a `#prefix` slot containing an icon
- **THEN** the icon is displayed inside the input on the left side, and the text area is offset accordingly
