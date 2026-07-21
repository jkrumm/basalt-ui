/**
 * Guard types — Mantine-free, dependency-free (zero imports beyond TS types).
 *
 * GuardKind is the closed set of 19 violation kinds the theme guard can emit.
 * Finding is the structured result per violation, replacing the old `Violation` shape.
 * GuardConfig is the per-run configuration that drives checkSource.
 */

/** The 19 theme-guard violation kinds. */
export type GuardKind =
  | 'raw-hex'
  | 'raw-color-fn'
  | 'localstorage-theme'
  | 'off-identity-accent'
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
  | 'unframed-chart'
  | 'chart-missing-aria-label'
  | 'raw-form-control'
  | 'sub-16-input-font'
  | 'raw-font-family'

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
  readonly kind: GuardKind
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
   * Flag a hand-rolled `<ChartLegend items={[...]}>` array literal — legend entries must be
   * derived (e.g. `items={deriveLegend(series)}`), never authored inline, so a bespoke chart
   * can't silently drift from the shared legend. Default `true` (ON). Set `false` to disable the
   * `unframed-chart` check.
   */
  readonly unframedChart: boolean
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
   * Allow-comment policy: a line containing this substring is skipped entirely.
   * Default 'theme-allow'. Pure-comment lines (// * /\*) are always skipped.
   */
  readonly allowComment: string
}
