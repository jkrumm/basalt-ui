# playground — Design

> Seeded from basalt-ui's `agent/templates/DESIGN.md.tpl`, then owned here — `sync` never touches
> it again, and no version is stamped here (run `basalt-ui doctor` for the version; a number written
> into a file is frozen at scaffold time). It records this app's **deltas only**: the law lives in
> `.claude/rules/basalt-*.md`, and the precedence between this file, those rules and the skills is
> stated once in `CLAUDE.md`.

## Identity

The playground inherits the basalt-ui identity verbatim, and every value behind it is DERIVED from
the theme's config knobs (see the `basalt-tokens` rule) — so nothing here restates one. **Silence
means "inherits the basalt-ui defaults unchanged."**

- **Accent hue:** default (the shipped seed; a single-series mark stays neutral)
- **Theme knobs:** _(none — `createBasaltTheme()` bare)_ — every `derive`/`fonts`/`radius`/`density`
  level is 0, the everyday-iteration surface for the package's own defaults.

## Series dictionary

The framework owns the roles and the available hues; this table is the app's **data dictionary** —
which metric maps to which hue, as `{ light, dark }` pairs wired through `defineSeries()`.

| Series name              | `defineSeries` key       | Role / earned reason                                                   |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| _demo series (multiple)_ | see `src/demo/series.ts` | Chart-kind demo pages — categorical separation, not one metric's trend |

```ts
// apps/playground/src/demo/series.ts — the app's guard-exempt series file
import { defineSeries, groupTokens } from 'basalt-ui/charts'
export const DEMO_SERIES = defineSeries({
  /* … demo series, see the file itself */
})
export const demoColors = groupTokens(DEMO_GROUP, DEMO_SERIES)
```

A series earns a color only for trend, signal/status or categorical separation. `/basalt-design` is
the tuning loop; `/basalt-charts` is the wiring.

## App deviations

Intentional departures from the defaults, each with a one-line justification. Empty is correct.

- _(none — the playground is deliberately the package's own defaults, unmodified)_
