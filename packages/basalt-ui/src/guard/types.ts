/**
 * Guard types — Mantine-free, dependency-free (zero imports beyond TS types).
 *
 * GuardKind is the closed set of 26 violation kinds the theme guard can emit — `unframed-chart`
 * retired at the C2 consolidation wave: its only case (a hand-authored `<ChartLegend items={[...]}>`
 * array literal) is fully subsumed by the oxlint plugin's `basalt/chart-legend-literal`, which also
 * catches the `.map()`-over-a-non-series form the regex never could. `'unframed-chart'` stays a
 * recognized id in `PLUGIN_RULE_IDS`/`KNOWN_RULE_IDS` so an existing `theme-allow unframed-chart`
 * reads as a dead waiver, not a typo.
 * Finding is the structured result per violation, replacing the old `Violation` shape.
 * GuardConfig is the per-run configuration that drives checkSource.
 */

/** The 26 theme-guard violation kinds. */
export type GuardKind =
  | 'raw-hex'
  | 'raw-color-fn'
  | 'localstorage-theme'
  | 'off-identity-accent'
  | 'mantine-shade-index'
  | 'raw-spacing'
  | 'raw-radius'
  | 'raw-surface'
  | 'card-with-border'
  | 'off-system-surface-var'
  | 'raw-html-layout'
  | 'inline-spacing'
  | 'inline-display'
  | 'raw-visx-axis'
  | 'raw-motion-value'
  | 'chart-missing-aria-label'
  | 'raw-form-control'
  | 'sub-16-input-font'
  | 'raw-font-family'
  | 'theme-allow-unscoped'
  | 'surface-shadow-override'
  | 'css-raw-surface'
  | 'inline-font-size'
  | 'hidden-inline-style'
  | 'in-body-page-title'
  | 'raw-selection-control'

/**
 * How hard a finding lands. `error` fails the build; `warn` reports and passes.
 *
 * The point of `warn` is the LANDING of a new rule, not a permanent tier. basalt-ui bans majors by
 * design — 1.x absorbs breaks — so a consumer has no semver channel telling them enforcement got
 * stricter, and the guard is the part of the framework that can hard-fail their build. A kind that
 * arrives as an error therefore turns a routine minor upgrade into an unplanned refactor: 1.2.0
 * cost the one real consumer eleven `theme-allow` comments, and 1.3.0 had them delete all eleven
 * again — net zero source change, two commits, two production deploys.
 *
 * So: a change that makes the guard reject code it previously accepted — a new kind, or an existing
 * kind reaching a new file type — ships `warn` for one minor, then promotes. The consumer sees it,
 * schedules it, and upgrades on a green build.
 */
export type GuardSeverity = 'warn' | 'error'

/**
 * A structured finding — the chosen testable surface (§C.4). Replaces the old `Violation` type.
 * `relPath` + `line` + `token` + `kind` uniquely identify the violation.
 *
 * @example
 * const findings = checkSource(src, 'src/Dashboard.tsx', DEFAULT_GUARD_CONFIG)
 * findings.filter((f) => f.kind === 'raw-hex')
 */
export type Finding = {
  readonly relPath: string
  readonly line: number
  readonly token: string
  /**
   * The trimmed source line the finding sits on — what a human should read; `token` stays the
   * matched substring for programmatic use. Truncated to 100 characters (with a trailing `…`) so
   * a minified line can't blow up the report.
   */
  readonly text: string
  readonly kind: GuardKind
  /** Resolved per kind from {@link GuardConfig.severity} over the shipped default. */
  readonly severity: GuardSeverity
}

/**
 * Everything a single-file scan needs — no walk, no FS. The 3 dynamic regexes (forbiddenAccent,
 * spacingProp, radiusProp) are DERIVED inside checkSource from cfg, never passed in directly.
 *
 * @example
 * const cfg: GuardConfig = { ...DEFAULT_GUARD_CONFIG, rawSurface: false }
 * const findings = checkSource(text, 'src/Foo.tsx', cfg)
 */
export type GuardConfig = {
  /** Named spacing-scale steps (px) flagged when used as a raw spacing prop. Default [10,12,16,20,32]. */
  readonly spacingSteps: readonly number[]
  /** Flag any numeric radius prop literal (radius={6}). Default true. */
  readonly rawRadius: boolean
  /** Off-identity Mantine accent families forbidden as chrome accents. */
  readonly forbiddenAccents: readonly string[]
  /**
   * Flag a SHADE-PINNED Mantine color — `c="yellow.7"`, `bg="blue.4"`, `var(--mantine-color-red-6)`.
   *
   * This is the sibling of `off-identity-accent`, and the two are deliberately disjoint. That kind
   * polices WHICH hue you reach for and permits the bare status names (`c="red"`, `color="green"`)
   * on purpose: they resolve through the theme, so they flip correctly across color schemes. This
   * kind polices the SHADE INDEX, which does not — a pinned step is one fixed swatch in both
   * schemes, so a `yellow.7` legible on the dark page is the one that fails contrast on the light
   * one. Status color belongs on `VX.status.*` (`--vx-status-warn|bad|good|…`), which is emitted per
   * scheme.
   *
   * `gray-*`/`dark-*` in `var()` form are excluded here because `off-system-surface-var` already
   * owns them (surface color, its own message). Default true.
   */
  readonly mantineShadeIndex: boolean
  /** Flag ad-hoc inline surface styling (border/borderRadius/boxShadow literals). Default true. */
  readonly rawSurface: boolean
  /**
   * Flag `withBorder` on a `Card` / `Paper` — card depth is `--vx-shadow-card` (a whisper shadow
   * with the 1px ring baked into the SAME value), so `withBorder` lands a SECOND, real border on
   * top of that ring and the card reads heavy/boxed (docs/DESIGN-SPEC.md doctrine inversion #1).
   * `withBorder={false}` and `Card.Section withBorder` (a legitimate section divider) both pass.
   * Default true.
   */
  readonly cardWithBorder: boolean
  /** Flag raw Mantine ramp steps used for surface color (var(--mantine-color-gray|dark-N)). Default true. */
  readonly offSystemSurfaceVar: boolean
  /** Flag raw lowercase JSX layout/surface elements with inline layout/surface styles. Default true. */
  readonly rawHtmlLayout: boolean
  /** Flag spacing/sizing literals inside an inline style={{}}. Default true. */
  readonly inlineSpacing: boolean
  /** Flag display:flex|grid|inline-flex|inline-grid in an inline style={{}}. Default true. */
  readonly inlineDisplay: boolean
  /** Flag raw <AxisLeft>/<AxisBottom>/<AxisRight> JSX inside chart files. Default true. */
  readonly rawVisxAxis: boolean
  /** Flag a hardcoded duration/spring/ease literal in a `transition={{...}}` prop. Default true. */
  readonly rawMotionValue: boolean
  /**
   * Flag a chart-kind JSX usage (`<MultiLine>`, `<Bars>`, `<Donut>`, `<DualPanel>`, `<Heatmap>`,
   * `<ZonedLine>`, `<StackedArea>`, `<LineSparkline>`, `<BarSparkline>`) missing an `ariaLabel`
   * prop — screen readers otherwise get an unlabeled empty graphic. Default `true` (ON). Set
   * `false` to disable the `chart-missing-aria-label` check.
   */
  readonly chartMissingAriaLabel: boolean
  /**
   * Flag a raw lowercase `<input>` / `<select>` / `<textarea>` JSX element — it bypasses the
   * ENTIRE theme (no field surface, no `shadow-card` depth, no focus ring, no `--input-*` vars),
   * not just the iOS font-size floor. Use the Mantine equivalents (`TextInput`, `NumberInput`,
   * `Select`, `Textarea`, …) — or `variant="unstyled"` for a genuinely bespoke/borderless look.
   * Default `true` (ON). Set `false` to disable the `raw-form-control` check.
   */
  readonly rawFormControl: boolean
  /**
   * Flag a `fontSize`/`font-size` literal below 16 inside a `style={{…}}` on a raw form control,
   * or a `styles={{ input: {…} }}` Mantine per-part style — the `styles.css` iOS floor is
   * `!important`, so such a declaration is now DEAD CODE that silently does nothing. Scoped to
   * form controls only (a `<Text>`/`<span>`/chart-label `fontSize` below 16 is legitimate and
   * never flagged). Default `true` (ON). Set `false` to disable the `sub-16-input-font` check.
   */
  readonly sub16InputFont: boolean
  /**
   * Allow-comment policy. The token that opens an exception annotation inside a COMMENT, on the
   * finding's own line or the line directly above it (matching the oxlint plugin's placement, and
   * surviving an `oxfmt` reflow that moves the comment off the offending line). Default
   * `'theme-allow'`.
   *
   * The accountable form is `theme-allow <rule-id>[, <rule-id>] — <reason>`: the rule ids scope the
   * exception to those kinds only, and the reason says why. A `theme-allow` missing either half
   * still suppresses (so an upgrade never breaks a build over it) but reports
   * {@link GuardKind} `theme-allow-unscoped` on its own line.
   */
  readonly allowComment: string
  /**
   * Which kinds apply to this consumer. `'mantine'` (default) is the full framework guard.
   *
   * `'tokens-only'` is for a consumer that installs the TOKEN LAYER and nothing else — no
   * `@mantine/core`, often no React (`basalt-ui tokens:css` + `basalt-ui/tokens`). Every kind whose
   * remedy is a Mantine component or prop is disabled there, because "use `TextInput` from
   * `@mantine/core`" is not advice, it is a dependency the consumer deliberately does not have.
   * The color/typography kinds stay on — those are the tokens, which is the whole surface they DO
   * consume. See `TOKENS_ONLY_DISABLED_KINDS` in `./index` for the exact set.
   *
   * Optional so a caller built before this field existed keeps compiling; absent means `'mantine'`.
   */
  readonly profile?: 'mantine' | 'tokens-only'
  /**
   * Per-rule, per-path exemptions — complements whole-file `exempt` (BasaltConfig, which skips
   * ALL rules for a file) and code-level `appliesTo` (hardcoded per-kind path scoping, e.g.
   * raw-visx-axis → chart files only). This is the config-driven counterpart: a consumer can say
   * "kind K does not apply under path P" without exempting the whole file or forking the rule.
   *
   * Each value is a list of path-segment patterns matched against a finding's `relPath`. A pattern
   * matches when `relPath.split('/')` includes it as a WHOLE segment — `'agent'` matches
   * `src/agent/part-list.tsx` but not `src/agenting.ts`. A trailing `/` is stripped before
   * matching, so `'agent'` and `'agent/'` behave identically. Applied as a post-filter over the
   * final findings, so it uniformly covers every kind — both the GUARD_RULES registry loop and the
   * inline-handled kinds (raw-surface, raw-html-layout, sub-16-input-font, …).
   *
   * Required (like every other GuardConfig field, defaulted via DEFAULT_GUARD_CONFIG to `{}`) —
   * `exactOptionalPropertyTypes` rejects the `?? DEFAULT_GUARD_CONFIG.x` pattern used to build a
   * GuardConfig from BasaltConfig (where the field IS optional) if this were optional too.
   *
   * @example
   * { exemptRules: { 'inline-display': ['agent'] } } // inline-display never fires under src/agent/**
   */
  readonly exemptRules: Partial<Record<GuardKind, string[]>>
  /**
   * Per-kind severity override. A kind absent here takes the shipped default, which is `error`
   * for every kind past its grace minor — see {@link GuardSeverity} for why a grace minor exists.
   *
   * Two directions, both legitimate:
   *  • `'warn'` on an `error` kind — a consumer who wants to upgrade now and fix later, on their
   *    own schedule rather than the release's.
   *  • `'error'` on a grace-period kind — a consumer who would rather take the enforcement
   *    immediately than carry a warning for a minor.
   *
   * This is severity, NOT an off switch: every kind already has its own boolean in this config,
   * and `exemptRules` scopes a kind to paths. A kind turned down to `warn` still reports.
   *
   * @example
   * { severity: { 'inline-spacing': 'warn' } } // report, don't fail, while we migrate
   */
  readonly severity: Partial<Record<GuardKind, GuardSeverity>>
}
