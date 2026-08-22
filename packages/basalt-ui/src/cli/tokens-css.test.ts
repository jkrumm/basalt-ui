/**
 * `basalt-ui tokens:css` — the install-free path to the token system.
 *
 * The contract these tests hold is that the command holds no emission logic of its own: the token
 * VALUES it prints must be exactly what `buildPaletteCss` returns for the same options, or a
 * consumer who ran `bunx basalt-ui tokens:css` and one who imported `basalt-ui/tokens` would be
 * looking at two different design systems. What the command DOES add is file framing for an
 * artifact a consumer commits — the `@generated` header, a trailing newline, `rgba()` spacing —
 * which `body()` below strips before every comparison. See `./toolchain-wiring.test.ts` for the
 * framing's own tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { GENERATED_HEADER_LINE } from '../guard'
import { buildPaletteCss } from '../tokens'
import { normalizeColorFunctions, run, tokensCss } from './index'

const FIXTURE = join(import.meta.dir, '..', '..', 'tests', 'fixtures', 'palette-default.css')

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-tokens-css-'))
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Run the command with `--out`, returning the written file — stdout is awkward to capture here. */
function emit(flags: string[], out = 'out.css'): string {
  const code = tokensCss([...flags, '--out', out], dir)
  expect(code).toBe(0)
  return readFileSync(resolve(dir, out), 'utf8')
}

/** The emitted file minus the two-line generated header and the trailing newline. */
function body(flags: string[], out = 'out.css'): string {
  return emit(flags, out).split('\n').slice(2).join('\n').replace(/\n$/, '')
}

/** What `buildPaletteCss` returns, in the CLI's commit-safe formatting. */
function expected(opts: Parameters<typeof buildPaletteCss>[0]): string {
  return normalizeColorFunctions(buildPaletteCss(opts))
}

describe('tokens:css', () => {
  it('with no flags emits the shipped default, byte for byte under the header', () => {
    expect(body([])).toBe(normalizeColorFunctions(readFileSync(FIXTURE, 'utf8')))
  })

  it('forwards the selector flags to buildPaletteCss and adds nothing of its own', () => {
    const flags = ['--selector-attribute', 'data-theme', '--default-scheme', 'light']
    expect(body(flags)).toBe(
      expected({ scheme: { attribute: 'data-theme' }, defaultScheme: 'light' }),
    )
  })

  it('forwards the scheme VALUES and the media fallback', () => {
    const flags = ['--dark-value', 'night', '--light-value', 'day', '--media-fallback']
    expect(body(flags)).toBe(
      expected({ scheme: { darkValue: 'night', lightValue: 'day' }, mediaFallback: true }),
    )
  })

  it('forwards --only core', () => {
    expect(body(['--only', 'core'])).toBe(expected({ only: 'core' }))
  })

  it('rejects an unknown --only instead of silently emitting everything', () => {
    expect(tokensCss(['--only', 'spacing', '--out', 'out.css'], dir)).toBe(1)
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('creates the parent directory of --out', () => {
    const css = emit([], 'nested/deep/tokens.css')
    expect(css).toContain(':root {')
  })

  it('rejects an unknown --default-scheme instead of silently defaulting', () => {
    const code = tokensCss(['--default-scheme', 'sepia', '--out', 'out.css'], dir)
    expect(code).toBe(1)
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('--no-legacy-aliases drops every deprecated camelCase spelling while the canonical kebab names still resolve', () => {
    const css = emit(['--no-legacy-aliases'])
    expect(css).not.toContain('--vx-accentFill')
    expect(css).not.toContain('--vx-tooltipBg')
    expect(css).not.toContain('--vx-fillHover-')
    expect(css).not.toContain('--vx-goodSoft')
    expect(css).not.toContain('Deprecated camelCase aliases')
    expect(css).toContain('--vx-accent-fill:')
    expect(css).toContain('--vx-tooltip-bg:')
    expect(css).toContain('--vx-fill-hover-')
    expect(css).toContain('--vx-good-soft:')
  })

  it('--no-legacy-aliases output is byte-identical to buildPaletteCss({ legacyAliases: false }) — the CLI holds no emission logic of its own', () => {
    expect(body(['--no-legacy-aliases'])).toBe(expected({ legacyAliases: false }))
  })

  it('`--help` short-circuits before the command runs — no file written', () => {
    const originalLog = console.log
    let log = ''
    console.log = (...args: unknown[]) => {
      log += `${args.join(' ')}\n`
    }
    try {
      expect(run(['tokens:css', '--out', 'out.css', '--help'], dir)).toBe(0)
    } finally {
      console.log = originalLog
    }
    expect(log).toContain('Usage: basalt')
    expect(readdirSync(dir)).toEqual(['package.json'])
  })
})

/**
 * `--check` gates the token VALUES, never the provenance line.
 *
 * Line 2 of the generated header carries the emitting version, and `--check` used to compare the
 * whole file byte for byte — so every basalt-ui release forced a mandatory no-op commit in every
 * consumer that commits a generated sheet: regenerate, one line moves, nothing else, ship it. That
 * is the rot pattern removed from DESIGN.md this cycle, on a file whose gate is byte-equality.
 */
describe('tokens:css --check and the provenance line', () => {
  /** Capture stdout/stderr so the check's own sentence can be asserted. */
  function check(out: string): { code: number; log: string } {
    const originalLog = console.log
    const originalError = console.error
    let log = ''
    const sink = (...args: unknown[]) => {
      log += `${args.join(' ')}\n`
    }
    console.log = sink
    console.error = sink
    try {
      return { code: tokensCss(['--check', '--out', out], dir), log }
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  }

  it('passes when only the emitting VERSION on line 2 differs', () => {
    const emitted = emit([])
    const lines = emitted.split('\n')
    lines[1] = (lines[1] as string).replace(/basalt-ui [\d.]+/, 'basalt-ui 0.0.1')
    writeFileSync(resolve(dir, 'out.css'), lines.join('\n'))

    const { code, log } = check('out.css')
    expect(code).toBe(0)
    expect(log).toContain('is up to date')
    expect(log).toContain('provenance line still names an older basalt-ui')
  })

  it('says nothing about provenance when the file is byte-identical', () => {
    emit([])
    const { code, log } = check('out.css')
    expect(code).toBe(0)
    expect(log).not.toContain('provenance line')
  })

  it('STILL fails when a token value actually moved', () => {
    const emitted = emit([])
    writeFileSync(resolve(dir, 'out.css'), emitted.replace('--vx-neutral', '--vx-neutrall'))
    const { code, log } = check('out.css')
    expect(code).toBe(1)
    expect(log).toContain('differs from what')
  })

  it('the header itself is unchanged — the `@generated` exemption needs both lines verbatim', () => {
    const lines = emit([]).split('\n')
    expect(lines[0]).toBe(GENERATED_HEADER_LINE)
    expect(lines[1]).toMatch(/^\/\* basalt-ui [\d.]+ — `basalt-ui tokens:css --out out\.css` \*\/$/)
  })
})
