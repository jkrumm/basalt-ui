/**
 * ./guard — headless policy core. Mantine-free, dependency-free.
 *
 * GUARD_RULES: the closed registry of all 18 violation kinds.
 * checkSource:  pure (text, relPath, cfg) → Finding[]. No FS, no walk, no console.
 */
import type { Finding, GuardConfig, GuardKind } from './types'

export type { Finding, GuardConfig, GuardKind }

// ── Static regex consts ──────────────────────────────────────────────────────────────────────────

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const FUNC = /\b(?:rgba?|hsla?)\(/g
const LOCALSTORAGE_THEME = /localStorage\s*\.\s*getItem\s*\(\s*['"]theme['"]\s*\)/g

// Ad-hoc inline surface styling — border* / borderRadius / boxShadow with literal values.
// A var(--…) reference inside the quoted value passes (the system itself).
const SURFACE_BORDER =
  /\bborder(?:Top|Bottom|Left|Right)?\s*:\s*(?!['"`]?[^'"`]*var\()['"`][^'"`]+['"`]/g
const SURFACE_RADIUS = /\bborderRadius\s*:\s*(?:[0-9]+|['"`](?!\s*var\()[^'"`]*[0-9])/g
const SURFACE_SHADOW = /\bboxShadow\s*:\s*(?!['"`]?[^'"`]*var\()['"`][^'"`]+['"`]/g

// A `Card` / `Paper` opening tag carrying `withBorder`. Card depth is `--vx-shadow-card`, whose 1px
// ring lives INSIDE the shadow value; `withBorder` therefore adds a SECOND, real `border` property
// on top of it (the theme's `styles.root` pins bg/shadow/radius but never clears `border`), and the
// card reads heavy/boxed. Bounded full-text tag scan, same shape as CHART_ENTRY_POINT_TAG below, so
// a multi-line-formatted tag still resolves to one match.
//
// Two deliberate non-matches:
//   • `<Card.Section withBorder>` — a section DIVIDER, not card depth. Excluded by the `(?![\w.])`
//     lookahead, which also rejects `<CardHeader>`-style names.
//   • `withBorder={false}` — an explicit opt-out (what the shell's AppShell parts do). Excluded by
//     the lookahead on WITH_BORDER_PROP.
const CARD_SURFACE_TAG = /<(?:Card|Paper)(?![\w.])(?:=>|[^>])*?>/g
const WITH_BORDER_PROP = /\bwithBorder\b(?!\s*=\s*\{\s*false\s*\})/

// Raw Mantine ramp step used for surface color — gray/dark + a step digit.
const OFF_SYSTEM_SURFACE_VAR = /var\(--mantine-color-(gray|dark)-\d/g

// Raw lowercase JSX layout/surface element with inline style and layout/surface prop — line-scoped.
const RAW_HTML_TAG = /<(?:div|span|section|header|nav|footer|aside|main|article|ul|ol)\b/
const INLINE_STYLE = /style=\{\{/
const LAYOUT_SURFACE_PROP =
  /\b(?:display|padding|margin|gap|flex|grid|border|background|width|height)\b/

// Spacing/sizing literals in inline style={{}} — anchored on property name; var() or 0 pass.
const INLINE_SPACING =
  /\b(?:padding(?:Top|Bottom|Left|Right)?|margin(?:Top|Bottom|Left|Right)?|gap|rowGap|columnGap)\s*:\s*(?!var\()['"]?-?(?!0\b)\d/g

// display:flex/grid/inline-flex/inline-grid in an inline style.
const INLINE_DISPLAY = /\bdisplay\s*:\s*['"](?:inline-)?(?:flex|grid)['"]/g

// Raw visx axis JSX — only inside chart files, not in the Axes.tsx wrapper.
const RAW_VISX_AXIS = /<Axis(?:Left|Bottom|Right)\b/g
const AXIS_WRAPPER_FILE = /(?:^|\/)Axes\.tsx$/

// radius prop with a numeric literal (module-level so it is not re-created per call).
const RADIUS_PROP_RE = /\bradius=(?:\{[0-9]+\}|"[0-9]+")/g

// Hardcoded motion transition params — a duration/spring/ease literal inline in `transition={{}}`
// instead of the shared MOTION_DURATION / MOTION_SPRING / MOTION_EASE_STANDARD tokens.
const MOTION_TRANSITION_NUMERIC =
  /\btransition\s*=\s*\{\{[^}]*\b(?:duration|stiffness|damping|mass)\s*:\s*-?\d/g
const MOTION_TRANSITION_EASE_ARRAY = /\btransition\s*=\s*\{\{[^}]*\bease\s*:\s*\[/g

// A hand-rolled <ChartLegend items={[ …array literal… ]}> — legend entries authored inline
// instead of derived (`items={deriveLegend(series)}`, a call expression, which must NOT match).
// Scoped to the JSX tag itself ([^>]* is bounded by the tag's own closing `>`, which also makes
// this a full-text scan rather than the per-line style every other kind uses — a multi-line-
// formatted <ChartLegend ...\n  items={[...\n/> still resolves to one match). Bounded scans over
// text this small are not a performance concern.
const RAW_CHART_LEGEND_ARRAY = /<ChartLegend\b[^>]*?\bitems\s*=\s*\{\s*\[/g

// A chart entry-point JSX tag (the 7 kinds + 2 sparklines) — full opening/self-closing tag,
// scanned for a missing `ariaLabel` prop (an accessible text alternative for the SVG graphic).
// Bounded, full-text scan (like RAW_CHART_LEGEND_ARRAY above) so a multi-line-formatted tag still
// resolves to one match. The scan must survive two `>` decoys inside an opening tag: an explicit
// JSX generic argument (`<MultiLine<Point>`) — consumed by the optional `<[^<>]*>` group — and
// arrow functions in prop expressions (`getX={(d) => d.date}`) — consumed atomically by the `=>`
// alternative so their `>` never terminates the tag early. A bare `>` comparison inside a prop
// expression still ends the match (accepted limitation of the bounded scan).
const CHART_ENTRY_POINT_TAG =
  /<(?:MultiLine|Bars|Donut|DualPanel|Heatmap|ZonedLine|StackedArea|LineSparkline|BarSparkline)\b(?:<[^<>]*>)?(?:=>|[^>])*?>/g
const HAS_ARIA_LABEL_PROP = /\bariaLabel\s*=/

// Raw lowercase form-control element — line-scoped, same shape as RAW_VISX_AXIS. `\b` after the
// tag name rejects a same-prefixed custom component (`<inputRef`, `<selectAll`).
const RAW_FORM_CONTROL = /<(?:input|select|textarea)\b/g

// A raw form-control's own opening tag — bounded full-text scan (same shape as CARD_SURFACE_TAG /
// CHART_ENTRY_POINT_TAG), used ONLY by sub-16-input-font to search the tag's own inline `style`
// for a sub-floor fontSize.
const RAW_FORM_CONTROL_TAG = /<(?:input|select|textarea)\b(?:=>|[^>])*?>/g

// A Mantine `styles={{ input: {...} }}` per-part style — the `input` key specifically targets the
// rendered <input>/<textarea> part of TextInput/Select/Textarea/etc. Requires `input` be the FIRST
// key in the styles object (see the sub-16-input-font doc comment for the scoping trade-off this
// implies) so an unrelated object that happens to carry an `input` key elsewhere in consumer code
// is never mistaken for a Mantine per-part style. `[^}]*` stops at the first `}`, i.e. the close of
// the `input` sub-object (or its first nested object) — either way any fontSize inside is still
// genuinely part of the input's own styling.
const STYLES_INPUT_PART = /\bstyles\s*=\s*\{\{\s*input\s*:\s*\{([^}]*)\}/g

// A fontSize/font-size value below the 16px floor. Unitless numbers and an explicit `px` suffix
// both count as px (React inline-style convention); any other unit (rem/em/%) is deliberately NOT
// matched — ambiguous relative to a *px* floor, and matching it would risk a false positive.
const SUB_16_FONT_SIZE = /font-?[Ss]ize\s*:\s*['"]?(-?\d+(?:\.\d+)?)(?:px)?['"]?(?=[,\s}]|$)/g

// ── Defaults ─────────────────────────────────────────────────────────────────────────────────────

/** Default spacing steps (px) flagged as raw spacing props. */
const DEFAULT_SPACING_STEPS: readonly number[] = [10, 12, 16, 20, 32]
/** Default off-identity Mantine accent families. */
const DEFAULT_FORBIDDEN_ACCENTS: readonly string[] = ['teal', 'violet', 'grape', 'indigo', 'pink']

/** Shared default config — CLI and tests import this to avoid duplication. */
export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  spacingSteps: DEFAULT_SPACING_STEPS,
  rawRadius: true,
  forbiddenAccents: DEFAULT_FORBIDDEN_ACCENTS,
  rawSurface: true,
  cardWithBorder: true,
  offSystemSurfaceVar: true,
  rawHtmlLayout: true,
  inlineSpacing: true,
  inlineDisplay: true,
  rawVisxAxis: true,
  rawMotionValue: true,
  unframedChart: true,
  chartMissingAriaLabel: true,
  rawFormControl: true,
  sub16InputFont: true,
  allowComment: 'theme-allow',
}

// ── Path predicate ────────────────────────────────────────────────────────────────────────────────

function isChartFile(relPath: string): boolean {
  return relPath.includes('/charts/') && !AXIS_WRAPPER_FILE.test(relPath)
}

/**
 * The skip policy the per-line loop applies inline, reused by the full-text tag-scoped scans
 * (which resolve their own report line and so must re-check it): a line carrying the allow-comment,
 * or a pure-comment line, is never a violation.
 */
function isSkippedLine(line: string, cfg: GuardConfig): boolean {
  if (line.includes(cfg.allowComment)) return true
  const trimmed = line.trimStart()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

// ── GUARD_RULES registry ─────────────────────────────────────────────────────────────────────────

type GuardRule = {
  readonly kind: GuardKind
  /** Static regex, or a builder over cfg for the 3 dynamic kinds (forbiddenAccent/spacing/radius). */
  readonly pattern: RegExp | ((cfg: GuardConfig) => RegExp)
  /** Path-applicability: raw-visx-axis only fires in chart files. */
  readonly appliesTo?: (relPath: string) => boolean
  /** Knob gating; always-on kinds omit this. */
  readonly enabled?: (cfg: GuardConfig) => boolean
  /** Per-kind fix-hint message. */
  readonly message: string
}

/**
 * The closed registry of all 18 guard kinds. The triad test asserts
 * `surface.guardKinds ⊆ keyof GUARD_RULES` at runtime.
 *
 * raw-surface, raw-html-layout, and sub-16-input-font are handled inline in checkSource
 * (multi-regex / multi-condition / full-text tag-scoped); all other kinds map to a single pattern
 * entry.
 *
 * This file and `src/cli/index.ts` are `exempt` in the package's own `basalt` config, and must
 * stay that way: a rule's `pattern` and its `message` both spell the anti-pattern out literally
 * (`'Raw <input>/<select>/<textarea> …'`), so the guard flags its own definitions when the package
 * self-scans. Any kind matching a literal tag hits this — `raw-visx-axis` only escaped it by
 * accident, via an `appliesTo` that happens to exclude non-chart files. Fixture files are already
 * covered by the scanner's own `SKIP` (`*.test.ts`), for the same reason.
 */
export const GUARD_RULES = {
  'raw-hex': {
    kind: 'raw-hex',
    pattern: HEX,
    message: 'Route color through VX.* / the Mantine theme.',
  },
  'raw-color-fn': {
    kind: 'raw-color-fn',
    pattern: FUNC,
    message: 'Route color through VX.* / the Mantine theme; for opacity use alpha(token, a).',
  },
  'localstorage-theme': {
    kind: 'localstorage-theme',
    pattern: LOCALSTORAGE_THEME,
    message: 'Theme must resolve via the Mantine color scheme + --vx-* vars.',
  },
  'off-identity-accent': {
    kind: 'off-identity-accent',
    pattern: (cfg: GuardConfig) =>
      new RegExp(
        `\\b(?:color|c|bg|backgroundColor)\\s*=\\s*\\{?\\s*['"](${cfg.forbiddenAccents.join('|')})['"]`,
        'g',
      ),
    message: 'For an off-identity accent use blue/gray or a status hue (red/green/orange/yellow).',
  },
  'raw-spacing': {
    kind: 'raw-spacing',
    pattern: (cfg: GuardConfig) =>
      new RegExp(
        `\\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)=\\{(?:${cfg.spacingSteps.join('|')})\\}`,
        'g',
      ),
    message: 'Use the Mantine spacing prop/token (p/m/gap with xs..xl).',
  },
  'raw-radius': {
    kind: 'raw-radius',
    pattern: RADIUS_PROP_RE,
    enabled: (cfg: GuardConfig) => cfg.rawRadius,
    message: 'Use the radius token (radius="md") instead of a numeric literal.',
  },
  'raw-surface': {
    kind: 'raw-surface',
    pattern: SURFACE_BORDER, // handled inline; this entry exists so the registry is complete
    enabled: (cfg: GuardConfig) => cfg.rawSurface,
    message:
      'Inline border/radius/shadow on a surface — a card already carries its depth (VX.shadowCard) and shape (var(--vx-radius-card)) from the theme; use VX.surface.* / a radius token instead.',
  },
  'card-with-border': {
    kind: 'card-with-border',
    pattern: CARD_SURFACE_TAG, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.cardWithBorder,
    message:
      'withBorder on a Card/Paper double-draws the edge — card depth is --vx-shadow-card, which already bakes a 1px ring into the shadow. Drop the prop (docs/DESIGN-SPEC.md doctrine inversion #1).',
  },
  'off-system-surface-var': {
    kind: 'off-system-surface-var',
    pattern: OFF_SYSTEM_SURFACE_VAR,
    enabled: (cfg: GuardConfig) => cfg.offSystemSurfaceVar,
    message:
      'Raw Mantine ramp step bypasses the basalt surface tokens — use VX.surface.* / --vx-surface-* instead.',
  },
  'raw-html-layout': {
    kind: 'raw-html-layout',
    pattern: RAW_HTML_TAG, // handled inline (3-condition conjunction); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.rawHtmlLayout,
    message:
      'Raw HTML element with inline layout/surface styling — use a Mantine layout primitive (Box/Flex/Grid/Stack/Group).',
  },
  'inline-spacing': {
    kind: 'inline-spacing',
    pattern: INLINE_SPACING,
    enabled: (cfg: GuardConfig) => cfg.inlineSpacing,
    message: 'Inline spacing literal — use the Mantine spacing prop/token (p/m/gap with xs..xl).',
  },
  'inline-display': {
    kind: 'inline-display',
    pattern: INLINE_DISPLAY,
    enabled: (cfg: GuardConfig) => cfg.inlineDisplay,
    message: 'Use <Flex>/<Grid>/<Group> instead of an inline display:flex/grid.',
  },
  'raw-visx-axis': {
    kind: 'raw-visx-axis',
    pattern: RAW_VISX_AXIS,
    enabled: (cfg: GuardConfig) => cfg.rawVisxAxis,
    appliesTo: isChartFile,
    message:
      'Raw <AxisLeft>/<AxisBottom>/<AxisRight> in a chart file — use AxisLeftNumeric / AxisBottomDate / AxisRightNumeric.',
  },
  'raw-motion-value': {
    kind: 'raw-motion-value',
    pattern: MOTION_TRANSITION_NUMERIC, // handled inline (2-regex kind); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.rawMotionValue,
    message:
      'Route animation timing through MOTION_DURATION / MOTION_SPRING / MOTION_EASE_STANDARD (basalt-ui motion tokens) instead of a hardcoded duration/spring/ease.',
  },
  'unframed-chart': {
    kind: 'unframed-chart',
    pattern: RAW_CHART_LEGEND_ARRAY, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.unframedChart,
    message:
      'Hand-rolled ChartLegend built from an inline array literal — pass a derived legend (deriveLegend(series)), or compose ChartFrame, which derives it for you.',
  },
  'chart-missing-aria-label': {
    kind: 'chart-missing-aria-label',
    pattern: CHART_ENTRY_POINT_TAG, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.chartMissingAriaLabel,
    message:
      'Chart has no accessible text alternative — pass ariaLabel="…" so screen readers get more than an unlabeled graphic.',
  },
  'raw-form-control': {
    kind: 'raw-form-control',
    pattern: RAW_FORM_CONTROL,
    enabled: (cfg: GuardConfig) => cfg.rawFormControl,
    message:
      'Raw <input>/<select>/<textarea> bypasses the ENTIRE theme, not just the font-size floor — no field surface, no shadow-card depth, no focus ring, no --input-* vars. Use TextInput / NumberInput / Select / Textarea from @mantine/core, or variant="unstyled" for a genuinely borderless/bespoke look.',
  },
  'sub-16-input-font': {
    kind: 'sub-16-input-font',
    pattern: SUB_16_FONT_SIZE, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.sub16InputFont,
    message:
      'fontSize below 16 on a form control is dead code — the styles.css iOS floor is `!important` and always wins. Either drop the override, or be honest about 16px in the design.',
  },
} as const satisfies Record<GuardKind, GuardRule>

// ── checkSource ───────────────────────────────────────────────────────────────────────────────────

/**
 * Scan ONE file's text for theme-guard violations. Pure: same (text, relPath, cfg) → same Finding[].
 * No FS, no walk, no console. The 3 dynamic regexes (forbiddenAccent, spacing, radius) are derived
 * INTERNALLY from cfg. isChartFile(relPath) is applied internally so the oxlint-plugin /
 * PreToolUse-hook adapters get correct kind-applicability for free.
 *
 * @example
 * const findings = checkSource(src, 'src/Dashboard.tsx', DEFAULT_GUARD_CONFIG)
 * if (findings.some((f) => f.kind === 'raw-hex')) { ... }
 */
export function checkSource(text: string, relPath: string, cfg: GuardConfig): Finding[] {
  const findings: Finding[] = []

  // Derive the 3 dynamic regexes via GUARD_RULES pattern builders.
  const forbiddenAccentRe = (
    GUARD_RULES['off-identity-accent'].pattern as (cfg: GuardConfig) => RegExp
  )(cfg)
  const spacingPropRe = (GUARD_RULES['raw-spacing'].pattern as (cfg: GuardConfig) => RegExp)(cfg)
  // raw-radius uses a static pattern (module const) — clone via source + flags to reset lastIndex.
  const radiusPropRe = new RegExp(
    (GUARD_RULES['raw-radius'].pattern as RegExp).source,
    (GUARD_RULES['raw-radius'].pattern as RegExp).flags,
  )

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    // Skip lines with the allow-comment or pure-comment lines.
    if (line.includes(cfg.allowComment)) continue
    const trimmed = line.trimStart()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // Always-on kinds (raw-hex, raw-color-fn, localstorage-theme) — patterns from GUARD_RULES.
    for (const m of line.matchAll(GUARD_RULES['raw-hex'].pattern as RegExp)) {
      findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-hex' })
    }
    for (const m of line.matchAll(GUARD_RULES['raw-color-fn'].pattern as RegExp)) {
      findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-color-fn' })
    }
    for (const m of line.matchAll(GUARD_RULES['localstorage-theme'].pattern as RegExp)) {
      findings.push({ relPath, line: i + 1, token: m[0], kind: 'localstorage-theme' })
    }

    // Dynamic-regex kinds — patterns already resolved above.
    for (const m of line.matchAll(forbiddenAccentRe)) {
      findings.push({ relPath, line: i + 1, token: m[1] ?? '', kind: 'off-identity-accent' })
    }
    for (const m of line.matchAll(spacingPropRe)) {
      findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-spacing' })
    }
    if (GUARD_RULES['raw-radius'].enabled!(cfg)) {
      for (const m of line.matchAll(radiusPropRe)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-radius' })
      }
    }

    // raw-surface: 3 separate regex checks, one kind — gated via GUARD_RULES entry.
    if (GUARD_RULES['raw-surface'].enabled!(cfg)) {
      for (const m of line.matchAll(SURFACE_BORDER)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-surface' })
      }
      for (const m of line.matchAll(SURFACE_RADIUS)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-surface' })
      }
      for (const m of line.matchAll(SURFACE_SHADOW)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-surface' })
      }
    }

    // off-system-surface-var — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['off-system-surface-var'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['off-system-surface-var'].pattern as RegExp)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'off-system-surface-var' })
      }
    }

    // raw-html-layout: 3-condition conjunction on the same line — gated via GUARD_RULES entry.
    if (
      GUARD_RULES['raw-html-layout'].enabled!(cfg) &&
      RAW_HTML_TAG.test(line) &&
      INLINE_STYLE.test(line) &&
      LAYOUT_SURFACE_PROP.test(line)
    ) {
      findings.push({ relPath, line: i + 1, token: '<raw-html style>', kind: 'raw-html-layout' })
    }

    // inline-spacing — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['inline-spacing'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['inline-spacing'].pattern as RegExp)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'inline-spacing' })
      }
    }

    // inline-display — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['inline-display'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['inline-display'].pattern as RegExp)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'inline-display' })
      }
    }

    // raw-visx-axis — pattern + gating + path applicability from GUARD_RULES.
    if (
      GUARD_RULES['raw-visx-axis'].enabled!(cfg) &&
      GUARD_RULES['raw-visx-axis'].appliesTo!(relPath)
    ) {
      for (const m of line.matchAll(GUARD_RULES['raw-visx-axis'].pattern as RegExp)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-visx-axis' })
      }
    }

    // raw-motion-value: 2 separate regex checks, one kind — gated via GUARD_RULES entry.
    if (GUARD_RULES['raw-motion-value'].enabled!(cfg)) {
      for (const m of line.matchAll(MOTION_TRANSITION_NUMERIC)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-motion-value' })
      }
      for (const m of line.matchAll(MOTION_TRANSITION_EASE_ARRAY)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-motion-value' })
      }
    }

    // raw-form-control — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['raw-form-control'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['raw-form-control'].pattern as RegExp)) {
        findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-form-control' })
      }
    }
  }

  // unframed-chart — full-text tag-scoped scan (not per-line, see RAW_CHART_LEGEND_ARRAY comment).
  // Reports at the line of the `items={[` token itself; honors the same theme-allow / pure-comment
  // skip as every per-line kind by checking that reported line directly.
  if (GUARD_RULES['unframed-chart'].enabled!(cfg)) {
    for (const m of text.matchAll(RAW_CHART_LEGEND_ARRAY)) {
      const lineNo = text.slice(0, (m.index ?? 0) + m[0].length).split('\n').length
      if (isSkippedLine(lines[lineNo - 1] ?? '', cfg)) continue
      findings.push({ relPath, line: lineNo, token: 'items={[', kind: 'unframed-chart' })
    }
  }

  // chart-missing-aria-label — full-text tag-scoped scan (same shape as unframed-chart above).
  // A tag is a violation only when its own (possibly multi-line) prop list has no `ariaLabel=`.
  if (GUARD_RULES['chart-missing-aria-label'].enabled!(cfg)) {
    for (const m of text.matchAll(CHART_ENTRY_POINT_TAG)) {
      const tagText = m[0]
      if (HAS_ARIA_LABEL_PROP.test(tagText)) continue
      const lineNo = text.slice(0, (m.index ?? 0) + tagText.length).split('\n').length
      if (isSkippedLine(lines[lineNo - 1] ?? '', cfg)) continue
      findings.push({
        relPath,
        line: lineNo,
        token: tagText.slice(0, 40),
        kind: 'chart-missing-aria-label',
      })
    }
  }

  // card-with-border — full-text tag-scoped scan (same shape as the two above). Reports at the line
  // of the `withBorder` token itself (not the end of the tag) so a multi-line-formatted Card points
  // the fix at the prop to delete.
  if (GUARD_RULES['card-with-border'].enabled!(cfg)) {
    for (const m of text.matchAll(CARD_SURFACE_TAG)) {
      const withBorder = WITH_BORDER_PROP.exec(m[0])
      if (withBorder === null) continue
      const lineNo = text.slice(0, (m.index ?? 0) + withBorder.index).split('\n').length
      if (isSkippedLine(lines[lineNo - 1] ?? '', cfg)) continue
      findings.push({ relPath, line: lineNo, token: 'withBorder', kind: 'card-with-border' })
    }
  }

  // sub-16-input-font — two full-text scans (same shape as the tag-scoped scans above): (a) a raw
  // form-control's own inline `style={{ fontSize: N }}`, (b) a Mantine `styles={{ input: { fontSize:
  // N } }}` per-part style. Either shape is now DEAD CODE against the `!important` floor in
  // styles.css — see the guard's doc comment for exactly which shapes this covers.
  if (GUARD_RULES['sub-16-input-font'].enabled!(cfg)) {
    for (const m of text.matchAll(RAW_FORM_CONTROL_TAG)) {
      const tagText = m[0]
      if (!INLINE_STYLE.test(tagText)) continue
      const fontSizeMatch = [...tagText.matchAll(SUB_16_FONT_SIZE)][0]
      if (fontSizeMatch === undefined) continue
      const value = Number.parseFloat(fontSizeMatch[1] ?? '')
      if (!Number.isFinite(value) || value >= 16) continue
      const lineNo = text.slice(0, (m.index ?? 0) + tagText.length).split('\n').length
      if (isSkippedLine(lines[lineNo - 1] ?? '', cfg)) continue
      findings.push({ relPath, line: lineNo, token: fontSizeMatch[0], kind: 'sub-16-input-font' })
    }

    for (const m of text.matchAll(STYLES_INPUT_PART)) {
      const inputBody = m[1] ?? ''
      const fontSizeMatch = [...inputBody.matchAll(SUB_16_FONT_SIZE)][0]
      if (fontSizeMatch === undefined) continue
      const value = Number.parseFloat(fontSizeMatch[1] ?? '')
      if (!Number.isFinite(value) || value >= 16) continue
      const lineNo = text.slice(0, (m.index ?? 0) + m[0].length).split('\n').length
      if (isSkippedLine(lines[lineNo - 1] ?? '', cfg)) continue
      findings.push({ relPath, line: lineNo, token: fontSizeMatch[0], kind: 'sub-16-input-font' })
    }
  }

  return findings
}
