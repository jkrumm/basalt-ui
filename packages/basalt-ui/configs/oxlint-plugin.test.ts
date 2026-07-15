/**
 * Integration tests for the shipped `basalt` oxlint JS plugin (`oxlint-plugin.js`) — exercises the
 * real oxlint binary against small fixture files, the same way a consumer's lint run would.
 *
 * Each fixture repo gets a minimal `.oxlintrc.json` pointing `jsPlugins` at the plugin (absolute
 * path — verified to resolve the same as the relative path the shipped/repo configs use) and
 * enabling all three rules. `runOxlint` shells the workspace-root `node_modules/.bin/oxlint` binary
 * and returns the parsed set of `basalt/<rule>` diagnostics it printed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

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
      },
    }),
  )
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Writes `source` as the sole fixture file and runs oxlint against the temp fixture repo. */
function run(source: string, filename = 'fixture.tsx'): { code: number; rules: Set<string> } {
  writeFileSync(resolve(dir, filename), source)
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
