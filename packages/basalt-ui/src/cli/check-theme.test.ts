/**
 * Tests for the `basalt check-theme` guard — specifically the `raw-surface` check that flags
 * ad-hoc inline surface styling (border / borderRadius / boxShadow) in consumer code.
 *
 * `checkTheme(cwd)` scans the configured `roots` (from the consumer package.json `"basalt"` key)
 * and returns 0 (clean) / 1 (violations), printing findings to stderr. Each case writes a tiny
 * fixture repo into a temp dir, runs the guard against it, and asserts on the exit code plus the
 * captured `raw-surface` lines.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { checkTheme } from './index.ts'

let dir: string

/** Write a consumer fixture: a package.json pointing `roots` at `src`, plus one component file. */
function fixture(source: string, basalt: Record<string, unknown> = { roots: ['src'] }): void {
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture', basalt }))
  mkdirSync(resolve(dir, 'src'), { recursive: true })
  writeFileSync(resolve(dir, 'src', 'Card.tsx'), source)
}

/**
 * Write a consumer fixture at an arbitrary path under the scanned root (e.g. a `charts/` subdir),
 * so the path-gated `raw-visx-axis` guard can be exercised. `relPath` is relative to `src`.
 */
function fixtureAt(
  relPath: string,
  source: string,
  basalt: Record<string, unknown> = { roots: ['src'] },
): void {
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture', basalt }))
  const abs = resolve(dir, 'src', relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, source)
}

/** Run the guard against the fixture, capturing stderr so we can assert on the emitted kinds. */
function run(): { code: number; err: string } {
  const original = console.error
  let err = ''
  console.error = (...args: unknown[]) => {
    err += `${args.join(' ')}\n`
  }
  try {
    return { code: checkTheme(dir), err }
  } finally {
    console.error = original
  }
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-check-theme-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('check-theme raw-surface', () => {
  it('flags a raw inline border literal', () => {
    fixture(`export const C = () => <div style={{ border: '1px solid #ccc' }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-surface')
  })

  it('flags a numeric borderRadius literal', () => {
    fixture(`export const C = () => <div style={{ borderRadius: 8 }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-surface')
  })

  it('flags a boxShadow literal', () => {
    fixture(`export const C = () => <div style={{ boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-surface')
  })

  it('does NOT flag a line carrying a theme-allow comment', () => {
    fixture(
      `export const C = () => <div style={{ borderRadius: 8 }} /> // theme-allow: legacy widget\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })

  it('does NOT flag a var(--…) radius token', () => {
    fixture(`export const C = () => <div style={{ borderRadius: 'var(--vx-radius-card)' }} />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })

  it('does NOT flag a var(--…) border token (regression: var() not adjacent to the quote)', () => {
    // Use a Mantine component (not a raw <div>) so this isolates raw-surface's var() lookahead
    // without also tripping the raw-html-layout guard (border is a layout/surface prop).
    fixture(
      `export const C = () => <Box style={{ border: '1px solid var(--vx-surface-border)' }} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })

  it('does NOT flag a var(--…) boxShadow token (regression)', () => {
    fixture(`export const C = () => <div style={{ boxShadow: 'var(--mantine-shadow-sm)' }} />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })

  it('does NOT flag a Mantine radius="md" prop (not inline surface styling)', () => {
    fixture(`export const C = () => <Card withBorder radius="md" />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })

  it('does NOT flag an unrelated inline style (display: flex)', () => {
    // A Mantine component with an inline flex/padding is not raw-surface. (display/spacing on a raw
    // <div> is covered by the dedicated inline-display / raw-html-layout / inline-spacing checks.)
    fixture(`export const C = () => <Box style={{ display: 'flex', padding: 8 }} />\n`, {
      roots: ['src'],
      inlineDisplay: false,
      inlineSpacing: false,
    })
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })

  it('respects the rawSurface:false config knob', () => {
    fixture(`export const C = () => <div style={{ borderRadius: 8 }} />\n`, {
      roots: ['src'],
      rawSurface: false,
    })
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-surface')
  })
})

describe('check-theme off-system-surface-var', () => {
  it('flags a raw Mantine gray ramp step used for surface color', () => {
    fixture(
      `export const C = () => <Box style={{ borderColor: 'var(--mantine-color-gray-3)' }} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('off-system-surface-var')
  })

  it('flags a raw Mantine dark ramp step', () => {
    fixture(`export const C = () => <Box bg="var(--mantine-color-dark-6)" />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('off-system-surface-var')
  })

  it('does NOT flag a --vx-surface-* token', () => {
    fixture(`export const C = () => <Box bg="var(--vx-surface-panel)" />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('off-system-surface-var')
  })

  it('does NOT flag a named Mantine surface var (default-border)', () => {
    fixture(`export const C = () => <Box bg="var(--mantine-color-default-border)" />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('off-system-surface-var')
  })

  it('respects the offSystemSurfaceVar:false config knob', () => {
    fixture(`export const C = () => <Box bg="var(--mantine-color-gray-3)" />\n`, {
      roots: ['src'],
      offSystemSurfaceVar: false,
    })
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('off-system-surface-var')
  })

  it('does NOT flag a line carrying a theme-allow comment', () => {
    fixture(
      `export const C = () => <Box bg="var(--mantine-color-gray-3)" /> // theme-allow: legacy\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('off-system-surface-var')
  })
})

describe('check-theme raw-html-layout', () => {
  it('flags a raw <div> with inline layout styling', () => {
    fixture(`export const C = () => <div style={{ display: 'flex', gap: 8 }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-html-layout')
  })

  it('flags a raw <section> with inline padding', () => {
    fixture(`export const C = () => <section style={{ padding: 16 }}>x</section>\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-html-layout')
  })

  it('does NOT flag a bare <div ref={...}> with no style', () => {
    fixture(`export const C = (r) => <div ref={r} className="x" />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-html-layout')
  })

  it('does NOT flag an <img> (not a layout element)', () => {
    fixture(`export const C = () => <img style={{ width: 40, height: 40 }} src="a.png" />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-html-layout')
  })

  it('respects the rawHtmlLayout:false config knob', () => {
    fixture(`export const C = () => <div style={{ display: 'flex' }} />\n`, {
      roots: ['src'],
      rawHtmlLayout: false,
      // disable the overlapping checks so we isolate raw-html-layout
      inlineDisplay: false,
    })
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-html-layout')
  })

  it('does NOT flag a line carrying a theme-allow comment', () => {
    fixture(`export const C = () => <div style={{ display: 'flex' }} /> // theme-allow\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-html-layout')
  })
})

describe('check-theme inline-spacing', () => {
  it('flags an inline padding literal', () => {
    fixture(`export const C = () => <Box style={{ padding: 16 }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('inline-spacing')
  })

  it('flags an inline marginTop string literal', () => {
    fixture(`export const C = () => <Box style={{ marginTop: '12px' }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('inline-spacing')
  })

  it('does NOT flag a zero value', () => {
    fixture(`export const C = () => <Box style={{ padding: 0, color: 'red' }} />\n`)
    const { err } = run()
    expect(err).not.toContain('inline-spacing')
  })

  it('does NOT flag a var(--…) gap token', () => {
    fixture(`export const C = () => <Box style={{ gap: 'var(--mantine-spacing-md)' }} />\n`)
    const { err } = run()
    expect(err).not.toContain('inline-spacing')
  })

  it('respects the inlineSpacing:false config knob', () => {
    fixture(`export const C = () => <Box style={{ padding: 16 }} />\n`, {
      roots: ['src'],
      inlineSpacing: false,
    })
    const { err } = run()
    expect(err).not.toContain('inline-spacing')
  })

  it('does NOT flag a line carrying a theme-allow comment', () => {
    fixture(`export const C = () => <Box style={{ padding: 16 }} /> // theme-allow\n`)
    const { err } = run()
    expect(err).not.toContain('inline-spacing')
  })
})

describe('check-theme inline-display', () => {
  it('flags an inline display:flex', () => {
    fixture(`export const C = () => <Box style={{ display: 'flex' }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('inline-display')
  })

  it('flags an inline display:grid', () => {
    fixture(`export const C = () => <Box style={{ display: "grid" }} />\n`)
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('inline-display')
  })

  it('does NOT flag display:block', () => {
    fixture(`export const C = () => <Box style={{ display: 'block' }} />\n`)
    const { err } = run()
    expect(err).not.toContain('inline-display')
  })

  it('respects the inlineDisplay:false config knob', () => {
    fixture(`export const C = () => <Box style={{ display: 'flex' }} />\n`, {
      roots: ['src'],
      inlineDisplay: false,
    })
    const { err } = run()
    expect(err).not.toContain('inline-display')
  })

  it('does NOT flag a line carrying a theme-allow comment', () => {
    fixture(`export const C = () => <Box style={{ display: 'flex' }} /> // theme-allow\n`)
    const { err } = run()
    expect(err).not.toContain('inline-display')
  })
})

describe('check-theme raw-visx-axis', () => {
  it('flags a raw <AxisLeft> in a chart file', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => <AxisLeft scale={s} numTicks={4} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-visx-axis')
  })

  it('flags a raw <AxisBottom> and <AxisRight> in a chart file', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => (\n  <>\n    <AxisBottom scale={x} />\n    <AxisRight scale={y} />\n  </>\n)\n`,
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-visx-axis')
  })

  it('does NOT flag a chart-path <AxisLeft> carrying a theme-allow comment', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => <AxisLeft scale={s} /> // theme-allow: bespoke dual-panel\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-visx-axis')
  })

  it('does NOT flag a raw <AxisLeft> in a NON-chart path', () => {
    fixtureAt('widgets/Foo.tsx', `export const Foo = () => <AxisLeft scale={s} />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-visx-axis')
  })

  it('does NOT flag AxisLeftNumeric usage in a chart file', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => <AxisLeftNumeric scale={s} numTicks={4} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-visx-axis')
  })

  it('does NOT flag raw <AxisLeft> in the Axes.tsx wrapper primitive', () => {
    fixtureAt(
      'charts/primitives/Axes.tsx',
      `export const AxisLeftNumeric = (p) => <AxisLeft {...p} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-visx-axis')
  })

  it('respects the rawVisxAxis:false config knob', () => {
    fixtureAt('charts/kinds/Foo.tsx', `export const Foo = () => <AxisLeft scale={s} />\n`, {
      roots: ['src'],
      rawVisxAxis: false,
    })
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-visx-axis')
  })
})

describe('check-theme unframed-chart', () => {
  it('flags a hand-rolled <ChartLegend items={[...]}> array literal', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => <ChartLegend items={[{ key: 'a', label: 'A', color: '#fff' }]} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('unframed-chart')
  })

  it('flags a hand-rolled legend array literal formatted across multiple lines', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      [
        'export const Foo = () => (',
        '  <ChartLegend',
        "    items={[{ key: 'a', label: 'A', color: VX.line }]}",
        '    placement="bottom"',
        '  />',
        ')',
        '',
      ].join('\n'),
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('unframed-chart')
  })

  it('does NOT flag a derived legend (items={deriveLegend(series)})', () => {
    fixtureAt(
      'charts/primitives/ChartFrame.tsx',
      [
        'export const Foo = () => (',
        '  <ChartLegend',
        '    items={deriveLegend(series)}',
        '    placement={placement}',
        '  />',
        ')',
        '',
      ].join('\n'),
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('unframed-chart')
  })

  it('does NOT flag an unrelated items={[...]} prop on a non-ChartLegend component', () => {
    fixtureAt('widgets/Menu.tsx', `export const Foo = () => <Menu items={[{ label: 'a' }]} />\n`)
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('unframed-chart')
  })

  it('respects the unframedChart:false config knob', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => <ChartLegend items={[{ key: 'a', label: 'A' }]} />\n`,
      { roots: ['src'], unframedChart: false },
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('unframed-chart')
  })

  it('does NOT flag a line carrying a theme-allow comment', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `export const Foo = () => <ChartLegend items={[{ key: 'a', label: 'A' }]} /> // theme-allow: bespoke legend\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('unframed-chart')
  })
})

describe('check-theme roots fail-loud', () => {
  it('exits non-zero when the built-in default roots match zero files', () => {
    // No "basalt.roots" in package.json — falls back to the built-in defaults
    // (apps/dashboard/src, packages/charts/src), which don't exist under this fixture at all.
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('basalt.roots')
  })

  it('exits non-zero when explicitly configured roots match zero files', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ name: 'fixture', basalt: { roots: ['nonexistent-dir'] } }),
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('nonexistent-dir')
  })

  it('stays green when the configured roots match at least one file', () => {
    fixture(`export const C = () => <Box p="md" />\n`)
    const { code } = run()
    expect(code).toBe(0)
  })
})

describe('check-theme comment skipping', () => {
  it('does NOT flag a banned element mentioned in a pure line comment', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `// never render a raw <AxisLeft> — use AxisLeftNumeric\nexport const Foo = () => <AxisLeftNumeric scale={s} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('raw-visx-axis')
  })

  it('does NOT flag a banned token mentioned in a JSDoc body line', () => {
    fixture(
      `/**\n * Avoid var(--mantine-color-gray-3); use the surface token.\n */\nexport const C = 1\n`,
    )
    const { code, err } = run()
    expect(code).toBe(0)
    expect(err).not.toContain('off-system-surface-var')
  })

  it('still flags the real violation on a code line even when a comment mentions it too', () => {
    fixtureAt(
      'charts/kinds/Foo.tsx',
      `// raw <AxisLeft> is banned\nexport const Foo = () => <AxisLeft scale={s} />\n`,
    )
    const { code, err } = run()
    expect(code).toBe(1)
    expect(err).toContain('raw-visx-axis')
  })
})
