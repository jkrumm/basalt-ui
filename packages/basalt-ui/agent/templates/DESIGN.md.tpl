# {{APP_NAME}} — Design

> Managed by basalt-ui ({{BASALT_VERSION}}). This is a **thin** instantiation — it records this
> app's **deltas only** on top of the shipped `basalt-*` rules. The universal law (earned color,
> neutral-by-default, three-tier `--vx-*` tokens, theme-is-data, the chart primitive contract, the
> elevation/density/shape doctrine) lives in those rules and the `/basalt:design` skill, and is
> **not** repeated here. Touch this file only to confirm identity, register the app's series, or
> record a genuine deviation.

## Precedence (when guidance conflicts)

This file's deltas win, then the shipped rules, then any skill:

1. **This file** (`{{APP_NAME}}` DESIGN.md) — app-specific deltas. Highest authority.
2. **`basalt-*` rules** (`.claude/rules/basalt-*.md`) — the shipped law and its enforcement.
3. **Skills** (`/basalt:design`, `/basalt:charts`, `/frontend-design`, …) — generic method, lowest.

A skill never overrides this file or the `basalt-*` rules. When a skill's instinct collides with the
law, the law wins.

## Identity

{{APP_NAME}} inherits the basalt-ui identity verbatim: a calm, dense, dark-first professional
surface — **warm-neutral charcoal** (volcanic basalt; neutrals are warm, blue channel ≤ red, never
cool/steel/blue-grey), **one earned accent: a muted slate-blue** (desaturated, calm Notion/Linear —
not "Bootstrap blue"), neutral grey as the default data ink, hairline elevation, system-sans carried
by size+weight with mono numbers. Neutrals do ~90% of the surface; the accent only points (primary
CTA, focus, links, small status pops) — never floods. Active nav is a neutral surface fill, never the
accent. Light mode is a near-neutral off-white (page `#fafafa`, cards `#ffffff`, hairline `#ededec` —
only a whisper of warmth, not creamy/yellow) with near-black text; dark mode is warm charcoal (not
blue-tinted, not pure black). **Dense by default** (compact nav, `sm` gaps/padding); all cards render
identically — **flat, one border token, one radius token (`--vx-radius-card`)** — never inline-override
a surface's border/radius/shadow/bg (enforced by `basalt check-theme`). The theme runs a **strict
surface system**: it collapses Mantine's raw ramp steps onto the `--vx-surface-*` tokens, so every
component shares one border/bg/radius. **Use Mantine primitives, not raw HTML** (`Box`/`Flex`/`Grid`/
`SimpleGrid`/`Stack`/`Group`/`Paper`/`Card` over `<div>`/`<span>` with inline `style`) — also enforced
by `check-theme`. Confirm or restate any
intentional identity shift here; **silence means "inherits the basalt-ui defaults unchanged."**

- **Accent hue:** {{ACCENT_HUE}} (default: the muted slate-blue — `var(--vx-line)` neutral is still
  the default for single-series marks)
- **Tone deltas:** _(none — inherits)_

## Series dictionary

The framework owns the **roles** and the **available hues** (see the `basalt-tokens` rule). This
table is the app's **data dictionary** — which metric maps to which hue, as `{light,dark}` pairs,
wired through `defineSeries()`. This is the one design artifact that legitimately lives in the
consumer; keep it the single source of truth and never inline a hex elsewhere.

| Series name | Light hex | Dark hex | `defineSeries` key | Role / earned reason |
|-|-|-|-|-|
| _e.g. requests_ | `#4f78a4` | `#7099c4` | `requests` | Primary metric (muted slate accent) |
| | | | | |

```ts
// {{SERIES_MODULE_PATH}} — the app's guard-exempt series file
import { buildPaletteCss, defineSeries, seriesTokens } from 'basalt-ui/tokens'

const SERIES_MAP = defineSeries({
  // requests: { light: '#4f78a4', dark: '#7099c4' },
})

export const series = seriesTokens(SERIES_MAP) // { requests: 'var(--vx-requests)', ... }
export const SERIES_CSS = buildPaletteCss({ groups: { '': SERIES_MAP } })
// feed SERIES_CSS to BasaltProvider's palette; read `series.requests` in charts.
```

Rules for this table (from the `basalt-tokens` / `basalt-charts` rules — do not relax):
- One hue per series, drawn from the identity families only. Never raw Material/AntD/Tailwind.
- A series earns a color only for **trend**, **signal/status**, or **categorical separation**.
  A lone single-series metric stays neutral (`var(--vx-line)`).
- Light is one shade **deeper**, dark one shade **lighter** — same hue, never the same hex.

## App deviations

Genuine, intentional departures from the basalt-ui defaults — each with a one-line justification. An
empty section is the correct default; do not invent deviations to fill it.

- _(none yet)_
