/**
 * Unit tests for checkSource — the pure (text, relPath, cfg) → Finding[] core.
 *
 * Covers all 20 guard kinds. Co-located with the guard, excluded from tsc
 * (tsconfig exclude: src/**\/*.test.ts), run via `bun test`.
 *
 * The walker/reporter half is covered by the integration test in
 * src/cli/check-theme.test.ts (temp-dir + exit-code contract).
 */
import { describe, expect, it } from 'bun:test'
import { pxRem } from '../tokens'
import { SPACE_SCALE } from '../tokens/palette'
import { checkSource, DEFAULT_GUARD_CONFIG } from './index'
import type { Finding, GuardKind } from './types'

const PATH = 'src/Dashboard.tsx'
const CHART_PATH = 'src/charts/kinds/Foo.tsx'

function kinds(findings: Finding[]): GuardKind[] {
  return findings.map((f) => f.kind)
}

function find(text: string, relPath = PATH) {
  return checkSource(text, relPath, DEFAULT_GUARD_CONFIG)
}

// ── 1. raw-hex ────────────────────────────────────────────────────────────────

describe('raw-hex', () => {
  it('flags a 6-digit hex literal', () => {
    const f = find(`const c = '#a3b4c5'`)
    expect(kinds(f)).toContain('raw-hex')
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#a3b4c5')
  })

  it('flags a 3-digit hex literal', () => {
    const f = find(`const c = '#abc'`)
    expect(kinds(f)).toContain('raw-hex')
  })

  it('reports correct line number', () => {
    const f = find(`line one\nconst c = '#ff0000'\nline three`)
    const hit = f.find((x) => x.kind === 'raw-hex')
    expect(hit?.line).toBe(2)
  })

  it('does NOT flag a line with a theme-allow comment', () => {
    const f = find(`const c = '#ff0000' // theme-allow: legacy`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('does NOT flag a pure line comment mentioning a hex', () => {
    const f = find(`// use #ff0000 from the palette`)
    expect(kinds(f)).not.toContain('raw-hex')
  })
})

// ── 2. raw-color-fn ──────────────────────────────────────────────────────────

describe('raw-color-fn', () => {
  it('flags rgba()', () => {
    const f = find(`const c = rgba(255, 0, 0, 0.5)`)
    expect(kinds(f)).toContain('raw-color-fn')
    expect(f.find((x) => x.kind === 'raw-color-fn')?.token).toBe('rgba(')
  })

  it('flags rgb()', () => {
    const f = find(`const c = rgb(10, 20, 30)`)
    expect(kinds(f)).toContain('raw-color-fn')
  })

  it('flags hsl()', () => {
    const f = find(`fill: hsl(200, 50%, 50%)`)
    expect(kinds(f)).toContain('raw-color-fn')
  })

  it('flags hsla()', () => {
    const f = find(`fill: hsla(200, 50%, 50%, 0.5)`)
    expect(kinds(f)).toContain('raw-color-fn')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`const c = rgba(0,0,0,0.5) // theme-allow`)
    expect(kinds(f)).not.toContain('raw-color-fn')
  })

  it('does NOT flag rgba() mentioned inside a real block comment', () => {
    const f = find('/*\n * use rgba() for opacity\n */')
    expect(kinds(f)).not.toContain('raw-color-fn')
  })
})

// ── 3. localstorage-theme ────────────────────────────────────────────────────

describe('localstorage-theme', () => {
  it('flags localStorage.getItem("theme")', () => {
    const f = find(`const t = localStorage.getItem('theme')`)
    expect(kinds(f)).toContain('localstorage-theme')
  })

  it('flags with double quotes', () => {
    const f = find(`const t = localStorage.getItem("theme")`)
    expect(kinds(f)).toContain('localstorage-theme')
  })

  it('flags with whitespace around getItem call', () => {
    const f = find(`localStorage . getItem ( 'theme' )`)
    expect(kinds(f)).toContain('localstorage-theme')
  })

  it('does NOT flag localStorage.getItem("other-key")', () => {
    const f = find(`localStorage.getItem('colorMode')`)
    expect(kinds(f)).not.toContain('localstorage-theme')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`localStorage.getItem('theme') // theme-allow: legacy`)
    expect(kinds(f)).not.toContain('localstorage-theme')
  })
})

// ── 4. off-identity-accent ───────────────────────────────────────────────────

describe('off-identity-accent', () => {
  it('flags a forbidden color prop (teal)', () => {
    const f = find(`<Badge color="teal" />`)
    expect(kinds(f)).toContain('off-identity-accent')
    expect(f.find((x) => x.kind === 'off-identity-accent')?.token).toBe('teal')
  })

  it('flags c="violet"', () => {
    const f = find(`<Button c="violet" />`)
    expect(kinds(f)).toContain('off-identity-accent')
  })

  it('flags bg="grape"', () => {
    const f = find(`<Box bg="grape" />`)
    expect(kinds(f)).toContain('off-identity-accent')
  })

  it('flags backgroundColor="indigo"', () => {
    const f = find(`<Box backgroundColor="indigo" />`)
    expect(kinds(f)).toContain('off-identity-accent')
  })

  it('does NOT flag color="blue" (allowed)', () => {
    const f = find(`<Badge color="blue" />`)
    expect(kinds(f)).not.toContain('off-identity-accent')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Badge color="teal" /> // theme-allow: design exception`)
    expect(kinds(f)).not.toContain('off-identity-accent')
  })
})

// ── 4b. mantine-shade-index ──────────────────────────────────────────────────

describe('mantine-shade-index', () => {
  it('flags a shade-pinned text color (c="yellow.7")', () => {
    const f = find(`<Text c="yellow.7">stale</Text>`)
    expect(kinds(f)).toContain('mantine-shade-index')
  })

  it('flags bg="blue.4" and color="red.6"', () => {
    expect(kinds(find(`<Box bg="blue.4" />`))).toContain('mantine-shade-index')
    expect(kinds(find(`<ThemeIcon color="red.6" />`))).toContain('mantine-shade-index')
  })

  it('flags the var() form for a non-surface hue', () => {
    const f = find(`const a = { color: 'var(--mantine-color-yellow-7)' }`)
    expect(kinds(f)).toContain('mantine-shade-index')
  })

  it('flags the var() form in a .css file too — unlike the prop-only kinds', () => {
    const f = find(`.a { color: var(--mantine-color-red-6); }`, 'src/app.css')
    expect(kinds(f)).toContain('mantine-shade-index')
  })

  // The two kinds partition the space: gray/dark var() steps are surface color and belong to
  // off-system-surface-var, so a single violation must never report under both.
  it('leaves gray/dark var() steps to off-system-surface-var', () => {
    const f = find(`const a = { background: 'var(--mantine-color-gray-3)' }`)
    expect(kinds(f)).toContain('off-system-surface-var')
    expect(kinds(f)).not.toContain('mantine-shade-index')
  })

  it('does NOT flag a bare status hue — it resolves per scheme, which is the point', () => {
    expect(kinds(find(`<Text c="red">down</Text>`))).not.toContain('mantine-shade-index')
    expect(kinds(find(`<ThemeIcon color="green" />`))).not.toContain('mantine-shade-index')
  })

  it('does NOT flag c="dimmed" or a token ref', () => {
    expect(kinds(find(`<Text c="dimmed">age</Text>`))).not.toContain('mantine-shade-index')
    expect(kinds(find(`<Text c={VX.status.warn}>age</Text>`))).not.toContain('mantine-shade-index')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Text c="yellow.7" /> // theme-allow: design exception`)
    expect(kinds(f)).not.toContain('mantine-shade-index')
  })

  it('is disabled by the mantineShadeIndex knob', () => {
    const f = checkSource(`<Text c="yellow.7" />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      mantineShadeIndex: false,
    })
    expect(kinds(f)).not.toContain('mantine-shade-index')
  })

  // The grace-minor doctrine (package CLAUDE.md): a kind that rejects previously-passing code
  // lands as `warn` for one minor, then its GRACE_PERIOD_KINDS entry is deleted and it becomes an
  // error. This one ran its grace across FOUR minors — introduced 1.7.0, then deferred by 1.8.0
  // (shipped the same day as 1.7.0), 1.9.0 (carried the chart-layer batch the same consumer was
  // waiting on) and 1.10.0 (shipped without the promotion at all). Promoted in 1.11.0, verified
  // against the only consumer first: argo's `check-theme` reports zero violations of any kind, so
  // the promotion breaks nothing that was passing.
  it('is an error now that its grace period has ended', () => {
    const f = find(`<Text c="yellow.7" />`)
    expect(f.find((x) => x.kind === 'mantine-shade-index')?.severity).toBe('error')
  })
})

// ── 5. raw-spacing ───────────────────────────────────────────────────────────

describe('raw-spacing', () => {
  // Interpolated from the real scale, never typed as literals: the previous versions of these tests
  // hardcoded 16 and 12 and so PASSED against a guard whose step list had gone stale — they encoded
  // the drift instead of catching it.
  it('flags a prop value equal to a scale step', () => {
    expect(kinds(find(`<Box p={${SPACE_SCALE.md}} />`))).toContain('raw-spacing')
    expect(kinds(find(`<Stack gap={${SPACE_SCALE.sm}} />`))).toContain('raw-spacing')
  })

  it('does NOT flag p={8} (sub-scale micro-spacing, no token to prefer)', () => {
    const f = find(`<Box p={8} />`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })

  it('does NOT flag p="md" (string token)', () => {
    const f = find(`<Box p="md" />`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box p={${SPACE_SCALE.md}} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })
})

// ── 6. raw-radius ────────────────────────────────────────────────────────────

describe('raw-radius', () => {
  it('flags radius={8}', () => {
    const f = find(`<Card radius={8} />`)
    expect(kinds(f)).toContain('raw-radius')
  })

  it('flags radius="4"', () => {
    const f = find(`<Card radius="4" />`)
    expect(kinds(f)).toContain('raw-radius')
  })

  it('does NOT flag radius="md"', () => {
    const f = find(`<Card radius="md" />`)
    expect(kinds(f)).not.toContain('raw-radius')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Card radius={8} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-radius')
  })
})

// ── 7. raw-surface ───────────────────────────────────────────────────────────

describe('raw-surface', () => {
  it('flags an inline border literal', () => {
    const f = find(`<div style={{ border: '1px solid #ccc' }} />`)
    expect(kinds(f)).toContain('raw-surface')
  })

  it('flags a numeric borderRadius', () => {
    const f = find(`<div style={{ borderRadius: 8 }} />`)
    expect(kinds(f)).toContain('raw-surface')
  })

  it('flags a boxShadow literal', () => {
    const f = find(`<div style={{ boxShadow: '0 1px 3px black' }} />`)
    expect(kinds(f)).toContain('raw-surface')
  })

  it('does NOT flag a var(--…) border token', () => {
    const f = find(`<Box style={{ border: '1px solid var(--vx-surface-border)' }} />`)
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a var(--…) boxShadow token', () => {
    const f = find(`<div style={{ boxShadow: 'var(--mantine-shadow-sm)' }} />`)
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a ${…}-composed border (token-driven, e.g. VX.divider)', () => {
    const f = find('const s = { borderLeft: `2px solid ${VX.divider}` }')
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a ${…}-composed boxShadow (VX.shadowCard + a token ring)', () => {
    const f = find(
      'const s = { boxShadow: `${VX.shadowCard}, 0 0 0 1px ${alpha(VX.status.bad, 0.25)}` }',
    )
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a border reset keyword (none/transparent)', () => {
    expect(kinds(find(`<button style={{ border: 'none' }} />`))).not.toContain('raw-surface')
    expect(kinds(find(`<div style={{ border: 'transparent' }} />`))).not.toContain('raw-surface')
  })

  it('STILL flags a genuinely raw ${…}-free literal border/shadow', () => {
    // A template literal escapes only because its color is separately caught by raw-hex/raw-color-fn;
    // a plain quoted literal has no such backstop, so it must still fire.
    expect(kinds(find(`<div style={{ border: '2px solid red' }} />`))).toContain('raw-surface')
    expect(kinds(find(`<div style={{ boxShadow: '0 2px 4px rgba(0,0,0,.1)' }} />`))).toContain(
      'raw-surface',
    )
  })

  it('does NOT flag when rawSurface is false', () => {
    const f = checkSource(`<div style={{ borderRadius: 8 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawSurface: false,
    })
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<div style={{ borderRadius: 8 }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-surface')
  })
})

// ── 8. off-system-surface-var ─────────────────────────────────────────────────

describe('off-system-surface-var', () => {
  it('flags a raw Mantine gray ramp step', () => {
    const f = find(`<Box style={{ color: 'var(--mantine-color-gray-3)' }} />`)
    expect(kinds(f)).toContain('off-system-surface-var')
  })

  it('flags a raw Mantine dark ramp step', () => {
    const f = find(`<Box bg="var(--mantine-color-dark-6)" />`)
    expect(kinds(f)).toContain('off-system-surface-var')
  })

  it('does NOT flag a --vx-surface-* token', () => {
    const f = find(`<Box bg="var(--vx-surface-panel)" />`)
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })

  it('does NOT flag a named Mantine var (not a ramp step)', () => {
    const f = find(`<Box bg="var(--mantine-color-default-border)" />`)
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })

  it('does NOT flag when offSystemSurfaceVar is false', () => {
    const f = checkSource(`<Box bg="var(--mantine-color-gray-3)" />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      offSystemSurfaceVar: false,
    })
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box bg="var(--mantine-color-gray-3)" /> // theme-allow`)
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })
})

// ── 9. raw-html-layout ───────────────────────────────────────────────────────

describe('raw-html-layout', () => {
  it('flags a raw <div> with inline display:flex', () => {
    const f = find(`<div style={{ display: 'flex', gap: 8 }} />`)
    expect(kinds(f)).toContain('raw-html-layout')
  })

  it('flags a raw <section> with inline padding', () => {
    const f = find(`<section style={{ padding: 16 }}>x</section>`)
    expect(kinds(f)).toContain('raw-html-layout')
  })

  it('does NOT flag a bare <div> without style', () => {
    const f = find(`<div ref={r} className="x" />`)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag an <img> (not a layout element)', () => {
    const f = find(`<img style={{ width: 40 }} src="a.png" />`)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag when rawHtmlLayout is false', () => {
    const f = checkSource(`<div style={{ display: 'flex' }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawHtmlLayout: false,
      inlineDisplay: false,
    })
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<div style={{ display: 'flex' }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag a raw <div> with inline display:flex in a chart file — the Flex/Grid/Group remedy is @mantine/*, banned in the Mantine-free chart layer', () => {
    const f = find(`<div style={{ display: 'flex', gap: 8 }} />`, CHART_PATH)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('still flags the same literal in a non-chart path (the check is not globally weakened)', () => {
    const f = find(`<div style={{ display: 'flex', gap: 8 }} />`, PATH)
    expect(kinds(f)).toContain('raw-html-layout')
  })
})

// ── 10. inline-spacing ───────────────────────────────────────────────────────

describe('inline-spacing', () => {
  it('flags padding: 16', () => {
    const f = find(`<Box style={{ padding: 16 }} />`)
    expect(kinds(f)).toContain('inline-spacing')
  })

  it('flags marginTop: "12px"', () => {
    const f = find(`<Box style={{ marginTop: '12px' }} />`)
    expect(kinds(f)).toContain('inline-spacing')
  })

  it('does NOT flag padding: 0', () => {
    const f = find(`<Box style={{ padding: 0 }} />`)
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('does NOT flag a var(--…) gap token', () => {
    const f = find(`<Box style={{ gap: 'var(--mantine-spacing-md)' }} />`)
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('does NOT flag when inlineSpacing is false', () => {
    const f = checkSource(`<Box style={{ padding: 16 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      inlineSpacing: false,
    })
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box style={{ padding: 16 }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('inline-spacing')
  })
})

// ── 10b. Finding.text ─────────────────────────────────────────────────────────
//
// `token` stays the regex match (e.g. the unit-less numeric part of a spacing declaration);
// `text` is the full trimmed source line, so a human reading the report sees `padding: 0.75rem;`
// rather than the confusing partial match `padding: 0.75`.

describe('Finding.text', () => {
  it('reports text as the full trimmed source line while token stays the truncated match', () => {
    const f = checkSource(
      '.foo {\n  padding: 0.75rem;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.token).toBe('padding: 0.75')
    expect(hit?.text).toBe('padding: 0.75rem;')
  })

  it('reports the whole declaration including the unit for a CSS padding-left finding', () => {
    const f = checkSource('padding-left: 1.25rem;', 'src/Card.module.css', DEFAULT_GUARD_CONFIG)
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.token).toBe('padding-left: 1.25')
    expect(hit?.text).toBe('padding-left: 1.25rem;')
  })

  it('truncates a line over 100 characters with a trailing …', () => {
    const filler = 'x'.repeat(200)
    const f = checkSource(
      `padding: 16px; /* ${filler} */`,
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.text.length).toBe(101)
    expect(hit?.text.endsWith('…')).toBe(true)
  })

  it('trims a leading-indented line', () => {
    const f = checkSource('    padding: 16px;', 'src/Card.module.css', DEFAULT_GUARD_CONFIG)
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.text).toBe('padding: 16px;')
  })
})

// ── 11. inline-display ───────────────────────────────────────────────────────

describe('inline-display', () => {
  it('flags display: "flex"', () => {
    const f = find(`<Box style={{ display: 'flex' }} />`)
    expect(kinds(f)).toContain('inline-display')
  })

  it('flags display: "grid"', () => {
    const f = find(`<Box style={{ display: "grid" }} />`)
    expect(kinds(f)).toContain('inline-display')
  })

  it('flags display: "inline-flex"', () => {
    const f = find(`<Box style={{ display: 'inline-flex' }} />`)
    expect(kinds(f)).toContain('inline-display')
  })

  it('does NOT flag display: "block"', () => {
    const f = find(`<Box style={{ display: 'block' }} />`)
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT flag when inlineDisplay is false', () => {
    const f = checkSource(`<Box style={{ display: 'flex' }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      inlineDisplay: false,
    })
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box style={{ display: 'flex' }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT flag display: "flex" in a chart file — the Flex/Grid/Group remedy is @mantine/*, banned in the Mantine-free chart layer', () => {
    const f = find(`<Box style={{ display: 'flex' }} />`, CHART_PATH)
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('still flags the same literal in a non-chart path (the check is not globally weakened)', () => {
    const f = find(`<Box style={{ display: 'flex' }} />`, PATH)
    expect(kinds(f)).toContain('inline-display')
  })
})

// ── 12. raw-visx-axis ────────────────────────────────────────────────────────

describe('raw-visx-axis', () => {
  it('flags <AxisLeft> in a chart file', () => {
    const f = find(`<AxisLeft scale={s} numTicks={4} />`, CHART_PATH)
    expect(kinds(f)).toContain('raw-visx-axis')
    expect(f.find((x) => x.kind === 'raw-visx-axis')?.token).toBe('<AxisLeft')
  })

  it('flags <AxisBottom> in a chart file', () => {
    const f = find(`<AxisBottom scale={x} />`, CHART_PATH)
    expect(kinds(f)).toContain('raw-visx-axis')
  })

  it('flags <AxisRight> in a chart file', () => {
    const f = find(`<AxisRight scale={y} />`, CHART_PATH)
    expect(kinds(f)).toContain('raw-visx-axis')
  })

  it('does NOT flag <AxisLeft> in a NON-chart path', () => {
    const f = find(`<AxisLeft scale={s} />`, PATH)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag <AxisLeftNumeric> in a chart file (not a raw axis)', () => {
    const f = find(`<AxisLeftNumeric scale={s} />`, CHART_PATH)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag <AxisLeft> in Axes.tsx (the wrapper primitive)', () => {
    const f = find(
      `export const AxisLeftNumeric = (p) => <AxisLeft {...p} />`,
      'src/charts/primitives/Axes.tsx',
    )
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag when rawVisxAxis is false', () => {
    const f = checkSource(`<AxisLeft scale={s} />`, CHART_PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawVisxAxis: false,
    })
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag a theme-allow line in a chart file', () => {
    const f = find(`<AxisLeft scale={s} /> // theme-allow: bespoke`, CHART_PATH)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })
})

// ── 13. raw-motion-value ─────────────────────────────────────────────────────

describe('raw-motion-value', () => {
  it('flags a hardcoded duration in transition={{}}', () => {
    const f = find(`<motion.div transition={{ duration: 0.3 }} />`)
    expect(kinds(f)).toContain('raw-motion-value')
  })

  it('flags a hardcoded spring stiffness in transition={{}}', () => {
    const f = find(`<motion.div transition={{ type: 'spring', stiffness: 400 }} />`)
    expect(kinds(f)).toContain('raw-motion-value')
  })

  it('flags a hardcoded ease bezier array in transition={{}}', () => {
    const f = find(`<motion.div transition={{ ease: [0.4, 0, 0.2, 1] }} />`)
    expect(kinds(f)).toContain('raw-motion-value')
  })

  it('does NOT flag a transition referencing the shared token', () => {
    const f = find(`<motion.div transition={MOTION_SPRING} />`)
    expect(kinds(f)).not.toContain('raw-motion-value')
  })

  it('does NOT flag a named easing string (not a magic number)', () => {
    const f = find(`<motion.div transition={{ ease: 'easeInOut' }} />`)
    expect(kinds(f)).not.toContain('raw-motion-value')
  })

  it('does NOT flag when rawMotionValue is false', () => {
    const f = checkSource(`<motion.div transition={{ duration: 0.3 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawMotionValue: false,
    })
    expect(kinds(f)).not.toContain('raw-motion-value')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<motion.div transition={{ duration: 0.3 }} /> // theme-allow: bespoke`)
    expect(kinds(f)).not.toContain('raw-motion-value')
  })
})

// ── 14. unframed-chart ───────────────────────────────────────────────────────

describe('unframed-chart', () => {
  it('flags a hand-rolled <ChartLegend items={[...]}> on one line', () => {
    const f = find(`<ChartLegend items={[{ key: 'a', label: 'A', color: '#fff' }]} />`)
    expect(kinds(f)).toContain('unframed-chart')
  })

  it('flags a hand-rolled legend array literal formatted across multiple lines', () => {
    const text = [
      '<ChartLegend',
      "  items={[{ key: 'a', label: 'A', color: VX.line }]}",
      '  placement="bottom"',
      '/>',
    ].join('\n')
    const f = find(text)
    expect(kinds(f)).toContain('unframed-chart')
  })

  it('reports the line carrying the items={[ token, not the tag-open line', () => {
    const text = ['<ChartLegend', "  items={[{ key: 'a', label: 'A' }]}", '/>'].join('\n')
    const f = find(text)
    const hit = f.find((x) => x.kind === 'unframed-chart')
    expect(hit?.line).toBe(2)
  })

  it('does NOT flag ChartFrame composing its own derived legend (call expression)', () => {
    const text = [
      '<ChartLegend',
      '  items={deriveLegend(series)}',
      '  placement={placement}',
      '/>',
    ].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('unframed-chart')
  })

  it('does NOT flag an unrelated items={[...]} prop on a different component', () => {
    const f = find(`<Menu items={[{ label: 'a' }]} />`)
    expect(kinds(f)).not.toContain('unframed-chart')
  })

  it('does NOT flag when unframedChart is false', () => {
    const f = checkSource(`<ChartLegend items={[{ key: 'a', label: 'A' }]} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      unframedChart: false,
    })
    expect(kinds(f)).not.toContain('unframed-chart')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(
      `<ChartLegend items={[{ key: 'a', label: 'A' }]} /> // theme-allow: bespoke legend`,
    )
    expect(kinds(f)).not.toContain('unframed-chart')
  })
})

// ── 15. chart-missing-aria-label ─────────────────────────────────────────────

describe('chart-missing-aria-label', () => {
  it('flags a chart kind tag without ariaLabel', () => {
    const f = find(`<ZonedLine data={points} height={240} chartId="x" />`)
    expect(kinds(f)).toContain('chart-missing-aria-label')
  })

  it('does NOT flag a tag carrying ariaLabel', () => {
    const f = find(`<ZonedLine ariaLabel="HRV trend" data={points} height={240} />`)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('sees ariaLabel PAST an arrow function in an earlier prop (=> must not end the tag)', () => {
    const f = find(`<ZonedLine data={points} getX={(d) => d.date} ariaLabel="HRV trend" />`)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('sees ariaLabel past an explicit JSX generic argument', () => {
    const text = [
      '<MultiLine<ChartPoint>',
      '  data={points}',
      '  getX={(d) => d.date}',
      '  ariaLabel="Body weight trend"',
      '/>',
    ].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('still flags a generic + arrow-function tag genuinely missing ariaLabel', () => {
    const f = find(`<MultiLine<ChartPoint> data={points} getX={(d) => d.date} />`)
    expect(kinds(f)).toContain('chart-missing-aria-label')
  })

  it('does NOT flag raw-radius when rawRadius is false (framework-internal repos)', () => {
    const f = checkSource(`<Paper radius={6} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawRadius: false,
    })
    expect(kinds(f)).not.toContain('raw-radius')
  })

  it('does NOT flag when chartMissingAriaLabel is false', () => {
    const f = checkSource(`<ZonedLine data={points} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      chartMissingAriaLabel: false,
    })
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  // ── reported line: the tag's OPENING line, not the end of the match ─────────
  //
  // The scan used to compute its line from the END of the matched tag, so on a multi-line-
  // formatted chart element the reported line was the closing `/>` rather than the `<Bars` line
  // that is actually missing the prop. Invisible while the report only printed `token`; visible
  // the moment `Finding.text` started quoting the reported source line back.

  it('reports the OPENING tag line (and quotes it in text) for a multi-line-formatted chart element', () => {
    const text = ['<Bars', '  data={points}', '  height={240}', '/>'].join('\n')
    const f = find(text)
    const hit = f.find((x) => x.kind === 'chart-missing-aria-label')
    expect(hit?.line).toBe(1)
    expect(hit?.text).toBe('<Bars')
  })

  it('reports the same line as before for a single-line chart element (no regression)', () => {
    const f = find(`<ZonedLine data={points} height={240} chartId="x" />`)
    const hit = f.find((x) => x.kind === 'chart-missing-aria-label')
    expect(hit?.line).toBe(1)
  })

  it('a theme-allow comment on the CLOSING line of a multi-line tag still suppresses the finding (back-compat)', () => {
    const text = ['<Bars', '  data={points}', '  height={240}', '/> // theme-allow'].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('a theme-allow comment on the OPENING line of a multi-line tag also suppresses the finding', () => {
    const text = ['<Bars // theme-allow', '  data={points}', '  height={240}', '/>'].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })
})

// ── 16. card-with-border ─────────────────────────────────────────────────────

describe('card-with-border', () => {
  it('flags withBorder on a Card', () => {
    const f = find(`<Card padding="md" withBorder h="100%">{children}</Card>`)
    expect(kinds(f)).toContain('card-with-border')
  })

  it('flags withBorder on a Paper', () => {
    const f = find(`<Paper withBorder p="sm" />`)
    expect(kinds(f)).toContain('card-with-border')
  })

  it('flags withBorder in a multi-line-formatted tag, reporting the prop line', () => {
    const f = find(`<Card\n  padding="md"\n  withBorder\n  h="100%"\n>`)
    const finding = f.find((v) => v.kind === 'card-with-border')
    expect(finding?.line).toBe(3)
  })

  it('does NOT flag a Card with no withBorder', () => {
    const f = find(`<Card padding="md" h="100%">{children}</Card>`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag an explicit withBorder={false} opt-out', () => {
    const f = find(`<Paper withBorder={false} p="sm" />`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag Card.Section withBorder (a section divider, not card depth)', () => {
    const f = find(`<Card.Section withBorder inheritPadding py="xs">{header}</Card.Section>`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag withBorder on a non-card surface (Table keeps its own borders)', () => {
    const f = find(`<Table withBorder striped />`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag a component whose name merely starts with Card', () => {
    const f = find(`<CardHeader withBorder />`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag when cardWithBorder is false', () => {
    const f = checkSource(`<Card withBorder />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      cardWithBorder: false,
    })
    expect(kinds(f)).not.toContain('card-with-border')
  })
})

// ── 17. raw-form-control ─────────────────────────────────────────────────────

describe('raw-form-control', () => {
  it('flags a raw <input>', () => {
    const f = find(`<input type="text" value={v} onChange={onChange} />`)
    expect(kinds(f)).toContain('raw-form-control')
  })

  it('flags a raw <select>', () => {
    const f = find(`<select value={v}><option value="a">A</option></select>`)
    expect(kinds(f)).toContain('raw-form-control')
  })

  it('flags a raw <textarea>', () => {
    const f = find(`<textarea value={v} onChange={onChange} />`)
    expect(kinds(f)).toContain('raw-form-control')
  })

  it('does NOT flag a Mantine <TextInput>', () => {
    const f = find(`<TextInput label="Name" value={v} onChange={onChange} />`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag a Mantine <Select>', () => {
    const f = find(`<Select data={options} value={v} />`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag a component whose name merely starts with the tag name (inputRef)', () => {
    const f = find(`<inputRef.current.focus() />`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<input type="text" /> // theme-allow: legacy widget`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag when rawFormControl is false', () => {
    const f = checkSource(`<input type="text" />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawFormControl: false,
    })
    expect(kinds(f)).not.toContain('raw-form-control')
  })
})

// ── 18. sub-16-input-font ────────────────────────────────────────────────────

describe('sub-16-input-font', () => {
  it('flags a sub-16 fontSize inline style on a raw <input>', () => {
    const f = find(`<input style={{ fontSize: 13, border: 'none' }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('flags a sub-16 fontSize inline style on a raw <textarea>', () => {
    const f = find(`<textarea style={{ fontSize: 12 }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('flags a quoted "12px" fontSize value', () => {
    const f = find(`<input style={{ fontSize: '12px' }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('flags a Mantine styles={{ input: { fontSize } }} per-part override', () => {
    const f = find(`<TextInput styles={{ input: { fontSize: 12 } }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize of 16 or above on a raw input (already at/above the floor)', () => {
    const f = find(`<input style={{ fontSize: 16 }} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize below 16 on a <Text> (not a form control)', () => {
    const f = find(`<Text style={{ fontSize: 12 }}>caption</Text>`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize below 16 on a <span> (not a form control)', () => {
    const f = find(`<span style={{ fontSize: 11 }}>micro-label</span>`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize below 16 on a <Code> chart label (not a form control)', () => {
    const f = find(`<Code style={{ fontSize: 10 }}>{value}</Code>`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a rem-unit fontSize (ambiguous relative to a px floor, deliberately not matched)', () => {
    const f = find(`<input style={{ fontSize: '0.8rem' }} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a raw <input> with no style at all', () => {
    const f = find(`<input type="text" value={v} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a Mantine styles={{ root: {...} }} override (targets the wrapper, not the input)', () => {
    const f = find(`<TextInput styles={{ root: { fontSize: 12 } }} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<input style={{ fontSize: 12 }} /> // theme-allow: legacy widget`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag when sub16InputFont is false', () => {
    const f = checkSource(`<input style={{ fontSize: 12 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      sub16InputFont: false,
    })
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })
})

// ── 19. raw-font-family ──────────────────────────────────────────────────────

describe('raw-font-family', () => {
  it('flags a quoted fontFamily object property', () => {
    const f = find(`const s = { fontFamily: 'Inter, sans-serif' }`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('flags a quoted fontFamily JSX prop', () => {
    const f = find(`<Text style={{ fontFamily: "Arial" }}>hi</Text>`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('flags a bare kebab-case font-family CSS declaration', () => {
    const f = find(`font-family: Inter;`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('does NOT flag a fontFamily bound to a var(--basalt-font-…) reference', () => {
    const f = find(`fontFamily: 'var(--basalt-font-sans, ui-sans-serif, system-ui, sans-serif)',`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag a kebab-case font-family bound to var(…)', () => {
    const f = find(`font-family: var(--basalt-font-mono);`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag an unquoted fontFamily identifier reference (a token ref, not a literal)', () => {
    const f = find(`fontFamily: LABEL_FONT_FAMILY,`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`fontFamily: 'Inter, sans-serif', // theme-allow: legacy widget`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('flags a quoted kebab-case font-family CSS value (the (a) bypass)', () => {
    const f = find(`font-family: 'Inter', sans-serif;`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('flags a fontFamily bound to a var(...) reference OUTSIDE the two allowed prefixes (the (b) bypass)', () => {
    const f = find(`fontFamily: 'var(--some-other-var)'`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('flags a kebab-case font-family bound to a var(...) reference outside the allowed prefixes', () => {
    const f = find(`font-family: var(--some-other-var);`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('does NOT flag a kebab-case font-family bound to var(--mantine-font-family-…)', () => {
    const f = find(`fontFamily: 'var(--mantine-font-family-monospace)',`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword inherit (camelCase, quoted)', () => {
    const f = find(`fontFamily: 'inherit'`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword initial (kebab-case, bare)', () => {
    const f = find(`font-family: initial;`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword unset', () => {
    const f = find(`font-family: unset;`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword revert', () => {
    const f = find(`font-family: revert;`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })
})

// ── theme-allow skip ─────────────────────────────────────────────────────────

describe('theme-allow skip', () => {
  it('skips the entire line when it contains the allow comment', () => {
    const text = `
const a = '#ff0000' // theme-allow
const b = '#00ff00'
`.trim()
    const f = find(text)
    // only the second line should fire
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.line).toBe(2)
  })

  it('supports a custom allowComment value', () => {
    const f = checkSource(`const c = '#ff0000' // ok-to-use-raw`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      allowComment: 'ok-to-use-raw',
    })
    expect(kinds(f)).not.toContain('raw-hex')
  })
})

// ── pure-comment skip ─────────────────────────────────────────────────────────

describe('pure-comment skip', () => {
  it('skips a // line comment', () => {
    const f = find(`// const c = '#ff0000'`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('skips a JSDoc body line that is genuinely inside a block comment', () => {
    const f = find('/**\n * Use rgba() for opacity, not raw hex\n */')
    expect(kinds(f)).not.toContain('raw-color-fn')
  })

  it('skips a /* start-of-block line', () => {
    const f = find(`/* const c = '#aabbcc' */`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('still flags a code line that follows a comment', () => {
    const text = `// this is a comment\nconst c = '#ff0000'`
    const f = find(text)
    expect(kinds(f)).toContain('raw-hex')
  })
})

// ── stripComments pre-pass: real block/line-comment awareness ───────────────────
//
// checkSource used to decide "is this a comment?" per line, from that line's OWN leading prefix
// (`//` / `*` / `/*`). A block-comment CONTINUATION line that didn't happen to start with `*` (the
// common "wrapped prose" style, e.g. styles.css) slipped straight through as code — a real
// false-positive, not a hypothetical one (see the 3 real sites this fixed, asserted in
// index.test.ts / reproduced below). These cases prove the replacement — an actual comment-
// stripping pre-pass — neither under- nor over-strips.

describe('stripComments pre-pass', () => {
  it('does NOT flag a hex on a block-comment CONTINUATION line with no leading *', () => {
    // This is exactly the styles.css shape: a /* ... */ block whose middle lines are wrapped
    // prose, not `* `-prefixed. The old per-line prefix heuristic missed this entirely.
    const text = ['/* line one', '   #e5e5e5 in the middle, no leading star', 'line three */'].join(
      '\n',
    )
    const f = find(text)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('flags a real hex that follows a same-line /* */ comment', () => {
    const f = find(`/* note */ const c = '#ff0000'`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('flags a hex inside a single-quoted string with a trailing // comment', () => {
    const f = find(`const c = '#ff0000' // trailing note`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  it('does not mangle a URL hash-fragment inside a quoted string via // handling', () => {
    // The `//` in `https://` sits INSIDE a single-quoted string, so it must not be treated as a
    // line-comment opener. The guard's raw-hex regex has no URL awareness (never did — that's
    // unrelated to this fix), so it still matches the `#aabbcc` fragment literally: the real-code
    // semantics here are "1 finding", proving the string content survived the strip untouched
    // rather than being blanked out by an over-eager `//` rule.
    const f = find(`const u = 'https://example.com/#aabbcc'`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('preserves the exact original line number across a preceding multi-line block comment', () => {
    const text = ['/*', 'line2', 'line3', 'line4', 'end */', '', "const c = '#ff0000'"].join('\n')
    const f = find(text)
    const hit = f.find((x) => x.kind === 'raw-hex')
    expect(hit?.line).toBe(7)
  })

  it('still honors the theme-allow escape on a code line', () => {
    const f = find(`const c = '#ff0000' // theme-allow: legacy`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('does not crash on an unterminated block comment at EOF, and strips everything after it', () => {
    const text = `const before = '#ff0000'\n/* unterminated\nconst c = '#00ff00'`
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  it('still finds a hex inside a backtick template literal containing ${}', () => {
    const f = find('const s = `value ${x} is #ff0000`')
    expect(kinds(f)).toContain('raw-hex')
  })

  it('CSS-shaped input: flags only the real declaration, not the comment mention', () => {
    const text = '/* comment with #e5e5e5 */\n.a { color: #ff0000; }'
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  // ── regex-literal disambiguation (BUG 1: a `/*`- or `//`-shaped sequence INSIDE a regex body
  // must never be misread as opening a comment — the char-class case ran away to EOF and silently
  // deleted guard coverage for the rest of the file) ──────────────────────────────────────────────

  it('does not treat a `/*` inside a regex character class as a block-comment opener (BUG 1 repro)', () => {
    const text = "const RE = /[/*]/\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('does not treat two `/` inside a regex character class as a line-comment opener', () => {
    const text = "const RE = /[//]/\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('treats a `/` between identifiers as division, not a regex open', () => {
    const text = "const a = x / y\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('treats a `/` as division and still finds a REAL // comment later on the same line', () => {
    const text = "const a = x / y // #aabbcc\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('consumes a regex literal with an escaped slash without closing early', () => {
    const text = "const RE = /a\\/b/\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('still recognizes a real block comment right after a regex literal (regex handling did not break comment handling)', () => {
    const text = 'const RE = /abc/\n/* #ff0000 */'
    const f = find(text)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  // ── CSS vs TS syntax split (BUG 2: an unquoted `//` in CSS, e.g. inside `url(https://…)`,
  // is real CSS text, not a comment opener — CSS has no `//` comment syntax at all) ───────────────

  it('does not treat an unquoted "//" inside a CSS url() as a comment opener (BUG 2 repro)', () => {
    const f = checkSource(
      '.a { background: url(https://x.com/a.png); color: #ff0000; }',
      'src/styles.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('still strips a real /* */ block comment in a .css file alongside an unquoted url()', () => {
    const f = checkSource(
      '.a { background: url(https://x.com/a.png); /* #aabbcc */ color: #ff0000; }',
      'src/styles.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  it('resolves a .module.css path to CSS syntax too (suffix match, not a naive split)', () => {
    const f = checkSource(
      '.a { background: url(https://x.com/a.png); color: #ff0000; }',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('a .ts file still strips a real // line comment (the CSS/TS syntax split did not disable TS)', () => {
    const f = checkSource('// #ff0000\nconst ok = 1', 'src/x.ts', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).not.toContain('raw-hex')
  })
})

// ── isChartFile gates raw-visx-axis ──────────────────────────────────────────

describe('isChartFile path gate', () => {
  it('fires raw-visx-axis in src/charts/kinds/k.tsx', () => {
    const f = checkSource(`<AxisLeft scale={s} />`, 'src/charts/kinds/k.tsx', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).toContain('raw-visx-axis')
  })

  it('does NOT fire raw-visx-axis in src/page.tsx', () => {
    const f = checkSource(`<AxisLeft scale={s} />`, 'src/page.tsx', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })
})

// ── CSS applicability — the CLI walker now scans .css, so checkSource's per-kind gating over
// CSS-shaped input matters for real: color-meaningful kinds must still fire, JSX/tag-shaped kinds
// must not false-positive on genuine CSS syntax ──────────────────────────────────────────────────

describe('CSS applicability', () => {
  it('flags a raw hex in a real CSS declaration (proves .css is genuinely scanned)', () => {
    const f = checkSource(
      '.input {\n  color: #ff0000;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('raw-hex')
  })

  it('does NOT false-positive inline-display/raw-html-layout/raw-surface on genuine CSS shapes', () => {
    const f = checkSource(
      '.foo {\n  display: flex;\n  padding: 8px;\n  border-radius: 8px;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('inline-display')
    expect(kinds(f)).not.toContain('raw-html-layout')
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('still flags off-system-surface-var on a raw Mantine ramp step inside CSS', () => {
    const f = checkSource(
      '.foo {\n  background: var(--mantine-color-gray-3);\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('off-system-surface-var')
  })

  it('still flags raw-font-family on a kebab-case CSS font-family declaration', () => {
    const f = checkSource(
      '.foo {\n  font-family: system-ui;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('still flags inline-spacing on a genuine CSS padding/margin/gap declaration (the pattern is CSS-shaped, not JSX-only, despite the name)', () => {
    const f = checkSource(
      '.foo {\n  padding: 18px;\n  margin: 13px;\n  gap: 26px;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f).filter((k) => k === 'inline-spacing')).toHaveLength(3)
  })

  // ── The CSS-only sub-scale escape ───────────────────────────────────────────
  //
  // basalt-tokens.md blesses 2-8px micro-spacing raw, but that permission only ever held for JSX
  // PROPS: `pl={4}` is not a `prop: value` pair and never matched the pattern. In CSS every
  // declaration is `prop: value`, so a consumer's 4px cluster gap was flagged with nothing legal to
  // do about it — no token exists below the scale floor, and `exemptRules` matches whole path
  // segments so it cannot express `*.module.css`.

  const cssSpacing = (decl: string): GuardKind[] =>
    kinds(
      checkSource(`.foo {\n  ${decl};\n}\n`, 'src/Card.module.css', DEFAULT_GUARD_CONFIG),
    ).filter((k) => k === 'inline-spacing')

  it('does NOT flag sub-scale micro-spacing in CSS — there is no token to prefer below the floor', () => {
    for (const decl of ['gap: 2px', 'padding: 4px', 'margin-bottom: 6px', 'padding: 8px']) {
      expect(cssSpacing(decl)).toEqual([])
    }
  })

  it('judges a multi-value shorthand as a whole', () => {
    expect(cssSpacing('padding: 4px 8px')).toEqual([])
    // 16px has a scale stop; one non-micro component makes the whole declaration a finding.
    expect(cssSpacing('padding: 4px 16px')).toEqual(['inline-spacing'])
  })

  it('drops var() components before judging — a mixed value is already tokenized where it counts', () => {
    expect(cssSpacing('padding: 4px var(--vx-space-stack-xs)')).toEqual([])
  })

  it('does not extend the escape to other units — the doctrine is stated in px', () => {
    expect(cssSpacing('padding: 1.5rem')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding: 2em')).toEqual(['inline-spacing'])
  })

  it('does NOT read a unitless fraction — that is a ratio, not a length', () => {
    // visx band padding. Ten of these in one consumer's chart files the day the leading-decimal fix
    // shipped: `padding` here is dimensionless 0–1, and "use p/m/gap with xs..xl" cannot be done to
    // it. Admitting `.75rem` and admitting `0.3` are the same regex change; the unit tells them
    // apart. Scoping inline-spacing out of chart files would also have cleared it, and would have
    // dropped real coverage inside charts/ while leaving the false positive live everywhere else.
    const scale = (src: string): GuardKind[] =>
      kinds(checkSource(src, 'src/charts/kinds/Bars.tsx', DEFAULT_GUARD_CONFIG)).filter(
        (k) => k === 'inline-spacing',
      )
    expect(
      scale('const s = scalePoint<string>({ domain: d, range: [0, w], padding: 0.3 })'),
    ).toEqual([])
    expect(scale('const s = scaleBand({ padding: .2 })')).toEqual([])
    // A unitless INTEGER is still 4px by React's convention, and still a finding.
    expect(scale('<Box style={{ padding: 4 }} />')).toEqual(['inline-spacing'])
    // A fraction WITH a unit is a real length and still flags — above the sub-scale ceiling, since
    // 0.3rem is 4.8px and would be excused by the micro-spacing escape for that reason instead.
    expect(cssSpacing('padding: 0.7rem')).toEqual(['inline-spacing'])
  })

  it('reads a CSS number without its integer part, and one carrying an explicit +', () => {
    // `.75rem` IS `0.75rem` and `+12px` IS `12px`. Requiring a leading digit skipped both — the
    // same silent skip the `0.` guard was fixed for, one spelling over.
    expect(cssSpacing('padding: .75rem')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding: +12px')).toEqual(['inline-spacing'])
    // …and the sub-scale escape resolves them the same way: .5rem is 8px, below the floor.
    expect(cssSpacing('padding: .5rem')).toEqual([])
  })

  it('does NOT read a custom property whose NAME ends in a spacing word', () => {
    // A `\b` boundary sits inside a hyphenated identifier, so these matched as declarations. The
    // first is real generated output from the token layer; the second is the shape a consumer
    // writes. A custom property is a definition, not a rendered spacing decision.
    expect(cssSpacing('--vx-space-article-header-padding-bottom: 20px')).toEqual([])
    expect(cssSpacing('--card-padding-inline: 20px')).toEqual([])
    expect(cssSpacing('--card-gap: 20px')).toEqual([])
    // The declaration itself still flags — the fix narrows the boundary, it does not disarm it.
    expect(cssSpacing('padding-bottom: 20px')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding-inline: 20px')).toEqual(['inline-spacing'])
  })

  it('stays case-sensitive — neither dialect spells a property `Padding-Top`', () => {
    // Pins the decision documented above BOX_SIDE_KEBAB: unifying the two spellings with an `i`
    // flag would be the short way and would also match casings that are not properties at all.
    expect(cssSpacing('Padding-Top: 18px')).toEqual([])
    expect(cssSpacing('PADDING: 18px')).toEqual([])
  })

  it('keeps the default spacing steps in lockstep with the real scale', () => {
    // The guard's copy of the xs..xl ladder drifted once already (it still read 10/12/16/20/32
    // after the level-0 retune, so `p={16}` was flagged in favour of a `p="md"` worth 18, and the
    // genuine `p={18}` went unflagged). The copy exists to keep the headless core one file; this
    // asserts it stays honest.
    expect(DEFAULT_GUARD_CONFIG.spacingSteps).toEqual(Object.values(SPACE_SCALE))
  })

  it('resolves rem against the same root the token layer converts against', () => {
    // The guard keeps its own copy of the 16px root to stay dependency-free. The spacing-steps copy
    // beside it drifted in production once; this pins the relationship rather than the number, so a
    // token layer that ever moved off a 16px root would fail here instead of silently disagreeing.
    // 10px is the ceiling; 12px is the first value above it. Expressed through `pxRem` so the
    // literals here follow the token layer's conversion rather than restating it.
    expect(cssSpacing(`padding: ${pxRem(10)}`)).toEqual([])
    expect(cssSpacing(`padding: ${pxRem(12)}`)).toEqual(['inline-spacing'])
    // The px spellings of the same two values must land identically.
    expect(cssSpacing('padding: 10px')).toEqual([])
    expect(cssSpacing('padding: 12px')).toEqual(['inline-spacing'])
  })

  it('keeps the ceiling below the smallest scale stop, so it can never strand a real token', () => {
    // The relationship, not the number: if a density retune moves SPACE_SCALE.xs, this still holds.
    expect(cssSpacing(`gap: ${SPACE_SCALE.xs}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`gap: ${SPACE_SCALE.xs - 1}px`)).toEqual([])
  })

  it('leaves TSX untouched — an inline style object still has a prop form to prefer', () => {
    // `pl={4}` is a prop and never matched; `style={{ padding: 4 }}` did, and still should.
    expect(
      kinds(checkSource('<Box style={{ padding: 4 }} />', PATH, DEFAULT_GUARD_CONFIG)),
    ).toContain('inline-spacing')
    expect(kinds(checkSource('<Box pl={4} />', PATH, DEFAULT_GUARD_CONFIG))).not.toContain(
      'inline-spacing',
    )
  })

  it('does NOT false-positive raw-form-control on a CSS element selector (input, select, textarea)', () => {
    const f = checkSource(
      'input, select, textarea {\n  color: red;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT false-positive raw-spacing/raw-radius/off-identity-accent/raw-motion-value on CSS property syntax', () => {
    const f = checkSource(
      '.foo {\n  border-radius: 6px;\n  transition: all 0.3s ease;\n  color: teal;\n  gap: 16px;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-radius')
    expect(kinds(f)).not.toContain('raw-motion-value')
    expect(kinds(f)).not.toContain('off-identity-accent')
  })

  it('does NOT false-positive card-with-border/unframed-chart/chart-missing-aria-label/raw-visx-axis on CSS class selectors that echo JSX names', () => {
    const f = checkSource(
      '.Card {\n  border: 1px solid red;\n}\n.ChartLegend {\n  display: flex;\n}\n.AxisLeft {\n  color: red;\n}\n',
      'src/charts/kinds/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('card-with-border')
    expect(kinds(f)).not.toContain('unframed-chart')
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT false-positive localstorage-theme on CSS text', () => {
    const f = checkSource(
      "/* localStorage.getItem('theme') example */\n.foo { color: red; }\n",
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('localstorage-theme')
  })

  // ── Kebab longhands and logical properties ──────────────────────────────────
  //
  // The alternation was camelCase-only, so a CSS module got the scan for `padding` and not for
  // `padding-top` beside it. Nothing decided that; it fell out of a pattern written for TSX inline
  // styles. Logical properties are included because that is what modern CSS in this repo writes.

  it('flags kebab longhands at scale values', () => {
    expect(cssSpacing(`padding-top: ${SPACE_SCALE.md}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`margin-bottom: ${SPACE_SCALE.lg}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`row-gap: ${SPACE_SCALE.lg}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`column-gap: ${SPACE_SCALE.xl}px`)).toEqual(['inline-spacing'])
  })

  it('flags logical properties, including the -start/-end forms', () => {
    for (const prop of [
      'padding-block',
      'padding-inline',
      'margin-block',
      'margin-inline',
      'padding-inline-start',
      'margin-block-end',
    ]) {
      expect(cssSpacing(`${prop}: ${SPACE_SCALE.xl}px`)).toEqual(['inline-spacing'])
    }
  })

  it('extends the sub-scale escape to the longhands too — same rule, both spellings', () => {
    expect(cssSpacing('padding-top: 4px')).toEqual([])
    expect(cssSpacing('margin-inline: 8px')).toEqual([])
  })

  it('flags the camelCase logical properties in a TSX inline style', () => {
    expect(
      kinds(checkSource('<Box style={{ paddingInlineStart: 18 }} />', PATH, DEFAULT_GUARD_CONFIG)),
    ).toContain('inline-spacing')
  })

  // ── The `0.` blind spot ─────────────────────────────────────────────────────
  //
  // The zero-guard was `(?!0\b)`, and `\b` sits between `0` and `.` — so every value starting `0.`
  // matched the guard meant for a bare zero and dropped out of the scan entirely.

  it('sees values starting `0.` at all', () => {
    // 12px — a real spacing value that was previously invisible, not merely tolerated.
    expect(cssSpacing('padding: 0.75rem')).toEqual(['inline-spacing'])
  })

  it('still excuses a genuine zero', () => {
    expect(cssSpacing('padding: 0')).toEqual([])
    expect(cssSpacing('padding: 0px')).toEqual([])
  })

  it('resolves rem against the 16px root, so both spellings of one value agree', () => {
    // 0.25rem IS 4px. Accepting one spelling and flagging the other is the same arbitrariness the
    // kebab gap produced.
    expect(cssSpacing('padding: 0.25rem')).toEqual([])
    expect(cssSpacing('padding: 4px')).toEqual([])
    // The ceiling lands in the same place either way: 0.625rem = 10px, 0.75rem = 12px.
    expect(cssSpacing('padding: 0.625rem')).toEqual([])
    expect(cssSpacing('padding: 0.75rem')).toEqual(['inline-spacing'])
  })

  it('leaves units it cannot resolve without layout context alone', () => {
    for (const value of ['2em', '5%', '3ch', '2vw']) {
      expect(cssSpacing(`padding: ${value}`)).toEqual(['inline-spacing'])
    }
  })

  it('keeps the mixed-value and var() rules unchanged under the wider pattern', () => {
    expect(cssSpacing('padding: 4px 16px')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding-inline: 4px var(--vx-space-stack-xs)')).toEqual([])
  })
})

// ── exemptRules — per-rule, per-path guard exemptions ────────────────────────

describe('exemptRules', () => {
  const TEXT = `<div style={{ display: 'flex' }} />`

  it('drops a finding of an exempted kind at a matching path', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent'] },
    })
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('still fires at a non-matching path (path-scoped, not global)', () => {
    const f = checkSource(TEXT, 'src/dashboard/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent'] },
    })
    expect(kinds(f)).toContain('inline-display')
  })

  it('a trailing-slash pattern matches identically to the bare segment', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent/'] },
    })
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT match a substring of a segment (not a whole-segment match)', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['age'] },
    })
    expect(kinds(f)).toContain('inline-display')
  })

  it('does NOT suppress a different kind on the same line/path', () => {
    const f = checkSource(`const c = '#ff0000'; ${TEXT}`, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent'] },
    })
    expect(kinds(f)).not.toContain('inline-display')
    expect(kinds(f)).toContain('raw-hex')
  })

  it('exempts raw-html-layout, an INLINE-handled kind — proves the post-filter covers those too', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'raw-html-layout': ['agent'] },
    })
    expect(kinds(f)).not.toContain('raw-html-layout')
    // inline-display isn't exempted here, so it still fires from the same text.
    expect(kinds(f)).toContain('inline-display')
  })

  it('default (no exemptRules) behavior is unchanged', () => {
    const f = find(TEXT, 'src/agent/x.tsx')
    expect(kinds(f)).toContain('inline-display')
    expect(kinds(f)).toContain('raw-html-layout')
  })
})

// ── 20. severity ─────────────────────────────────────────────────────────────

describe('severity', () => {
  it('stamps every finding, defaulting to error', () => {
    const f = find(`<Box style={{ color: '#ff0000' }} />`)
    expect(f.length).toBeGreaterThan(0)
    expect(f.every((v) => v.severity === 'error')).toBe(true)
  })

  it('honours a per-kind consumer override without suppressing the finding', () => {
    // Turning a kind down must still REPORT it — severity is not an off switch. The per-kind
    // booleans and `exemptRules` are the off switches, and they stay separate on purpose.
    const cfg = { ...DEFAULT_GUARD_CONFIG, severity: { 'raw-hex': 'warn' as const } }
    const f = checkSource(`<Box style={{ color: '#ff0000' }} />`, PATH, cfg)
    const hex = f.filter((v) => v.kind === 'raw-hex')
    expect(hex).toHaveLength(1)
    expect(hex[0]?.severity).toBe('warn')
  })

  it('scopes the override to the named kind only', () => {
    const cfg = { ...DEFAULT_GUARD_CONFIG, severity: { 'raw-hex': 'warn' as const } }
    const f = checkSource(`<Box p={${SPACE_SCALE.md}} style={{ color: '#ff0000' }} />`, PATH, cfg)
    expect(f.find((v) => v.kind === 'raw-hex')?.severity).toBe('warn')
    expect(f.find((v) => v.kind === 'raw-spacing')?.severity).toBe('error')
  })

  it('ships no kind in its grace period today', () => {
    // Every shipped kind is past its grace minor. This is a LEDGER, not a constraint: when a new
    // kind lands warn-only, this expectation changes in the same commit, and changing it back is
    // the promotion. A grace entry that outlives its minor shows up here as an unexplained diff.
    const cfg = DEFAULT_GUARD_CONFIG
    const everyKind = checkSource(
      `<Box p={${SPACE_SCALE.md}} radius={4} style={{ color: '#ff0000', gap: 3 }} />`,
      PATH,
      cfg,
    )
    expect(everyKind.length).toBeGreaterThan(0)
    expect(everyKind.every((v) => v.severity === 'error')).toBe(true)
  })
})
