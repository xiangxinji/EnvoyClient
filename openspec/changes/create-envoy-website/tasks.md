## 1. Project Scaffolding

- [x] 1.1 Initialize Astro project in `website/` with `npm create astro`, configure `astro.config.mjs` for SSG output
- [x] 1.2 Install dependencies: `@astrojs/starlight` (Tailwind removed — incompatible with Astro 6 Vite/rolldown)
- [x] 1.3 Copy design tokens from main project `src/styles/variables.css` to `website/src/styles/variables.css`
- [x] 1.4 ~~Configure Tailwind CSS integration~~ — Removed; using plain CSS variables directly
- [x] 1.5 Create base layout `src/layouts/BaseLayout.astro` with global styles import, nav slot, footer slot

## 2. i18n Infrastructure

- [x] 2.1 Configure Starlight i18n with `root` locale (zh-CN) and `en` locale in `astro.config.mjs`
- [x] 2.2 Create locale files: `src/i18n/zh.json` and `src/i18n/en.json` with nav labels, hero text, feature descriptions, footer content
- [x] 2.3 Create `src/i18n/utils.ts` helper: `getLangFromUrl()`, `useTranslations()`, `getLocalizedPath()`, `switchLocale()`
- [x] 2.4 Configure Starlight i18n with `locales` for root (zh-CN) and en, with auto-translated sidebar labels from page titles

## 3. Shared Components

- [x] 3.1 Create `Navbar.astro` — fixed glass nav bar with logo, page links, language toggle, theme toggle
- [x] 3.2 Create `Footer.astro` — site footer with links and copyright
- [x] 3.3 Create `MacWindow.astro` — macOS window container with traffic lights title bar and content slot
- [x] 3.4 Create `GlassCard.astro` — reusable glass-styled card component
- [x] 3.5 Create `ThemeToggle.astro` — dark/light toggle button using `html.dark` class switching
- [x] 3.6 Create `OrbBackground.astro` — decorative gradient orb elements using `--orb-*` variables

## 4. Landing Pages

- [x] 4.1 Create `LandingLayout.astro` extending BaseLayout with Navbar, OrbBackground, Footer
- [x] 4.2 Create homepage `src/pages/index.astro` — hero section with MacWindow showcase, team social + task dispatch copy, download CTA
- [x] 4.3 Create features page `src/pages/features.astro` — responsive grid of GlassCards for chat, tasks, AI capabilities
- [x] 4.4 Create download page `src/pages/download.astro` — platform download buttons for macOS and Windows
- [x] 4.5 Add scroll-triggered fade-in animations via CSS keyframes
- [x] 4.6 Create English page mirrors: `src/pages/en/index.astro`, `src/pages/en/features.astro`, `src/pages/en/download.astro`

## 5. Documentation System

- [x] 5.1 Configure Starlight integration in `astro.config.mjs` with sidebar structure and theme
- [x] 5.2 Apply glass design system overrides to Starlight via `src/styles/starlight.css` (CSS custom properties for colors, radius, fonts)
- [x] 5.3 Create Chinese docs: `src/content/docs/getting-started.mdx` — installation, first launch, joining a team
- [x] 5.4 Create Chinese docs: `src/content/docs/chat.mdx` — sending messages, channels, mentions
- [x] 5.5 Create Chinese docs: `src/content/docs/tasks.mdx` — creating tasks, lifecycle, dispatch
- [x] 5.6 Create Chinese docs: `src/content/docs/ai.mdx` — AI suggestions, auto-reply, Agent execution
- [x] 5.7 Create Chinese docs: `src/content/docs/deployment.mdx` — self-hosting Manager, system requirements
- [x] 5.8 Create English doc mirrors for all 5 doc pages in `src/content/docs/en/`

## 6. Responsive & Polish

- [x] 6.1 Implement responsive breakpoints: mobile (<768px) hamburger nav, single-column cards; tablet/desktop layouts
- [x] 6.2 Dark mode supported via `html.dark` class + localStorage + prefers-color-scheme detection
- [x] 6.3 Custom favicon at `public/favicon.svg` (brand green with diamond/arrow motif)
- [x] 6.4 Verified `npm run generate` produces static output in `dist/` — 17 pages built successfully
