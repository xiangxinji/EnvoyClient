## ADDED Requirements

### Requirement: Bilingual routing (Chinese default, English prefixed)
The system SHALL serve Chinese content at root paths (`/`, `/features`, `/download`, `/docs/*`) and English content at `/en/` prefixed paths (`/en/`, `/en/features`, `/en/download`, `/docs/en/*`).

#### Scenario: Chinese user visits homepage
- **WHEN** user navigates to `/`
- **THEN** the page renders in Chinese with Chinese navigation labels and hero text

#### Scenario: English user visits homepage
- **WHEN** user navigates to `/en/`
- **THEN** the page renders in English with English navigation labels and hero text

#### Scenario: Documentation i18n routing
- **WHEN** user navigates to `/docs/getting-started`
- **THEN** Chinese getting-started doc is displayed
- **WHEN** user navigates to `/docs/en/getting-started`
- **THEN** English getting-started doc is displayed

### Requirement: Language toggle in navigation
The system SHALL provide a language toggle button in the global navigation bar that switches between Chinese and English versions of the current page.

#### Scenario: Toggle preserves current page
- **WHEN** user is on `/features` and clicks the language toggle
- **THEN** browser navigates to `/en/features`

#### Scenario: Toggle from English back to Chinese
- **WHEN** user is on `/en/download` and clicks the language toggle
- **THEN** browser navigates to `/download`

### Requirement: Starlight i18n configuration
The system SHALL configure Starlight with `locales` for Chinese (`zh-CN`, root) and English (`en`, `/en/`), including translated UI labels (search placeholder, navigation labels, etc.).

#### Scenario: Starlight UI is translated
- **WHEN** user views docs in Chinese
- **THEN** Starlight UI labels (search placeholder "搜索", prev/next links, etc.) are in Chinese
- **WHEN** user views docs in English
- **THEN** Starlight UI labels are in English

### Requirement: Landing page i18n content files
The system SHALL store landing page translatable strings in separate locale files (`src/i18n/zh.json`, `src/i18n/en.json`), covering navigation labels, hero text, feature descriptions, download button labels, and footer content.

#### Scenario: All landing page text is translatable
- **WHEN** rendering any landing page element (nav, hero, features, footer)
- **THEN** all visible text is sourced from the corresponding locale file, not hardcoded

### Requirement: Content collection i18n for docs
The system SHALL use Astro Content Collections with i18n support for documentation, placing Chinese docs in `src/content/docs/zh/` and English docs in `src/content/docs/en/`.

#### Scenario: Doc content is language-specific
- **WHEN** Starlight renders a doc page
- **THEN** it loads the Markdown content from the corresponding language directory
