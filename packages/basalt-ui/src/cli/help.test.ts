/**
 * `--help` / `-h` / `help` must short-circuit BEFORE any subcommand dispatch — a read request must
 * never mutate. Regression: `bunx basalt-ui sync --help` used to run `sync` in full (the switch
 * matched `cmd === 'sync'` first and `--help` was just another item in `flags`, ignored).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { MANIFEST_PATH, run } from './index'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-help-'))
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Captures console.log/console.error so assertions don't depend on terminal state. */
function capture(fn: () => number | Promise<number>): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  console.log = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.error = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  try {
    const result = fn()
    if (result instanceof Promise) throw new TypeError('run() returned a Promise in a sync test')
    return { code: result, log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

describe('run() --help short-circuits before dispatch', () => {
  it('`sync --help` prints usage and exits 0 without writing the manifest or any managed file', () => {
    const { code, log } = capture(() => run(['sync', '--help'], dir))
    expect(code).toBe(0)
    expect(log).toContain('Usage: basalt')
    expect(existsSync(resolve(dir, MANIFEST_PATH))).toBe(false)
    // No managed files scaffolded either — a genuinely inert run.
    expect(readdirSync(dir)).toEqual(['package.json'])
  })

  it('`init --help` prints usage and exits 0 without scaffolding anything', () => {
    const { code, log } = capture(() => run(['init', '--help'], dir))
    expect(code).toBe(0)
    expect(log).toContain('Usage: basalt')
    expect(existsSync(resolve(dir, MANIFEST_PATH))).toBe(false)
    expect(readdirSync(dir)).toEqual(['package.json'])
  })

  it('`sync -h` (short flag) also short-circuits', () => {
    const { code, log } = capture(() => run(['sync', '-h'], dir))
    expect(code).toBe(0)
    expect(log).toContain('Usage: basalt')
    expect(existsSync(resolve(dir, MANIFEST_PATH))).toBe(false)
  })

  it('the bare `help` command prints usage and exits 0', () => {
    const { code, log } = capture(() => run(['help'], dir))
    expect(code).toBe(0)
    expect(log).toContain('Usage: basalt')
  })

  it('`--help` with no subcommand prints usage and exits 0', () => {
    const { code, log } = capture(() => run(['--help'], dir))
    expect(code).toBe(0)
    expect(log).toContain('Usage: basalt')
  })

  it('an unknown command (no --help) still prints usage but exits 1', () => {
    const { code, log } = capture(() => run(['bogus'], dir))
    expect(code).toBe(1)
    expect(log).toContain('Usage: basalt')
  })

  it('`sync` without --help still runs for real and writes the manifest (control case)', () => {
    const { code } = capture(() => run(['sync'], dir))
    expect(code).toBe(0)
    expect(existsSync(resolve(dir, MANIFEST_PATH))).toBe(true)
  })
})
