/**
 * Guard types — Mantine-free, dependency-free (zero imports beyond TS types).
 *
 * GuardKind is the closed set of 13 violation kinds the theme guard can emit.
 * Finding is the structured result per violation, replacing the old `Violation` shape.
 * GuardConfig is the per-run configuration that drives checkSource.
 */

/** The 13 theme-guard violation kinds. */
export type GuardKind =
  | 'raw-hex'
  | 'raw-color-fn'
  | 'localstorage-theme'
  | 'off-identity-accent'
  | 'raw-spacing'
  | 'raw-radius'
  | 'raw-surface'
  | 'off-system-surface-var'
  | 'raw-html-layout'
  | 'inline-spacing'
  | 'inline-display'
  | 'raw-visx-axis'
  | 'raw-motion-value'

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
  /** Off-identity Mantine accent families forbidden as chrome accents. */
  readonly forbiddenAccents: readonly string[]
  /** Flag ad-hoc inline surface styling (border/borderRadius/boxShadow literals). Default true. */
  readonly rawSurface: boolean
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
   * Allow-comment policy: a line containing this substring is skipped entirely.
   * Default 'theme-allow'. Pure-comment lines (// * /\*) are always skipped.
   */
  readonly allowComment: string
}
