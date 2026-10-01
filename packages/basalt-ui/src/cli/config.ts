// The `basalt` config shape and helpers, shared by the dispatcher and `--audit-allows`. A leaf: it
// imports nothing from `./index`, so audit-allows → index → check-theme → audit-allows is no cycle.
import type { GuardKind, GuardSeverity } from '../guard'

/** Shape of the optional `"basalt"` key in a consumer's package.json. */
export type BasaltConfig = {
  /** Source roots to scan. Default: `['src']`. Set explicitly for a monorepo layout. */
  roots?: string[]
  /** Files exempt from the scan (they ARE the palette source). Default: argo's exempt set. */
  exempt?: string[]
  /**
   * Declares this package a tokens-only consumer: it uses the `--vx-*` layer and no Mantine. Turns
   * off every guard kind whose remedy is a Mantine component, a Mantine prop or the React theme
   * factory, leaving the color and typography kinds live. Default: `'mantine'`.
   *
   * Deliberately not inferred from a missing `@mantine/core`: silencing 17 rules (the live count is
   * `TOKENS_ONLY_DISABLED_KINDS.size`, which the check-theme banner prints) is a decision, and
   * a repo that keeps Mantine in a workspace package would otherwise switch off half its own guard
   * without saying so. `basalt-ui doctor` detects the shape and tells you to set this.
   */
  profile?: 'mantine' | 'tokens-only'
  /**
   * Extra files to scan, named individually and relative to this package — for a design surface
   * that lives outside every root and outside the `index.html` / `public/` conventions the walker
   * already derives. Also the ONLY way a `.json` is ever scanned: the guard understands JSON as
   * markup, but a consumer repo's JSON is overwhelmingly config, fixtures and lockfiles, so
   * blanket-scanning it is a false-positive generator rather than a guard.
   *
   * @example
   * { include: ['app/manifest.json', 'emails/template.html'] }
   */
  include?: string[]
  /** Named spacing-scale steps (px) flagged when used as a raw spacing prop. Default: 10/12/16/20/32. */
  spacingSteps?: number[]
  /** Per-kind severity override — `'warn'` reports without failing, `'error'` fails the build.
   *  See `GuardSeverity` in ../guard/types for the grace-minor doctrine behind it. */
  severity?: Partial<Record<GuardKind, GuardSeverity>>
  /** Off-identity Mantine accent families forbidden as chrome accents. Default: argo's set. */
  forbiddenAccents?: string[]
  /** Earned accent hue recorded in DESIGN.md `{{ACCENT_HUE}}`. Default: `blue`. */
  accentHue?: string
  /**
   * Flag any numeric radius prop literal (radius={6}) — use the radius token scale instead.
   * Default: `true` (ON). Set `false` to disable the `raw-radius` check (e.g. a repo that DEFINES
   * the radius primitives).
   */
  rawRadius?: boolean
  /**
   * Flag ad-hoc inline surface styling (`border`/`borderRadius`/`boxShadow` literals in a `style={{}}`)
   * that bypasses the radius-token + `VX.surface.*` + `VX.shadowCard` system. Default: `true` (ON).
   * Set `false` to disable the `raw-surface` check.
   */
  rawSurface?: boolean
  /**
   * Flag `withBorder` on a `Card` / `Paper`. Card depth is `--vx-shadow-card` — a whisper shadow
   * with the 1px ring baked into the SAME value — so `withBorder` draws a SECOND, real border over
   * that ring and the card reads heavy/boxed (docs/DESIGN-SPEC.md doctrine inversion #1).
   * `withBorder={false}` and `<Card.Section withBorder>` (a section divider) both pass.
   * Default: `true` (ON). Set `false` to disable the `card-with-border` check.
   */
  cardWithBorder?: boolean
  /**
   * Flag references to a raw Mantine ramp step used for surface color
   * (`var(--mantine-color-gray-N)` / `var(--mantine-color-dark-N)`) — these bypass the basalt
   * surface tokens. Default: `true` (ON). Set `false` to disable the `off-system-surface-var` check.
   */
  offSystemSurfaceVar?: boolean
  /**
   * Flag a SHADE-PINNED Mantine color — `c="yellow.7"`, `bg="blue.4"`,
   * `var(--mantine-color-red-6)`. A pinned step is one fixed swatch in BOTH color schemes, so it
   * cannot stay legible in either; route a verdict color through `VX.status.*` / `--vx-status-*`,
   * or drop the index (`c="red"`) and let the theme resolve the shade per scheme. `gray-*`/`dark-*`
   * in `var()` form belong to `off-system-surface-var` instead. Default: `true` (ON). Set `false`
   * to disable the `mantine-shade-index` check.
   */
  mantineShadeIndex?: boolean
  /**
   * Flag raw lowercase JSX layout/surface elements (`div`/`span`/`section`/…) carrying an inline
   * `style={{}}` with a layout/surface property — steer to a Mantine layout primitive
   * (`Box`/`Flex`/`Grid`/`Stack`/`Group`/`SimpleGrid`/`Paper`). Default: `true` (ON). Set `false`
   * to disable the `raw-html-layout` check.
   */
  rawHtmlLayout?: boolean
  /**
   * Flag spacing/sizing literals inside an inline `style={{}}` (`padding`/`margin`/`gap`/…) — the
   * `raw-spacing` check only catches the Mantine prop syntax. Default: `true` (ON). Set `false` to
   * disable the `inline-spacing` check.
   */
  inlineSpacing?: boolean
  /**
   * Flag `display: 'flex' | 'grid' | 'inline-flex' | 'inline-grid'` in an inline `style={{}}` —
   * steer to `<Flex>`/`<Grid>`/`<Group>`. Default: `true` (ON). Set `false` to disable the
   * `inline-display` check.
   */
  inlineDisplay?: boolean
  /**
   * Flag raw `<AxisLeft>` / `<AxisBottom>` / `<AxisRight>` visx JSX inside chart files (a path
   * containing `/charts/`) — these bypass the `AxisLeftNumeric` / `AxisBottomDate` /
   * `AxisRightNumeric` primitives that carry the theme tokens + smart ticks. The legitimate wrapper
   * (`Axes.tsx`, which IS the primitive) is exempt. Default: `true` (ON). Set `false` to disable the
   * `raw-visx-axis` check.
   */
  rawVisxAxis?: boolean
  /**
   * Flag a hardcoded duration/spring/ease literal inline in a `transition={{...}}` prop — route it
   * through `MOTION_DURATION` / `MOTION_SPRING` / `MOTION_EASE_STANDARD` instead. Default: `true`
   * (ON). Set `false` to disable the `raw-motion-value` check.
   */
  rawMotionValue?: boolean
  /**
   * Flag a chart entry-point JSX tag (`MultiLine`/`Bars`/`Donut`/`DualPanel`/`Heatmap`/`ZonedLine`/
   * `StackedArea`/`LineSparkline`/`BarSparkline`) missing an `ariaLabel` prop. Default: `true`
   * (ON). Set `false` to disable the `chart-missing-aria-label` check.
   */
  chartMissingAriaLabel?: boolean
  /**
   * Flag a raw lowercase `<input>`/`<select>`/`<textarea>` JSX element — it bypasses the entire
   * theme, not just the iOS font-size floor. Use the Mantine equivalents (`TextInput`,
   * `NumberInput`, `Select`, `Textarea`, …) instead. Default: `true` (ON). Set `false` to disable
   * the `raw-form-control` check.
   */
  rawFormControl?: boolean
  /**
   * Flag a `fontSize`/`font-size` literal below 16 inside a `style={{…}}` on a raw form control,
   * or a Mantine `styles={{ input: {…} }}` per-part style — the `styles.css` iOS floor is
   * `!important`, so the override is dead code. Default: `true` (ON). Set `false` to disable the
   * `sub-16-input-font` check.
   */
  sub16InputFont?: boolean
  /**
   * Path of the consumer's guard-exempt series file, for DESIGN.md `{{SERIES_MODULE_PATH}}`.
   * Default: `<first basalt.root>/lib/series.ts` — see `resolveSeriesModulePath`.
   */
  seriesModulePath?: string
  /**
   * Per-rule, per-path exemptions — complements whole-file `exempt` (which skips ALL rules for a
   * file) and the hardcoded per-kind `appliesTo` scoping (e.g. `raw-visx-axis` → chart files
   * only). Each value is a list of patterns matched against a finding's relative path. A pattern
   * may be a whole path segment (`'agent'` matches `src/agent/x.tsx`, not `src/agenting.ts`), a
   * relative path (`'public/site.webmanifest'`), a directory prefix, or a glob — `*` stops at `/`,
   * `**` does not, and a slash-free glob also matches the basename, so `'*.module.css'` works.
   * A trailing `/` is stripped. An entry that suppresses nothing is reported, and
   * `check-theme --audit-allows` exits 1 on it. Default: `{}` (no exemptions).
   *
   * Two forms per kind. The bare array is paths only. The object form adds the REASON, which is
   * the half a `theme-allow` carries and this key could not: JSON has no comments, so a
   * `.webmanifest` / `.json` finding's only escape is this key, and it was un-reviewable by
   * construction — the rationale ended up in a CLAUDE.md paragraph nobody reads next to the diff.
   * `check-theme --audit-allows` prints the reason (or names its absence) beside what the entry
   * still suppresses. The array form stays supported and unchanged; nothing here is required.
   *
   * @example
   * { exemptRules: { 'inline-display': ['agent'] } } // inline-display never fires under src/agent/**
   * @example
   * { exemptRules: { 'raw-hex': { paths: ['site.webmanifest'],
   *   reason: 'a PWA manifest theme_color MUST be a literal hex — JSON cannot reference a CSS var' } } }
   */
  exemptRules?: Partial<Record<GuardKind, ExemptRuleEntry>>
  /**
   * Declares an intentional `ai` package major-version skew across workspace packages, exempting
   * `doctor`'s `ai-major-parity` hard check. The value IS the reason — a bare `true` is rejected,
   * because the whole point of this key is that the pairing is written down, not just switched off.
   * A written declaration is the pin `basalt/ai-sdk-major`'s own comment notes is otherwise missing.
   *
   * Semantics: absent (or present but not a non-empty string) → the skew still hard-fails exactly as
   * without this key. A non-empty string with a skew present → `doctor` passes, echoing both the
   * skew and this reason. A non-empty string with NO skew present → `doctor` warns that the
   * exemption is stale and can be deleted (an exemption nobody re-checks is how a real, later skew
   * slips through unnoticed).
   *
   * @example
   * // apps/api streams on ai@5; apps/dashboard parses on ai@7; a producer-side TransformStream
   * // neutralizes the one enum value that differs between the two majors.
   * { aiMajorSkewReason: 'apps/api pinned to ai@5, apps/dashboard on ai@7 — the skew is neutralized '
   *   + 'by a producer-side TransformStream in apps/api/src/stream-transform.ts' }
   */
  aiMajorSkewReason?: string
}

/**
 * One `basalt.exemptRules` value: the historical bare path list, or the same list with the reason
 * it exists. See `BasaltConfig.exemptRules`.
 */
export type ExemptRuleEntry = string[] | { paths: string[]; reason: string }

/** The paths half of an exemption entry, whichever form it was written in. */
export function exemptRulePaths(entry: ExemptRuleEntry | undefined): string[] {
  if (entry === undefined) return []
  return Array.isArray(entry) ? entry : entry.paths
}

/** The recorded reason for an exemption entry, or null for the bare-array form. */
export function exemptRuleReason(entry: ExemptRuleEntry | undefined): string | null {
  if (entry === undefined || Array.isArray(entry)) return null
  return entry.reason.trim().length > 0 ? entry.reason.trim() : null
}

export const DEFAULT_ROOT = 'src'
export const DEFAULT_ROOTS = [DEFAULT_ROOT]

/**
 * The configured source roots, or the built-in default. The ONE resolution every roots-derived seed
 * reads — an empty `roots: []` falls back rather than resolving to nothing, because a bare `??`
 * would let `[]` through and render an empty oxfmt glob into the seeded CI, reproducing the exact
 * "matches zero files" break this derivation exists to prevent.
 */
export function resolveRoots(cfg: BasaltConfig): string[] {
  return cfg.roots?.length ? cfg.roots : DEFAULT_ROOTS
}
