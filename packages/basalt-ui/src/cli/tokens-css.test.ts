/**
 * `basalt-ui tokens:css` — the install-free path to the token system.
 *
 * The contract these tests hold is that the command is a FLAG PARSER, nothing more: whatever it
 * prints must be exactly what `buildPaletteCss` returns for the same options. If the CLI ever grows
 * emission logic of its own, a consumer who ran `bunx basalt-ui tokens:css` and a consumer who
 * imported `basalt-ui/tokens` would be looking at two different design systems.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { buildPaletteCss } from '../tokens'
import { run, tokensCss } from './index'

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

describe('tokens:css', () => {
  it('with no flags emits the shipped default, byte for byte', () => {
    expect(emit([])).toBe(readFileSync(FIXTURE, 'utf8'))
  })

  it('forwards the selector flags to buildPaletteCss and adds nothing of its own', () => {
    const flags = ['--selector-attribute', 'data-theme', '--default-scheme', 'light']
    expect(emit(flags)).toBe(
      buildPaletteCss({ scheme: { attribute: 'data-theme' }, defaultScheme: 'light' }),
    )
  })

  it('forwards the scheme VALUES and the media fallback', () => {
    const flags = ['--dark-value', 'night', '--light-value', 'day', '--media-fallback']
    expect(emit(flags)).toBe(
      buildPaletteCss({ scheme: { darkValue: 'night', lightValue: 'day' }, mediaFallback: true }),
    )
  })

  it('forwards --only core', () => {
    expect(emit(['--only', 'core'])).toBe(buildPaletteCss({ only: 'core' }))
  })

  it('rejects an unknown --only instead of silently emitting everything', () => {
    expect(tokensCss(['--only', 'spacing', '--out', 'out.css'], dir)).toBe(1)
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('creates the parent directory of --out', () => {
    const css = emit([], 'nested/deep/tokens.css')
    expect(css.startsWith(':root {')).toBe(true)
  })

  it('rejects an unknown --default-scheme instead of silently defaulting', () => {
    const code = tokensCss(['--default-scheme', 'sepia', '--out', 'out.css'], dir)
    expect(code).toBe(1)
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
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
