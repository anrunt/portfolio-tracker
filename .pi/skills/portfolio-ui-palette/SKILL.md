---
name: portfolio-ui-palette
description: Applies the portfolio-tracker project color palette to UI work. Use when designing, building, reviewing, or styling pages, layouts, components, visual states, themes, and other user-interface elements in this workspace. Do not load for tasks unrelated to UI.
---

# Portfolio UI Color Palette

Use this palette consistently for UI work in the `portfolio-tracker` project.

| Hex Code | Name | OKLCH Value | Role |
|----------|------|-------------|------|
| `#A7C72A` | Lime Green | `oklch(0.76 0.18 115)` | **Primary** — CTAs, buttons, active states |
| `#87B071` | Sage Green | `oklch(0.68 0.10 135)` | **Accent** — hover states, focus rings, secondary accents |
| `#2F4D18` | Forest Green | `oklch(0.35 0.10 130)` | **Secondary Text** — muted text, secondary foregrounds |
| `#1C2101` | Dark Green-Black | `oklch(0.16 0.04 120)` | **Foreground** — main text, footer background |
| `#D9E3AA` | Pale Green | `oklch(0.88 0.08 110)` | **Secondary/Muted** — borders, sidebar, subtle backgrounds |
| `#FFFFFF` | White | `oklch(1 0 0)` | **Background** — page, cards, navbar |

## Usage rules

- Preserve the assigned semantic roles unless the existing design system requires a more specific mapping.
- Prefer the OKLCH values when defining CSS color tokens; keep the hex values as fallbacks or references.
- Use Sage Green for hover and focus feedback rather than introducing unrelated accent colors.
- Maintain accessible text and control contrast; do not use a palette color for a role when contrast is insufficient.
- Reuse existing project tokens that already represent these colors instead of duplicating raw values.
