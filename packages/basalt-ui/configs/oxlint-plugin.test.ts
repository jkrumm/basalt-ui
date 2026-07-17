/**
 * Integration tests for the shipped `basalt` oxlint JS plugin (`oxlint-plugin.js`) — exercises the
 * real oxlint binary against small fixture files, the same way a consumer's lint run would.
 *
 * Each fixture repo gets a minimal `.oxlintrc.json` pointing `jsPlugins` at the plugin (absolute
 * path — verified to resolve the same as the relative path the shipped/repo configs use) and
 * enabling every rule this file tests. `run` shells the workspace-root `node_modules/.bin/oxlint`
 * binary and returns the parsed set of `basalt/<rule>` diagnostics it printed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

const PLUGIN_PATH = resolve(import.meta.dirname, 'oxlint-plugin.js')
const OXLINT_BIN = resolve(import.meta.dirname, '..', '..', '..', 'node_modules', '.bin', 'oxlint')

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-oxlint-plugin-'))
  writeFileSync(
    resolve(dir, '.oxlintrc.json'),
    JSON.stringify({
      plugins: [],
      jsPlugins: [PLUGIN_PATH],
      rules: {
        'basalt/no-raw-font-size': 'error',
        'basalt/card-inset': 'error',
        'basalt/chart-in-raw-surface': 'error',
        'basalt/visx-boundary': 'error',
        'basalt/visx-tooltip': 'error',
        'basalt/token-layer-boundary': 'error',
      },
    }),
  )
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Writes `source` as the sole fixture file and runs oxlint against the temp fixture repo. */
function run(source: string, filename = 'fixture.tsx'): { code: number; rules: Set<string> } {
  const filePath = resolve(dir, filename)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, source)
  const result = Bun.spawnSync([OXLINT_BIN, '-c', '.oxlintrc.json', filename], { cwd: dir })
  const output = `${result.stdout}${result.stderr}`
  const rules = new Set(
    [...output.matchAll(/\(basalt\/([\w-]+)\)/g)].map((match) => match[1] as string),
  )
  return { code: result.exitCode ?? 0, rules }
}

// ── no-raw-font-size ─────────────────────────────────────────────────────────

describe('basalt/no-raw-font-size', () => {
  it('flags a numeric fz JSX attribute', () => {
    const { code, rules } = run(`export const C = () => <Text fz={10}>a</Text>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  it('does NOT flag a string fz token', () => {
    const { code, rules } = run(`export const C = () => <Text fz="md">a</Text>\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })

  it('does NOT flag a numeric fontSize with a same-line theme-allow comment', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz={10} /* theme-allow: legacy */>a</Text>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })
})

// ── card-inset ───────────────────────────────────────────────────────────────

describe('basalt/card-inset', () => {
  it('flags an off-idiom padding value on Card', () => {
    const { code, rules } = run(`export const C = () => <Card p="md" />\n`)
    expect(code).toBe(1)
    expect(rules).toContain('card-inset')
  })

  it('does NOT flag the xs/sm inset idiom on Paper', () => {
    const { code, rules } = run(`export const C = () => <Paper py="xs" px="sm" />\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('card-inset')
  })
})

// ── chart-in-raw-surface ──────────────────────────────────────────────────────

describe('basalt/chart-in-raw-surface', () => {
  it('flags a chart-kind element inside a raw Card', () => {
    const { code, rules } = run(`export const C = () => <Card><ZonedLine data={[]} /></Card>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('chart-in-raw-surface')
  })

  it('does NOT flag a chart passed as a prop value (not a Card/Paper subtree)', () => {
    const { code, rules } = run(
      `export const C = () => <Card><StatCard sparkline={<LineSparkline />} /></Card>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-in-raw-surface')
  })
})

// ── visx-boundary ────────────────────────────────────────────────────────────

describe('basalt/visx-boundary', () => {
  it('flags a @visx/* import outside charts', () => {
    const { code, rules } = run(`import { scaleLinear } from '@visx/scale'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('does NOT flag a @visx/* import inside charts', () => {
    const { code, rules } = run(`import { scaleLinear } from '@visx/scale'\n`, 'charts/lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('visx-boundary')
  })

  it('does NOT flag a @mantine/* import (out of scope for this rule)', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'lib.tsx')
    expect(code).toBe(0)
    expect(rules).not.toContain('visx-boundary')
  })

  it('still flags a @visx/* import outside charts carrying a theme-allow comment (no escape hatch)', () => {
    const { code, rules } = run(
      `// theme-allow: legacy\nimport { scaleLinear } from '@visx/scale'\n`,
      'lib.ts',
    )
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('flags a source-bearing named re-export of @visx/* outside charts', () => {
    const { code, rules } = run(`export { scaleLinear } from '@visx/scale'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('flags a wildcard re-export of @visx/* outside charts', () => {
    const { code, rules } = run(`export * from '@visx/scale'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('does NOT flag a plain local named export (no source)', () => {
    const { code, rules } = run(`const x = 1\nexport { x }\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('visx-boundary')
  })
})

// ── visx-tooltip ─────────────────────────────────────────────────────────────

describe('basalt/visx-tooltip', () => {
  it('flags @visx/tooltip even inside charts', () => {
    const { code, rules } = run(`import { Tooltip } from '@visx/tooltip'\n`, 'charts/lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('visx-tooltip')
  })

  it('flags @visx/tooltip outside charts too', () => {
    const { code, rules } = run(`import { Tooltip } from '@visx/tooltip'\n`, 'lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('visx-tooltip')
  })

  it('takes precedence over basalt/visx-boundary for @visx/tooltip specifically', () => {
    const { rules } = run(`import { Tooltip } from '@visx/tooltip'\n`, 'lib.tsx')
    expect(rules).toContain('visx-tooltip')
    expect(rules).not.toContain('visx-boundary')
  })
})

// ── token-layer-boundary ─────────────────────────────────────────────────────

describe('basalt/token-layer-boundary', () => {
  it('flags a @mantine/* import inside charts', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'charts/lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('token-layer-boundary')
  })

  it('flags a @mantine/* import inside tokens', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'tokens/lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('token-layer-boundary')
  })

  it('does NOT flag a @mantine/* import outside charts/tokens', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'lib.tsx')
    expect(code).toBe(0)
    expect(rules).not.toContain('token-layer-boundary')
  })
})

// ── rule independence ──────────────────────────────────────────────────────────
// The three rules used to be one bundled `import-boundary` rule with a single on/off toggle — a
// consumer disabling the one check they disagreed with silently dropped the other two. Proves
// disabling one of the three leaves the other two enforced.

describe('rule independence', () => {
  it('disabling basalt/visx-boundary leaves basalt/visx-tooltip enforced', () => {
    writeFileSync(
      resolve(dir, '.oxlintrc.json'),
      JSON.stringify({
        plugins: [],
        jsPlugins: [PLUGIN_PATH],
        rules: {
          'basalt/visx-boundary': 'off',
          'basalt/visx-tooltip': 'error',
          'basalt/token-layer-boundary': 'error',
        },
      }),
    )
    const { code, rules } = run(
      `import { scaleLinear } from '@visx/scale'\nimport { Tooltip } from '@visx/tooltip'\n`,
      'lib.ts',
    )
    expect(code).toBe(1)
    expect(rules).not.toContain('visx-boundary')
    expect(rules).toContain('visx-tooltip')
  })
})
