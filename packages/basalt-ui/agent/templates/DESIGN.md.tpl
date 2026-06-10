# {{APP_NAME}} — Design

> Managed by basalt-ui ({{BASALT_VERSION}}). This is a **thin** instantiation — it `extends`
> basalt-ui's `DESIGN-CORE.md` and records **deltas only**. The universal law (earned color,
> neutral-by-default, three-tier `--vx-*` tokens, theme-is-data, the chart primitive contract)
> lives in DESIGN-CORE and is **not** repeated here. Touch this file only to confirm identity,
> register the app's series, or record a genuine deviation.

extends: basalt-ui/DESIGN-CORE

## Precedence (when guidance conflicts)

This file's deltas win, then the shared law, then the rules, then any skill:

1. **This file** (`{{APP_NAME}}` DESIGN.md) — app-specific deltas. Highest authority.
2. **DESIGN-CORE** (basalt-ui) — the universal design law.
3. **`basalt-*` rules** (`.claude/rules/basalt-*.md`) — operational enforcement of the law.
4. **Skills** (`/frontend-design`, `/dataviz`, etc.) — generic defaults, lowest authority.

A skill never overrides this file or DESIGN-CORE. When a skill's instinct collides with the law,
the law wins.

## Identity

{{APP_NAME}} inherits the basalt-ui identity verbatim: a calm, dense, dark-first professional
surface — Blueprint v6 palette, one earned accent (blue), neutral grey as the default data ink,
hairline elevation, system-sans carried by size+weight with mono numbers. Confirm or restate any
intentional identity shift here; **silence means "inherits DESIGN-CORE unchanged."**

- **Voltage hue:** {{ACCENT_HUE}} (default: blue — `var(--vx-line)` neutral is still the default
  for single-series marks)
- **Tone deltas from DESIGN-CORE:** _(none — inherits)_

## Series dictionary

The framework owns the **roles** and the **available hues** (see DESIGN-CORE › Colors). This table
is the app's **data dictionary** — which metric maps to which hue, as `{light,dark}` pairs, wired
through `defineSeries()` (`basalt-ui/charts`). This is the one design artifact that legitimately
lives in the consumer; keep it the single source of truth and never inline a hex elsewhere.

| Series name | Light hex | Dark hex | `defineSeries` key | Role / earned reason |
|-|-|-|-|-|
| _e.g. requests_ | `#2d72d2` | `#4c90f0` | `requests` | Primary metric (identity blue) |
| | | | | |

```ts
// {{SERIES_MODULE_PATH}} — the app's guard-exempt series file
import { defineSeries } from 'basalt-ui/charts'

export const { css: SERIES_CSS, tokens: series } = defineSeries({
  // requests: { light: '#2d72d2', dark: '#4c90f0' },
})
// feed SERIES_CSS to BasaltProvider's palette; read `series.requests` in charts.
```

Rules for this table (from DESIGN-CORE — do not relax):
- One hue per series, drawn from the identity families only. Never raw Material/AntD/Tailwind.
- A series earns a color only for **trend**, **signal/status**, or **categorical separation**.
  A lone single-series metric stays neutral (`var(--vx-line)`).
- Light is one shade **deeper**, dark one shade **lighter** — same hue, never the same hex.

## App deviations

Genuine, intentional departures from DESIGN-CORE — each with a one-line justification. An empty
section is the correct default; do not invent deviations to fill it.

- _(none yet)_
