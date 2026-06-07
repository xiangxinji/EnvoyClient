# Envoy website design system

## Design read

Envoy is a self-hosted collaboration client for technical teams that coordinate people, tasks, cloud resources, and AI agents. The website should feel like an operations console for real work, not a generic SaaS splash page.

## Design dials

- Variance: 6, with asymmetric hero and mixed feature layouts.
- Motion: 3, limited to entry, hover, and focus feedback.
- Density: 5, enough product detail to feel credible without becoming a dashboard.

## Principles

- One theme: dark graphite throughout all marketing pages.
- One accent: muted green for primary actions, active states, and product status.
- Product first: the hero must show a concrete Envoy workspace preview.
- No generic patterns: avoid centered hero, emoji icons, orb backgrounds, AI-purple gradients, and equal three-card rows.
- Preserve routes and navigation labels for the existing Astro/Starlight structure.

## Tokens

- Background: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`.
- Surfaces: `--surface-1`, `--surface-2`, `--surface-3`.
- Text: `--text-primary`, `--text-secondary`, `--text-muted`.
- Accent: `--accent`, `--accent-strong`, `--accent-soft`.
- Radius: 8px for controls, 14px for panels, 18px for large product frames.
- Shadows: tinted graphite shadows only.

## Typography

- Sans stack: Geist/Segoe UI/system fallback.
- Display: 56-72px desktop, heavy weight, tight line-height.
- Body: 16-18px, max 65 characters, comfortable leading.
- Product data: use tabular figures.

## Components

- Navigation: fixed, compact, dark, one-line desktop nav.
- Buttons: filled primary, bordered secondary, visible focus ring, tactile active state.
- Product frame: framed application preview with real UI affordances and tabular status rows.
- Feature blocks: mixed spans and editorial descriptions rather than uniform cards.
- Footer: compact product/resource/community columns with legal links.

## Content voice

- Direct and operational.
- Describe concrete workflows: dispatch tasks, track execution, cite cloud resources, self-host data.
- Avoid exaggerated marketing words and placeholder names.
