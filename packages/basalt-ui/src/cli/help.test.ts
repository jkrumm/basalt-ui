/**
 * `--help` / `-h` / `help` must short-circuit BEFORE any subcommand dispatch — a read request must
 * never mutate. Regression: `bunx basalt-ui sync --help` used to run `sync` in full (the switch
 * matched `cmd === 'sync'` first and `--help` was just another item in `flags`, ignored).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { unknownFlag } from './help'
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
    // `sync` refuses to scaffold where nothing was ever installed, so the control case has to be a
    // repo that HAS an install — which is what `sync` is for.
    mkdirSync(resolve(dir, '.basalt'), { recursive: true })
    writeFileSync(resolve(dir, MANIFEST_PATH), JSON.stringify({ version: 1, files: {} }))
    const { code } = capture(() => run(['sync'], dir))
    expect(code).toBe(0)
    expect(existsSync(resolve(dir, MANIFEST_PATH))).toBe(true)
  })
})

/**
 * `--version` and the unknown-flag gate — one failure mode, two halves.
 *
 * Six consumer repos in one upgrade round reached for `basalt-ui --version` to prove WHICH CLI ran
 * (a `bunx` cache does not re-resolve, so a pinned version and the version that gates you can
 * differ) and got a usage dump with no version in it. The other half is the same shape: an
 * unrecognized FLAG was silently ignored and the command exited 0, so a mistyped gate read as a
 * passing gate.
 */
describe('run() --version and the unknown-flag gate', () => {
  const version = (
    JSON.parse(readFileSync(resolve(import.meta.dir, '../../package.json'), 'utf8')) as {
      version: string
    }
  ).version

  it('`--version` prints the bare resolved version and exits 0', () => {
    const { code, log } = capture(() => run(['--version'], dir))
    expect(code).toBe(0)
    expect(log.trim()).toBe(version)
  })

  it('`-v` and `version` are the same thing', () => {
    expect(capture(() => run(['-v'], dir)).log.trim()).toBe(version)
    expect(capture(() => run(['version'], dir)).log.trim()).toBe(version)
  })

  it('the printed line is greppable on its own — no usage block around it', () => {
    const { log } = capture(() => run(['--version'], dir))
    expect(log).not.toContain('Usage: basalt')
  })

  it('an unrecognized flag exits 1 and NAMES it, on a command that would otherwise pass', () => {
    const { code, log } = capture(() => run(['doctor', '--json'], dir))
    expect(code).toBe(1)
    expect(log).toContain("unrecognized flag '--json'")
    expect(log).toContain('--tokens-only')
  })

  it('a near-miss flag does not slip through as a silent no-op', () => {
    const { code, log } = capture(() => run(['check-theme', '--audit-allow'], dir))
    expect(code).toBe(1)
    expect(log).toContain("unrecognized flag '--audit-allow'")
  })

  it('a value-taking flag does not make its VALUE look like an unknown flag', () => {
    const out = resolve(dir, 'tokens.css')
    const { code } = capture(() => run(['tokens:css', '--out', out, '--only', 'core'], dir))
    expect(code).toBe(0)
  })

  it('an unknown COMMAND names what it did not understand, above the usage block', () => {
    const { code, log } = capture(() => run(['check-theme --audit-allows'], dir))
    expect(code).toBe(1)
    expect(log).toContain("unknown command 'check-theme --audit-allows'")
    expect(log).toContain('Usage: basalt')
  })

  it('`--help` still wins over the flag gate, so a reader can always find out what is accepted', () => {
    const { code, log } = capture(() => run(['doctor', '--json', '--help'], dir))
    expect(code).toBe(0)
    expect(log).toContain('Usage: basalt')
  })
})

describe('shot detect help', () => {
  it('documents the sub-mode, the exit codes, the severity table and the score', () => {
    const { code, log } = capture(() => run(['--help'], dir))
    expect(code).toBe(0)
    expect(log).toContain('shot detect [--out <dir>] [--lint <oxlint-json-file>]')
    expect(log).toContain('0 clean (P2/P3 findings are listed, not failing), 2 a P0 or P1 finding')
    for (const sev of ['P0', 'P1', 'P2', 'P3']) expect(log).toContain(`${sev} `)
    expect(log).toContain('score = 100')
  })

  it('states the --out constraint and that routes are separate arguments', () => {
    const { log } = capture(() => run(['--help'], dir))
    expect(log).toContain('--out must resolve inside the project')
    expect(log).toContain('zsh does not word-split')
  })

  it('parses doctor --from', () => {
    expect(unknownFlag('doctor', ['--from', '2.20.0'])).toBeNull()
    expect(unknownFlag('doctor', ['--nope'])).toBe('--nope')
  })

  it('accepts --lint on shot and still rejects an unknown flag', () => {
    expect(unknownFlag('shot', ['detect', '--lint', 'oxlint.json'])).toBeNull()
    expect(unknownFlag('shot', ['detect', '--nope'])).toBe('--nope')
  })
})
