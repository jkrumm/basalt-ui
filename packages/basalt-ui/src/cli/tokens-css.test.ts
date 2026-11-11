/**
 * `basalt-ui tokens:css` — the install-free path to the v3 token system.
 *
 * The command holds no emission logic of its own: the sheet it prints is what `emitTokensCss`
 * returns and the JSON is what `emitJsonText` returns for the same options, so a consumer who ran
 * the CLI and one who imported the emitters see one design system. What the CLI adds is flag
 * handling, the `--extra` app sheet and its `.d.ts`, and `--check`. See `./toolchain-wiring.test.ts`
 * for the framing's guard tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { DEFAULT_GUARD_CONFIG, GENERATED_HEADER_LINE, checkSource } from '../guard'
import { emitTokensCss, tokenNames } from '../tokens/emit'
import { emitJsonText } from '../tokens/emit-json'
import { normalizeColorFunctions, run, tokensCss } from './index'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-tokens-css-'))
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Run `fn` with console output captured; returns what it returned and everything it logged. */
function capture<T>(fn: () => T): { value: T; log: string } {
  const { log: originalLog, error: originalError } = console
  let log = ''
  const sink = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { value: fn(), log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

const read = (name: string): string => readFileSync(resolve(dir, name), 'utf8')

/** Run the command with `--out`, returning the written file. */
function emit(flags: string[], out = 'out.css'): string {
  expect(tokensCss([...flags, '--out', out], dir)).toBe(0)
  return read(out)
}

/** The emitted file minus the two-line generated header. */
const body = (flags: string[], out = 'out.css'): string =>
  emit(flags, out).split('\n').slice(2).join('\n')

/** What the emitter returns for the same options, minus its own header. */
const expected = (options: Parameters<typeof emitTokensCss>[0]): string =>
  normalizeColorFunctions(emitTokensCss(options)).split('\n').slice(2).join('\n')

const VERSION = readVersion()
function readVersion(): string {
  return JSON.parse(readFileSync(resolve(import.meta.dir, '../../package.json'), 'utf8')).version
}

describe('tokens:css', () => {
  it('with no flags emits exactly what emitTokensCss() returns, under the header', () => {
    expect(body([])).toBe(expected({ version: VERSION }))
  })

  it('--accent, --neutral and --vibrancy retune the emit', () => {
    const flags = ['--accent', '#0f8a7e', '--neutral', 'stone', '--vibrancy', '2']
    expect(body(flags)).toBe(
      expected({ version: VERSION, config: { accent: '#0f8a7e', neutral: 'stone', vibrancy: 2 } }),
    )
  })

  it('--vibrancy takes a negative level in the = form', () => {
    expect(body(['--vibrancy=-2'])).toBe(expected({ version: VERSION, config: { vibrancy: -2 } }))
  })

  it('--selector emits a tenant sheet of the roles that differ', () => {
    const selector = ":root[data-tenant='teal']"
    const css = body(['--accent', '#0f8a7e', '--selector', selector])
    expect(css).toBe(expected({ version: VERSION, config: { accent: '#0f8a7e' }, selector }))
    expect(css).toContain(`${selector}[data-theme='dark']`)
    expect(css).not.toContain('--vx-canvas')
  })

  it('a --selector that is not :root[…] exits 1 and writes nothing', () => {
    const { value, log } = capture(() =>
      tokensCss(['--selector', '.tenant', '--out', 'out.css'], dir),
    )
    expect(value).toBe(1)
    expect(log).toContain(':root[')
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('creates the parent directory of --out', () => {
    expect(emit([], 'nested/deep/tokens.css')).toContain(':root')
  })

  it.each([
    [['--accent', 'blue'], '--accent'],
    [['--neutral', 'warm'], '--neutral'],
    [['--vibrancy', '9'], '--vibrancy'],
    [['--vibrancy', '1.5'], '--vibrancy'],
    [['--format', 'yaml'], '--format'],
    [['--accent'], '--accent needs a value'],
  ])('rejects %j, naming %s', (flags, named) => {
    const { value, log } = capture(() => tokensCss([...flags, '--out', 'out.css'], dir))
    expect(value).toBe(1)
    expect(log).toContain(named)
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('a config that fails a gate exits 1 with the gate, and writes nothing', () => {
    const { value, log } = capture(() =>
      tokensCss(['--accent', '#ffff00', '--vibrancy=-4', '--out', 'out.css'], dir),
    )
    expect(value).toBe(1)
    expect(log).toContain('chart-3-cvd-chart-5')
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('rejects the removed --no-legacy-aliases flag, naming it', () => {
    const { value, log } = capture(() =>
      run(['tokens:css', '--no-legacy-aliases', '--out', 'out.css'], dir),
    )
    expect(value).toBe(1)
    expect(log).toContain('--no-legacy-aliases')
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it('`--help` short-circuits before the command runs — no file written', () => {
    const { value, log } = capture(() => run(['tokens:css', '--out', 'out.css', '--help'], dir))
    expect(value).toBe(0)
    expect(log).toContain('Usage: basalt')
    expect(readdirSync(dir)).toEqual(['package.json'])
  })
})

describe('tokens:css — the 2.x flags are gone', () => {
  const removed: [string, string[]][] = [
    ['--only', ['--only', 'core']],
    ['--selector-attribute', ['--selector-attribute', 'data-theme']],
    ['--selector-class', ['--selector-class', 'dark']],
    ['--light-class', ['--light-class', 'light']],
    ['--dark-value', ['--dark-value', 'night']],
    ['--light-value', ['--light-value', 'day']],
    ['--default-scheme', ['--default-scheme', 'light']],
    ['--media-fallback', ['--media-fallback']],
  ]

  it.each(removed)('%s exits 1 naming --selector, through the CLI', (flag, args) => {
    const { value, log } = capture(() => run(['tokens:css', ...args, '--out', 'out.css'], dir))
    expect(value).toBe(1)
    expect(log).toContain(flag)
    expect(log).toContain('--selector')
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })

  it.each(removed)('%s exits 1 naming --selector, called directly', (flag, args) => {
    const { value, log } = capture(() => tokensCss([...args, '--out', 'out.css'], dir))
    expect(value).toBe(1)
    expect(log).toContain(flag)
    expect(log).toContain('--selector')
  })

  it.each(['--radius', '--density', '--brightness'])('%s was never a flag: exit 1', (flag) => {
    const { value, log } = capture(() => run(['tokens:css', flag, '2', '--out', 'out.css'], dir))
    expect(value).toBe(1)
    expect(log).toContain(flag)
    expect(existsSync(resolve(dir, 'out.css'))).toBe(false)
  })
})

describe('tokens:css --format json', () => {
  it('writes what emitJsonText returns, under its own provenance', () => {
    const text = emit(['--format', 'json'], 'tokens.json')
    const parsed = JSON.parse(text)
    expect(parsed.$provenance).toBe(
      `basalt-ui ${VERSION} — \`basalt-ui tokens:css --format json --out tokens.json\``,
    )
    expect(text).toBe(
      emitJsonText({
        version: VERSION,
        command: 'basalt-ui tokens:css --format json --out tokens.json',
      }),
    )
    expect(parsed.schemes.light['chart-1']).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('takes the retune flags', () => {
    const text = emit(['--format', 'json', '--accent', '#0f8a7e'], 'tokens.json')
    expect(JSON.parse(text).schemes.light.brand).not.toBe(
      JSON.parse(emit(['--format', 'json'], 'default.json')).schemes.light.brand,
    )
  })

  it('refuses --selector, which only a stylesheet has', () => {
    expect(
      capture(() =>
        tokensCss(['--format', 'json', '--selector', ':root[x]', '--out', 'o.json'], dir),
      ).value,
    ).toBe(1)
  })

  it('--check passes on the file just written and fails on one changed byte', () => {
    emit(['--format', 'json'], 'tokens.json')
    expect(
      capture(() => tokensCss(['--format', 'json', '--check', '--out', 'tokens.json'], dir)).value,
    ).toBe(0)
    writeFileSync(
      resolve(dir, 'tokens.json'),
      read('tokens.json').replace('"canvas": "#f', '"canvas": "#e'),
    )
    const { value, log } = capture(() =>
      tokensCss(['--format', 'json', '--check', '--out', 'tokens.json'], dir),
    )
    expect(value).toBe(1)
    expect(log).toContain('differs from what')
  })
})

describe('tokens:css --extra', () => {
  const FILE = 'basalt.tokens.ts'
  const SERIES = {
    hrv: { hue: 'blue' },
    hrvWeekly: { hue: 'blue', light: 3, dark: 4 },
    raw: { light: '#112233', dark: '#ddeeff' },
  }
  const VARS = {
    optimalZone: 'color-mix(in srgb, var(--vx-good) 10%, transparent)',
    hillshadeShadow: 'rgb(0 0 0)',
  }

  const write = (data: unknown, name = FILE): void => {
    writeFileSync(resolve(dir, name), `export default ${JSON.stringify(data)}\n`)
  }
  const extra = (out = 'app-tokens.css') => ['--extra', FILE, '--out', out]

  it('emits per-scheme pairs, vars once on :root, and a sibling .d.ts', () => {
    write({ series: { usage: SERIES }, vars: VARS })
    expect(tokensCss(extra(), dir)).toBe(0)
    const css = read('app-tokens.css')
    // Pairs once per scheme: light on :root, dark behind the attribute and again in the OS fallback.
    expect(css).toContain('--vx-usage-hrv: #38bdf8;')
    expect(css).toContain('--vx-usage-hrv: #0284c7;')
    expect(css).toContain('--vx-usage-hrvWeekly: #38bdf8;')
    expect(css).toContain('--vx-usage-raw: #112233;')
    expect(css).toContain('--vx-usage-raw: #ddeeff;')
    expect(css.match(/--vx-optimalZone:/g)).toHaveLength(1)
    expect(css).toContain(
      ':root {\n  --vx-optimalZone: color-mix(in srgb, var(--vx-good) 10%, transparent);',
    )
    const dts = read('app-tokens.css.d.ts')
    expect(dts).toContain("declare module 'basalt-ui'")
    expect(dts).toContain('interface BasaltRegister')
    expect(dts).toContain("readonly 'usage-hrvWeekly'")
    expect(dts).toContain('export {}')
  })

  it('writes the same two-line provenance header on both files', () => {
    write({ series: { usage: SERIES } })
    tokensCss(extra(), dir)
    for (const name of ['app-tokens.css', 'app-tokens.css.d.ts']) {
      const [line1, line2] = read(name).split('\n')
      expect(line1).toBe(GENERATED_HEADER_LINE)
      expect(line2).toBe(
        `/* basalt-ui ${VERSION} — \`basalt-ui tokens:css --extra ${FILE} --out app-tokens.css\` */`,
      )
    }
    expect(checkSource(read('app-tokens.css'), 'src/app-tokens.css', DEFAULT_GUARD_CONFIG)).toEqual(
      [],
    )
  })

  it('uses the scheme selectors of the stock sheet', () => {
    write({ series: { usage: SERIES } })
    tokensCss(extra(), dir)
    const stock = emitTokensCss({ version: VERSION })
    for (const selector of [
      ":root,\n:root[data-theme='light'] {",
      ":root[data-theme='dark'] {",
      ':root:not([data-theme]) {',
    ]) {
      expect(read('app-tokens.css')).toContain(selector)
      expect(stock).toContain(selector)
    }
  })

  describe('--check', () => {
    const check = () => capture(() => tokensCss([...extra(), '--check'], dir))

    it('passes on the files just written', () => {
      write({ series: { usage: SERIES }, vars: VARS })
      tokensCss(extra(), dir)
      expect(check().value).toBe(0)
    })

    it('exits 1 on one changed byte in the sheet', () => {
      write({ series: { usage: SERIES }, vars: VARS })
      tokensCss(extra(), dir)
      writeFileSync(
        resolve(dir, 'app-tokens.css'),
        read('app-tokens.css').replace('#112233', '#112234'),
      )
      const { value, log } = check()
      expect(value).toBe(1)
      expect(log).toContain('app-tokens.css differs')
    })

    it('exits 1 on one changed byte in the .d.ts', () => {
      write({ series: { usage: SERIES }, vars: VARS })
      tokensCss(extra(), dir)
      writeFileSync(
        resolve(dir, 'app-tokens.css.d.ts'),
        read('app-tokens.css.d.ts').replace('usage-raw', 'usage-rax'),
      )
      const { value, log } = check()
      expect(value).toBe(1)
      expect(log).toContain('app-tokens.css.d.ts differs')
    })

    it('exits 1 when the source moved and the files did not', () => {
      write({ series: { usage: SERIES } })
      tokensCss(extra(), dir)
      write({ series: { usage: { ...SERIES, hrv: { hue: 'red' } } } })
      expect(check().value).toBe(1)
    })

    it('exits 1 when the .d.ts is missing', () => {
      write({ series: { usage: SERIES } })
      tokensCss(extra(), dir)
      rmSync(resolve(dir, 'app-tokens.css.d.ts'))
      expect(check().value).toBe(1)
    })
  })

  describe('refusals', () => {
    const refuse = (data: unknown) => {
      write(data)
      const result = capture(() => tokensCss(extra(), dir))
      expect(existsSync(resolve(dir, 'app-tokens.css'))).toBe(false)
      expect(existsSync(resolve(dir, 'app-tokens.css.d.ts'))).toBe(false)
      return result
    }

    it('a group colliding with a package name exits 1', () => {
      const { value, log } = refuse({ series: { chart: { 1: { hue: 'blue' } } } })
      expect(value).toBe(1)
      expect(log).toContain('--vx-chart-1')
      expect(log).toContain('basalt-ui name')
    })

    it('a var colliding with a package name exits 1', () => {
      const { value, log } = refuse({ vars: { canvas: '#000' } })
      expect(value).toBe(1)
      expect(log).toContain('--vx-canvas')
    })

    it('a vars value reading --vx-good-solid exits 1 and names --vx-good', () => {
      const { value, log } = refuse({
        vars: { zone: 'color-mix(in srgb, var(--vx-good-solid) 10%, transparent)' },
      })
      expect(value).toBe(1)
      expect(log).toContain('--vx-good-solid')
      expect(log).toContain('did you mean --vx-good?')
    })

    it('a vars value may read a name declared in the same file', () => {
      write({ series: { usage: SERIES }, vars: { zone: 'var(--vx-usage-hrv)' } })
      expect(tokensCss(extra(), dir)).toBe(0)
    })

    it('a vars value reading a typo of a package name suggests the nearest one', () => {
      const { log } = refuse({ vars: { zone: 'var(--vx-brandfill)' } })
      expect(log).toContain('did you mean --vx-brand-fill?')
    })

    it.each([
      [{ series: { usage: { x: { hue: 'magenta' } } } }, 'hue must be one of'],
      [{ series: { usage: { x: { hue: 'blue', light: 7 } } } }, 'ramp step 0..4'],
      [{ series: { usage: { x: { light: 'red', dark: 'blue' } } } }, 'light and dark as #hex'],
      [{ series: { usage: { x: { hue: 'blue', tone: 1 } } } }, 'unknown keys'],
      [{ extras: {} }, 'unknown keys'],
      [{ vars: { 'bad name': 'x' } }, 'must match'],
    ])('%j exits 1 with %s', (data, message) => {
      const { value, log } = refuse(data)
      expect(value).toBe(1)
      expect(log).toContain(message)
    })
  })

  it('needs --out, since the sheet and the .d.ts are two files', () => {
    write({ series: {} })
    const { value, log } = capture(() => tokensCss(['--extra', FILE], dir))
    expect(value).toBe(1)
    expect(log).toContain('--out')
  })

  it('does not mix with the retune flags of the basalt-ui sheet', () => {
    write({ series: {} })
    const { value, log } = capture(() => tokensCss([...extra(), '--accent', '#0f8a7e'], dir))
    expect(value).toBe(1)
    expect(log).toContain('--accent')
  })

  it('a missing file exits 1 naming it', () => {
    const { value, log } = capture(() => tokensCss(extra(), dir))
    expect(value).toBe(1)
    expect(log).toContain(FILE)
  })

  it('never reuses a basalt-ui name: every emitted name is outside the package list', () => {
    write({ series: { usage: SERIES }, vars: VARS })
    tokensCss(extra(), dir)
    const emitted = [...read('app-tokens.css').matchAll(/(--vx-[\w-]+):/g)].map((m) => m[1]!)
    const names = new Set(tokenNames())
    expect(emitted.length).toBeGreaterThan(0)
    for (const name of emitted) expect(names.has(name)).toBe(false)
  })
})

/**
 * `--check` gates the emitted content byte for byte, INCLUDING the `@generated` header's version
 * line. A basalt-ui release therefore moves the file and forces a no-op commit on every upgrade
 * that ships a committed generated sheet — a deliberate simplification.
 */
describe('tokens:css --check', () => {
  const check = (out: string) => {
    const { value, log } = capture(() => tokensCss(['--check', '--out', out], dir))
    return { code: value, log }
  }

  it('passes when the file is byte-identical to what would be emitted', () => {
    emit([])
    const { code, log } = check('out.css')
    expect(code).toBe(0)
    expect(log).toContain('is up to date')
  })

  it('FAILS when the emitting VERSION on line 2 differs — the comparison is byte-exact', () => {
    const lines = emit([]).split('\n')
    lines[1] = (lines[1] as string).replace(/basalt-ui [\d.]+/, 'basalt-ui 0.0.1')
    writeFileSync(resolve(dir, 'out.css'), lines.join('\n'))
    const { code, log } = check('out.css')
    expect(code).toBe(1)
    expect(log).toContain('differs from what')
  })

  it('FAILS when line 2 names different flags — the invocation line 1 points at is gated', () => {
    const lines = emit([]).split('\n')
    lines[1] = (lines[1] as string).replace(
      '`basalt-ui tokens:css --out out.css`',
      '`basalt-ui tokens:css --vibrancy 1 --out out.css`',
    )
    writeFileSync(resolve(dir, 'out.css'), lines.join('\n'))
    expect(check('out.css').code).toBe(1)
  })

  it('FAILS when the provenance line is deleted outright — a blank line is not a free pass', () => {
    const lines = emit([]).split('\n')
    lines[1] = ''
    writeFileSync(resolve(dir, 'out.css'), lines.join('\n'))
    expect(check('out.css').code).toBe(1)
  })

  it('STILL fails when a token value actually moved', () => {
    writeFileSync(resolve(dir, 'out.css'), emit([]).replace('--vx-canvas', '--vx-canvass'))
    const { code, log } = check('out.css')
    expect(code).toBe(1)
    expect(log).toContain('differs from what')
  })

  it('needs --out: there is nothing to compare stdout to', () => {
    expect(capture(() => tokensCss(['--check'], dir)).value).toBe(1)
  })

  it('the header itself is unchanged — the `@generated` exemption needs both lines verbatim', () => {
    const lines = emit([]).split('\n')
    expect(lines[0]).toBe(GENERATED_HEADER_LINE)
    expect(lines[1]).toMatch(/^\/\* basalt-ui [\d.]+ — `basalt-ui tokens:css --out out\.css` \*\/$/)
  })

  it('the emitted header is still guard-exempt — checkSource reports nothing in it', () => {
    expect(checkSource(emit([]), 'src/tokens.css', DEFAULT_GUARD_CONFIG)).toEqual([])
  })
})
