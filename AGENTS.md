# AGENTS.md

Instructions for AI coding agents working with this codebase.

## When doing some ui work remember the color palletes for this project:
## Color Palette Reference
| Hex Code | Name | OKLCH Value | Role |

|----------|------|-------------|------|

| `#A7C72A` | Lime Green | `oklch(0.76 0.18 115)` | **Primary** - CTAs, buttons, active states |

| `#87B071` | Sage Green | `oklch(0.68 0.10 135)` | **Accent** - Hover states, focus rings, secondary accents |

| `#2F4D18` | Forest Green | `oklch(0.35 0.10 130)` | **Secondary Text** - Muted text, secondary foregrounds |

| `#1C2101` | Dark Green-Black | `oklch(0.16 0.04 120)` | **Foreground** - Main text, footer background |

| `#D9E3AA` | Pale Green | `oklch(0.88 0.08 110)` | **Secondary/Muted** - Borders, sidebar, subtle backgrounds |

| `#FFFFFF` | White | `oklch(1 0 0)` | **Background** - Page, cards, navbar |

---


<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->
