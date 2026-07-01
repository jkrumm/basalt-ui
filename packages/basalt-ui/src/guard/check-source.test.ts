/**
 * Unit tests for checkSource — the pure (text, relPath, cfg) → Finding[] core.
 *
 * Covers all 13 guard kinds. Co-located with the guard, excluded from tsc
 * (tsconfig exclude: src/**\/*.test.ts), run via `bun test`.
 *
 * The walker/reporter half is covered by the integration test in
 * src/cli/check-theme.test.ts (temp-dir + exit-code contract).
 */
import { describe, expect, it } from 'bun:test'
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

  it('does NOT flag a pure block comment line', () => {
    const f = find(`* use rgba() for opacity`)
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

// ── 5. raw-spacing ───────────────────────────────────────────────────────────

describe('raw-spacing', () => {
  it('flags p={16} (default spacing step)', () => {
    const f = find(`<Box p={16} />`)
    expect(kinds(f)).toContain('raw-spacing')
  })

  it('flags gap={12}', () => {
    const f = find(`<Stack gap={12} />`)
    expect(kinds(f)).toContain('raw-spacing')
  })

  it('does NOT flag p={8} (not a default step)', () => {
    const f = find(`<Box p={8} />`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })

  it('does NOT flag p="md" (string token)', () => {
    const f = find(`<Box p="md" />`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box p={16} /> // theme-allow`)
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

  it('skips a * JSDoc body line', () => {
    const f = find(` * Use rgba() for opacity, not raw hex`)
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
