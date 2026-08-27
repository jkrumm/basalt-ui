# {{APP_NAME}} — Design

> Seeded by basalt-ui `init`, then owned by you — `sync` never touches it again, and no version is
> stamped here (run `basalt-ui doctor` for the version; a number written into a file is frozen at
> scaffold time). It records this app's **deltas only**: the law lives in `.claude/rules/basalt-*.md`,
> and the precedence between this file, those rules and the skills is stated once in `CLAUDE.md`.

## Identity

{{APP_NAME}} inherits the basalt-ui identity verbatim, and every value behind it is DERIVED from the
theme's config knobs (see the `basalt-tokens` rule) — so nothing here restates one. **Silence means
"inherits the basalt-ui defaults unchanged."**

- **Accent hue:** {{ACCENT_HUE}} (default: the shipped seed; a single-series mark stays neutral)
- **Theme knobs:** _(none — `createBasaltTheme()` bare)_ · record any non-zero `derive`/`fonts`/
  `radius`/`density` level here, with its reason.

## Series dictionary

The framework owns the roles and the available hues; this table is the app's **data dictionary** —
which metric maps to which hue, as `{ light, dark }` pairs wired through `defineSeries()`. It is the
one design artifact that legitimately lives in the consumer; never inline a color elsewhere.

| Series name      | `defineSeries` key | Role / earned reason               |
| ---------------- | ------------------ | ---------------------------------- |
| _e.g. requests_  | `requests`         | Primary metric (earned trend hue)  |

```ts
// {{SERIES_MODULE_PATH}} — the app's guard-exempt series file
import { defineSeries, groupTokens } from 'basalt-ui/tokens'
const SERIES_MAP = defineSeries({
  // requests: { light: '…', dark: '…' },   // deeper on light, lighter on dark — never one value
})
export const series = groupTokens('app', SERIES_MAP) // { requests: 'var(--vx-app-requests)', … }
export const paletteGroups = { 'app-': SERIES_MAP } // the trailing dash is a CSS-var prefix
// <BasaltProvider paletteOptions={{ groups: paletteGroups }} …/> — then charts read `series.requests`
```

A series earns a color only for trend, signal/status or categorical separation. `/basalt-design` is the tuning loop; `/basalt-charts` is the wiring.

## App deviations

Intentional departures from the defaults, each with a one-line justification. Empty is correct.

- _(none yet)_
