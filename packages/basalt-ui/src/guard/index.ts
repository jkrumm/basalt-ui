/**
 * ./guard — headless policy core. Mantine-free, dependency-free.
 *
 * GUARD_RULES: the closed registry of all 15 violation kinds.
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
// resolves to one match.
const CHART_ENTRY_POINT_TAG =
  /<(?:MultiLine|Bars|Donut|DualPanel|Heatmap|ZonedLine|StackedArea|LineSparkline|BarSparkline)\b[^>]*?>/g
const HAS_ARIA_LABEL_PROP = /\bariaLabel\s*=/

// ── Defaults ─────────────────────────────────────────────────────────────────────────────────────

/** Default spacing steps (px) flagged as raw spacing props. */
const DEFAULT_SPACING_STEPS: readonly number[] = [10, 12, 16, 20, 32]
/** Default off-identity Mantine accent families. */
const DEFAULT_FORBIDDEN_ACCENTS: readonly string[] = ['teal', 'violet', 'grape', 'indigo', 'pink']

/** Shared default config — CLI and tests import this to avoid duplication. */
export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  spacingSteps: DEFAULT_SPACING_STEPS,
  forbiddenAccents: DEFAULT_FORBIDDEN_ACCENTS,
  rawSurface: true,
  offSystemSurfaceVar: true,
  rawHtmlLayout: true,
  inlineSpacing: true,
  inlineDisplay: true,
  rawVisxAxis: true,
  rawMotionValue: true,
  unframedChart: true,
  chartMissingAriaLabel: true,
  allowComment: 'theme-allow',
}

// ── Path predicate ────────────────────────────────────────────────────────────────────────────────

function isChartFile(relPath: string): boolean {
  return relPath.includes('/charts/') && !AXIS_WRAPPER_FILE.test(relPath)
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
 * The closed registry of all 15 guard kinds. The triad test asserts
 * `surface.guardKinds ⊆ keyof GUARD_RULES` at runtime.
 *
 * raw-surface and raw-html-layout are handled inline in checkSource (multi-regex / multi-condition);
 * all other kinds map to a single pattern entry.
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
    message: 'Use the radius token (radius="md") instead of a numeric literal.',
  },
  'raw-surface': {
    kind: 'raw-surface',
    pattern: SURFACE_BORDER, // handled inline; this entry exists so the registry is complete
    enabled: (cfg: GuardConfig) => cfg.rawSurface,
    message:
      'Use withBorder + a radius token / VX.surface.* / var(--vx-radius-card) instead of inline border/radius/shadow.',
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
    for (const m of line.matchAll(radiusPropRe)) {
      findings.push({ relPath, line: i + 1, token: m[0], kind: 'raw-radius' })
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
  }

  // unframed-chart — full-text tag-scoped scan (not per-line, see RAW_CHART_LEGEND_ARRAY comment).
  // Reports at the line of the `items={[` token itself; honors the same theme-allow / pure-comment
  // skip as every per-line kind by checking that reported line directly.
  if (GUARD_RULES['unframed-chart'].enabled!(cfg)) {
    for (const m of text.matchAll(RAW_CHART_LEGEND_ARRAY)) {
      const lineNo = text.slice(0, (m.index ?? 0) + m[0].length).split('\n').length
      const targetLine = lines[lineNo - 1] ?? ''
      if (targetLine.includes(cfg.allowComment)) continue
      const trimmedTarget = targetLine.trimStart()
      if (
        trimmedTarget.startsWith('//') ||
        trimmedTarget.startsWith('*') ||
        trimmedTarget.startsWith('/*')
      )
        continue
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
      const targetLine = lines[lineNo - 1] ?? ''
      if (targetLine.includes(cfg.allowComment)) continue
      const trimmedTarget = targetLine.trimStart()
      if (
        trimmedTarget.startsWith('//') ||
        trimmedTarget.startsWith('*') ||
        trimmedTarget.startsWith('/*')
      )
        continue
      findings.push({
        relPath,
        line: lineNo,
        token: tagText.slice(0, 40),
        kind: 'chart-missing-aria-label',
      })
    }
  }

  return findings
}
