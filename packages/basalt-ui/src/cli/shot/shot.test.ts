import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildBoard } from './board'
import {
  capture,
  fileName,
  groupScale,
  hasFocusTarget,
  readScaleInPage,
  sheetName,
  unionClip,
  withParam,
} from './capture'
import { unknownFlag } from '../help'
import {
  commitOut,
  parseShotArgs,
  planOut,
  recoverOut,
  sanitizeBase,
  shot,
  sweepStaleTmp,
} from './index'
import { contrastRatio, contrastThreshold, finishMeasurement } from './measure'
import type { TextReading } from './measure'
import { INSTALL_LINE, ShotError, isPlaywright, withBrowser } from './playwright'
import type { Playwright } from './playwright'
import { serveDist } from './serve'
import type { Measurement, ShotMetrics, ShotRecord } from './types'

const dirs: string[] = []
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'shot-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

/** Captures `console.error` for the duration of `fn`. */
async function errors<T>(fn: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const lines: string[] = []
  const orig = console.error
  console.error = (l: string) => void lines.push(l)
  try {
    return { result: await fn(), lines }
  } finally {
    console.error = orig
  }
}

const measurement: Measurement = {
  box: { width: 300, height: 120 },
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
  gap: { row: 8, column: 0 },
  radius: 8,
  borderWidth: 1,
  fontSizes: [12, 24],
  nested: [{ path: 'div.inner', radius: 6, padding: { top: 4, right: 4, bottom: 4, left: 4 } }],
  emptyRatio: 0.25,
  contrast: {
    min: 2.1,
    failures: [{ text: 'Muted <b>', ratio: 2.1, fg: '#aaaaaa', bg: '#ffffff', fontSize: 12 }],
    backdrop: 'assumed-white',
  },
}

const record = (over: Partial<ShotRecord>): ShotRecord => ({
  route: '/dashboard',
  name: 'stat-card',
  scheme: 'light',
  viewport: 'desktop',
  state: 'rest',
  file: null,
  status: 'ok',
  ...over,
})

const fakeMetrics = (): ShotMetrics => ({
  version: 1,
  generatedAt: '2026-10-16T00:00:00.000Z',
  base: 'http://127.0.0.1:1',
  routes: ['/dashboard'],
  viewports: ['desktop', 'mobile'],
  schemes: ['light', 'dark'],
  states: ['rest', 'tooltip'],
  scale: [
    {
      scheme: 'light',
      viewport: 'desktop',
      spacing: { xs: 10, sm: 12 },
      radius: { md: 8, card: 7 },
      fontSizes: { sm: 14 },
    },
    {
      scheme: 'dark',
      viewport: 'desktop',
      spacing: { xs: 10, sm: 12 },
      radius: { md: 8, card: 7 },
      fontSizes: { sm: 14 },
    },
  ],
  anchors: [
    {
      route: '/dashboard',
      name: 'stat-card',
      scheme: 'light',
      viewport: 'desktop',
      ...measurement,
    },
  ],
  shots: [
    record({ name: '_page', file: 'png/p.png' }),
    record({ file: 'png/a.png', note: 'anchor only present in this state' }),
    record({
      state: 'tooltip',
      status: 'not-declared',
      note: 'no [data-shot-tooltip] in the anchor',
    }),
    record({ scheme: 'dark', status: 'error', note: 'anchor not found' }),
    record({
      scheme: 'dark',
      state: 'tooltip',
      viewport: 'mobile',
      status: 'skipped',
      note: 'desktop only',
    }),
  ],
})

/** A fake Playwright whose launches succeed or fail per channel. */
const fakePw = (failing: readonly (string | undefined)[], log: string[] = []): Playwright => ({
  chromium: {
    launchServer: ({ channel }) => {
      if (failing.includes(channel))
        return Promise.reject(new Error(`${channel ?? 'bundled'} missing\nstack`))
      log.push(`launch ${channel ?? 'bundled'}`)
      return Promise.resolve({
        wsEndpoint: () => 'ws://fake',
        kill: () => (log.push('kill'), Promise.resolve()),
      })
    },
    connect: () => Promise.resolve({ newContext: () => Promise.reject(new Error('unused')) }),
  },
})

describe('parseShotArgs', () => {
  test('routes, --dist, defaults', () => {
    const a = parseShotArgs(['/', '/dashboard', '--dist', 'dist'])
    expect(a.routes).toEqual(['/', '/dashboard'])
    expect(a.out).toBe('.basalt/shots/latest')
    expect(a.states).toEqual(['rest', 'hover', 'focus', 'tooltip', 'empty', 'loading', 'error'])
  })
  test('--states keeps canonical order', () => {
    expect(parseShotArgs(['/', '--base', 'http://x/', '--states', 'focus,rest']).states).toEqual([
      'rest',
      'focus',
    ])
    expect(parseShotArgs(['/', '--base', 'http://x/']).base).toBe('http://x')
  })
  test.each([
    [[], /no route/],
    [['/a'], /exactly one of --base/],
    [['/a', '--base', 'http://x', '--dist', 'd'], /exactly one of --base/],
    [['a', '--dist', 'd'], /must start with '\//],
    [['/a', '--dist', 'd', '--states', 'rest,nope'], /unknown state 'nope'/],
    [['/a', '--dist', 'd', '--bogus'], /bogus/],
  ])('rejects %j', (flags, message) => {
    expect(() => parseShotArgs(flags)).toThrow(ShotError)
    expect(() => parseShotArgs(flags)).toThrow(message)
  })
  test('the help.ts gate lets shot take routes but still names an unknown flag', () => {
    expect(unknownFlag('shot', ['/', '/dashboard', '--dist', 'd', '--states', 'rest'])).toBeNull()
    expect(unknownFlag('shot', ['/', '--bogus'])).toBe('--bogus')
  })
})

describe('planOut', () => {
  const seed = (cwd: string, rel: string, file = 'x.txt'): void => {
    mkdirSync(join(cwd, rel), { recursive: true })
    writeFileSync(join(cwd, rel, file), 'data')
  }
  test('refuses a populated dir that is not a previous shot (--out src)', () => {
    const cwd = tmp()
    seed(cwd, 'src')
    expect(() => planOut(cwd, 'src')).toThrow(/not purely a previous shot output/)
    expect(existsSync(join(cwd, 'src/x.txt'))).toBe(true)
  })
  test('refuses the project root, escapes, files and protected dirs', () => {
    const cwd = tmp()
    writeFileSync(join(cwd, 'file'), '')
    for (const out of [
      '.',
      '..',
      '../elsewhere',
      '/',
      'file',
      '.git',
      'a/.git/b',
      'node_modules/x',
      '.basalt',
    ]) {
      expect(() => planOut(cwd, out), out).toThrow(ShotError)
    }
  })
  test('refuses a symlinked target and a symlinked ancestor', () => {
    const cwd = tmp()
    const elsewhere = tmp()
    symlinkSync(elsewhere, join(cwd, 'link'))
    expect(() => planOut(cwd, 'link')).toThrow(/symlink/)
    expect(() => planOut(cwd, 'link/new')).toThrow(/outside the project/)
  })
  test('accepts absent, empty, own-files-only, previous-run and `..shots` dirs', () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'empty'))
    seed(cwd, 'prev', 'metrics.json')
    writeFileSync(join(cwd, 'prev/metrics.json'), '{"version":1}')
    for (const out of [
      'absent',
      'a/b/absent',
      'empty',
      'prev',
      '..shots',
      '.basalt/shots/latest',
    ]) {
      expect(planOut(cwd, out), out).toBe(join(cwd, out))
    }
  })
  test('a previous-shot dir with a foreign file is refused; shot-owned entries are fine', () => {
    const cwd = tmp()
    seed(cwd, 'prev', 'metrics.json')
    writeFileSync(join(cwd, 'prev/metrics.json'), '{"version":1}')
    mkdirSync(join(cwd, 'prev/png'))
    writeFileSync(join(cwd, 'prev/board.html'), '')
    writeFileSync(join(cwd, 'prev/.gitignore'), '*\n')
    expect(planOut(cwd, 'prev')).toBe(join(cwd, 'prev'))
    writeFileSync(join(cwd, 'prev/notes.md'), 'mine')
    expect(() => planOut(cwd, 'prev')).toThrow(/not purely a previous shot output/)
  })
  test('the shot home itself is refused', () => {
    expect(() => planOut(tmp(), '.basalt/shots')).toThrow(/shot home/)
  })
  test('a dangling symlink target or ancestor is a ShotError, not a stack trace', () => {
    const cwd = tmp()
    symlinkSync(join(cwd, 'nowhere'), join(cwd, 'dangling'))
    expect(() => planOut(cwd, 'dangling')).toThrow(ShotError)
    expect(() => planOut(cwd, 'dangling/inner')).toThrow(/dangling symlink/)
  })
  test('a metrics.json that is not version 1 is not a marker', () => {
    const cwd = tmp()
    seed(cwd, 'prev', 'metrics.json')
    writeFileSync(join(cwd, 'prev/metrics.json'), '{"version":2}')
    expect(() => planOut(cwd, 'prev')).toThrow(ShotError)
  })
})

describe('commitOut', () => {
  test('swaps the render in and writes last.json last', () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'design/x'), { recursive: true })
    writeFileSync(join(cwd, 'design/x/metrics.json'), '{"version":1}')
    writeFileSync(join(cwd, 'design/x/board.html'), 'old')
    mkdirSync(join(cwd, 'design/x.tmp'))
    writeFileSync(join(cwd, 'design/x.tmp/board.html'), 'new')
    commitOut(cwd, 'design/x', join(cwd, 'design/x.tmp'), ['/'], new Date(0))
    expect(existsSync(join(cwd, 'design/x.prev'))).toBe(false)
    expect(readFileSync(join(cwd, 'design/x/board.html'), 'utf8')).toBe('new')
    expect(readFileSync(join(cwd, '.basalt/shots/.gitignore'), 'utf8')).toBe('*\n')
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/shots/last.json'), 'utf8')).out).toBe(
      'design/x',
    )
  })
  test('creates the out dir parent when it does not exist yet', () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'x.tmp'))
    writeFileSync(join(cwd, 'x.tmp/board.html'), 'new')
    commitOut(cwd, 'missing/parent/x', join(cwd, 'x.tmp'), ['/'], new Date(0))
    expect(readFileSync(join(cwd, 'missing/parent/x/board.html'), 'utf8')).toBe('new')
  })
})

describe('recoverOut', () => {
  test('rolls a leftover .prev back when there is no out; leaves it when out exists', () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'x.prev'))
    writeFileSync(join(cwd, 'x.prev/board.html'), 'old')
    recoverOut(join(cwd, 'x'))
    expect(readFileSync(join(cwd, 'x/board.html'), 'utf8')).toBe('old')
    expect(existsSync(join(cwd, 'x.prev'))).toBe(false)
  })
  test('shot() rolls back before doing anything else, even when the launch then fails', async () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'x.prev'))
    writeFileSync(join(cwd, 'x.prev/metrics.json'), '{"version":1}')
    const { result } = await errors(() =>
      shot(['/', '--base', 'http://x', '--out', 'x'], cwd, {
        resolve: () => fakePw([undefined, 'chrome']),
      }),
    )
    expect(result).toBe(1)
    expect(existsSync(join(cwd, 'x/metrics.json'))).toBe(true)
  })
})

describe('sanitizeBase', () => {
  test('keeps origin and path; drops credentials, query and fragment', () => {
    expect(sanitizeBase('https://user:pw@example.com:8443/app/?token=abc#frag')).toBe(
      'https://example.com:8443/app',
    )
    expect(sanitizeBase('http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173')
    expect(() => sanitizeBase('not a url')).toThrow(ShotError)
  })
})

describe('fileName', () => {
  test('routes and names that slug alike still get distinct files', () => {
    expect(fileName('/a/b', 'n', 'light', 'desktop', 'rest')).not.toBe(
      fileName('/a-b', 'n', 'light', 'desktop', 'rest'),
    )
    expect(fileName('/', 'x y', 'light', 'desktop', 'rest')).not.toBe(
      fileName('/', 'x-y', 'light', 'desktop', 'rest'),
    )
    expect(fileName('/a', 'n', 'dark', 'mobile', 'hover')).toMatch(
      /^a-[0-9a-f]{6}__n-[0-9a-f]{6}__dark__mobile__hover\.png$/,
    )
  })
})

describe('capture() with a fake browser', () => {
  const fakeBrowser = (scale: () => unknown) => {
    const locator: Record<string, unknown> = {
      first: () => locator,
      count: () => Promise.resolve(1),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      isVisible: () => Promise.resolve(true),
      screenshot: () => Promise.resolve(),
    }
    const page = {
      setDefaultTimeout: () => undefined,
      goto: () => Promise.resolve(),
      locator: () => locator,
      screenshot: () => Promise.resolve(),
      mouse: { move: () => Promise.resolve() },
      keyboard: { press: () => Promise.resolve() },
      setContent: () => Promise.resolve(),
      evaluate: (expression: unknown) => {
        if (typeof expression === 'function') return Promise.resolve().then(scale)
        if (String(expression).includes('data-shot-states'))
          return Promise.resolve({ anchors: ['card'], declared: [] })
        return Promise.resolve(undefined)
      },
    }
    return {
      newContext: () =>
        Promise.resolve({
          newPage: () => Promise.resolve(page),
          addInitScript: () => Promise.resolve(),
          close: () => Promise.resolve(),
        }),
    } as never
  }
  const input = (browser: never, over: object = {}) => ({
    browser,
    base: 'http://x',
    routes: ['/'],
    states: ['rest' as const],
    pngDir: '/unused',
    log: () => undefined,
    ...over,
  })

  test('a throwing measurer keeps the PNG ok and notes the failure separately', async () => {
    const out = await capture(
      input(
        fakeBrowser(() => ({ spacing: {}, radius: {}, fontSizes: {} })),
        {
          measure: () => Promise.reject(new Error('canvas gone\nstack')),
        },
      ),
    )
    const card = out.shots.filter((s) => s.name === 'card')
    expect(card).toHaveLength(4)
    expect(
      card.every((s) => s.status === 'ok' && s.note === 'metrics unavailable: canvas gone'),
    ).toBe(true)
    expect(out.anchors).toEqual([])
  })

  test('a readScale failure is non-fatal and visible: shots record, scale is empty, scaleError says why', async () => {
    const out = await capture(
      input(
        fakeBrowser(() => {
          throw new Error('no probe')
        }),
        { measure: () => Promise.resolve(measurement) },
      ),
    )
    expect(out.scale).toEqual([])
    expect(out.scaleError).toBe('no probe')
    expect(out.shots.filter((s) => s.status === 'ok')).toHaveLength(8)
    expect(out.anchors).toHaveLength(4)
  })
})

describe('focus state', () => {
  const pageWith = (focusable: boolean, countFails = false) => {
    const locator: Record<string, unknown> = {
      first: () => locator,
      count: () => (countFails ? Promise.reject(new Error('locator died')) : Promise.resolve(1)),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      isVisible: () => Promise.resolve(true),
      screenshot: () => Promise.resolve(),
      boundingBox: () => Promise.resolve({ x: 0, y: 0, width: 10, height: 10 }),
      evaluate: () =>
        countFails ? Promise.reject(new Error('locator died')) : Promise.resolve(focusable),
    }
    const page = {
      setDefaultTimeout: () => undefined,
      goto: () => Promise.resolve(),
      locator: () => locator,
      screenshot: () => Promise.resolve(),
      setContent: () => Promise.resolve(),
      mouse: { move: () => Promise.resolve() },
      keyboard: { press: () => Promise.resolve() },
      evaluate: (expression: unknown) => {
        if (typeof expression === 'function')
          return Promise.resolve({ mantine: { spacing: {}, radius: {}, fontSizes: {} }, vx: {} })
        if (String(expression).includes('data-shot-states'))
          return Promise.resolve({ anchors: ['card'], declared: [] })
        // The Tab loop lands immediately.
        if (String(expression).includes('activeElement')) return Promise.resolve(true)
        return Promise.resolve(undefined)
      },
    }
    return {
      newContext: () =>
        Promise.resolve({
          newPage: () => Promise.resolve(page),
          addInitScript: () => Promise.resolve(),
          close: () => Promise.resolve(),
        }),
    } as never
  }
  const run = (focusable: boolean, countFails = false) =>
    capture({
      browser: pageWith(focusable, countFails),
      base: 'http://x',
      routes: ['/'],
      states: ['focus' as const],
      pngDir: '/unused',
      log: () => undefined,
      measure: () => Promise.resolve(measurement),
    })
  const focus = (out: Awaited<ReturnType<typeof run>>) =>
    out.shots.filter((s) => s.name === 'card' && s.state === 'focus')

  test('an anchor with no focusable descendant records not-declared, never error', async () => {
    const shots = focus(await run(false))
    expect(shots).toHaveLength(4)
    expect(
      shots.every((s) => s.status === 'not-declared' && /no focus target/.test(s.note ?? '')),
    ).toBe(true)
  })
  test('an anchor with a focus target is still captured', async () => {
    expect(focus(await run(true)).every((s) => s.status === 'ok')).toBe(true)
  })
  test('a locator failure records error for that anchor and never aborts the run', async () => {
    const shots = focus(await run(true, true))
    expect(shots).toHaveLength(4)
    expect(shots.every((s) => s.status === 'error' && s.note === 'locator died')).toBe(true)
  })
})

describe('hasFocusTarget', () => {
  const host = (html: string): Element => {
    document.body.innerHTML = `<div id="root">${html}</div>`
    return document.getElementById('root') as Element
  }
  test('reaches links, enabled controls and tabindex >= 0', () => {
    expect(hasFocusTarget(host('<a href="/x">x</a>'))).toBe(true)
    expect(hasFocusTarget(host('<p><button>go</button></p>'))).toBe(true)
    expect(hasFocusTarget(host('<div tabindex="0">x</div>'))).toBe(true)
  })
  test('skips hidden inputs, tabindex -1, disabled controls and hidden/inert subtrees', () => {
    expect(hasFocusTarget(host('<input type="hidden">'))).toBe(false)
    expect(hasFocusTarget(host('<button tabindex="-1">x</button>'))).toBe(false)
    expect(hasFocusTarget(host('<button disabled>x</button>'))).toBe(false)
    expect(hasFocusTarget(host('<div hidden><button>x</button></div>'))).toBe(false)
    expect(hasFocusTarget(host('<div inert><a href="/x">x</a></div>'))).toBe(false)
    expect(hasFocusTarget(host('<p>plain text</p>'))).toBe(false)
  })
})

describe('scale', () => {
  test('groupScale keeps basalt tokens by kind, drops zero and foreign names', () => {
    const out = groupScale({
      mantine: { spacing: { xs: 11 }, radius: { md: 6 }, fontSizes: { sm: 13.5 } },
      vx: {
        '--vx-space-3': 12,
        '--vx-space-agent-gap': 6,
        '--vx-space-zero': 0,
        '--vx-text-micro': 11,
        '--vx-radius-card': 7,
        '--vx-color-accent': 99,
      },
    })
    expect(out.spacing).toEqual({ xs: 11, 'vx-space-3': 12, 'vx-space-agent-gap': 6 })
    expect(out.fontSizes).toEqual({ sm: 13.5, 'vx-text-micro': 11 })
    expect(out.radius).toEqual({ md: 6, 'vx-radius-card': 7 })
  })
  test('readScaleInPage reads root tokens and component-scoped ones', () => {
    document.head.innerHTML =
      '<style>:root{--vx-space-3:12px;--mantine-spacing-xs:11px}.card{--vx-space-agent-gap:6px;--vx-text-micro:var(--vx-space-3)}.x{color:red}</style>'
    const read = readScaleInPage(['xs'])
    expect(read.mantine.spacing).toEqual({ xs: 11 })
    expect(read.vx).toEqual({
      '--vx-space-3': 12,
      '--vx-space-agent-gap': 6,
      '--vx-text-micro': 12,
    })
    document.head.innerHTML = ''
  })
})

describe('contact sheets', () => {
  test('one sheet per anchor is written and listed on the anchor', async () => {
    const dir = tmp()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    )
    const shots: string[] = []
    const locator: Record<string, unknown> = {
      first: () => locator,
      count: () => Promise.resolve(1),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      isVisible: () => Promise.resolve(true),
      screenshot: (o: { path: string }) => {
        writeFileSync(o.path, png)
        shots.push(o.path)
        return Promise.resolve()
      },
    }
    let html = ''
    const page = {
      setDefaultTimeout: () => undefined,
      goto: () => Promise.resolve(),
      locator: () => locator,
      screenshot: (o: { path: string }) => {
        writeFileSync(o.path, png)
        shots.push(o.path)
        return Promise.resolve()
      },
      setContent: (h: string) => {
        html = h
        return Promise.resolve()
      },
      mouse: { move: () => Promise.resolve() },
      keyboard: { press: () => Promise.resolve() },
      evaluate: (e: unknown) =>
        typeof e === 'function'
          ? Promise.resolve({ mantine: { spacing: {}, radius: {}, fontSizes: {} }, vx: {} })
          : String(e).includes('data-shot-states')
            ? Promise.resolve({ anchors: ['card'], declared: [] })
            : Promise.resolve(undefined),
    }
    const browser = {
      newContext: () =>
        Promise.resolve({
          newPage: () => Promise.resolve(page),
          addInitScript: () => Promise.resolve(),
          close: () => Promise.resolve(),
        }),
    } as never
    const out = await capture({
      browser,
      base: 'http://x',
      routes: ['/'],
      states: ['rest'],
      pngDir: dir,
      log: () => undefined,
      measure: () => Promise.resolve(measurement),
    })
    const file = `png/${sheetName('/', 'card')}`
    expect(out.anchors.every((a) => a.sheet === file)).toBe(true)
    expect(existsSync(join(dir, sheetName('/', 'card')))).toBe(true)
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('loading="lazy"')
  })
  test('a sheet that cannot be written is logged and left unlisted', async () => {
    const log: string[] = []
    const out = await capture({
      browser: {
        newContext: () =>
          Promise.resolve({
            newPage: () =>
              Promise.resolve({
                setDefaultTimeout: () => undefined,
                goto: () => Promise.resolve(),
                locator: () => ({
                  first() {
                    return this
                  },
                  count: () => Promise.resolve(1),
                  scrollIntoViewIfNeeded: () => Promise.resolve(),
                  isVisible: () => Promise.resolve(true),
                  screenshot: () => Promise.resolve(),
                }),
                screenshot: () => Promise.resolve(),
                setContent: () => Promise.reject(new Error('no content')),
                mouse: { move: () => Promise.resolve() },
                keyboard: { press: () => Promise.resolve() },
                evaluate: (e: unknown) =>
                  typeof e === 'function'
                    ? Promise.resolve({
                        mantine: { spacing: {}, radius: {}, fontSizes: {} },
                        vx: {},
                      })
                    : String(e).includes('data-shot-states')
                      ? Promise.resolve({ anchors: ['card'], declared: [] })
                      : Promise.resolve(undefined),
              }),
            addInitScript: () => Promise.resolve(),
            close: () => Promise.resolve(),
          }),
      } as never,
      base: 'http://x',
      routes: ['/'],
      states: ['rest'],
      pngDir: tmp(),
      log: (l) => log.push(l),
      measure: () => Promise.resolve(measurement),
    })
    expect(out.anchors.some((a) => a.sheet !== undefined)).toBe(false)
    expect(log.some((l) => /sheet not written/.test(l))).toBe(true)
  })
})

describe('sweepStaleTmp', () => {
  test('removes tmp-* dirs older than an hour, keeps fresh ones and everything else', () => {
    const home = tmp()
    for (const d of ['tmp-old', 'tmp-new', 'keep']) mkdirSync(join(home, d))
    const now = new Date(Date.now() + 2 * 60 * 60 * 1000)
    // "now" is two hours ahead of the real mtimes: everything looks old except what is touched later.
    utimesSync(
      join(home, 'tmp-new'),
      new Date(now.getTime() - 60_000),
      new Date(now.getTime() - 60_000),
    )
    sweepStaleTmp(home, now)
    expect(existsSync(join(home, 'tmp-old'))).toBe(false)
    expect(existsSync(join(home, 'tmp-new'))).toBe(true)
    expect(existsSync(join(home, 'keep'))).toBe(true)
  })
  test('a missing home is fine', () => {
    expect(() => sweepStaleTmp(join(tmp(), 'nope'), new Date())).not.toThrow()
  })
})

describe('hover and focus crops include an opened tooltip', () => {
  const ANCHOR = { x: 100, y: 100, width: 200, height: 60 }
  const TIP = { x: 120, y: 170, width: 180, height: 40 }
  const run = async (tooltip: boolean, state: 'hover' | 'focus') => {
    const clips: unknown[] = []
    let reads = 0
    const element: Record<string, unknown> = {
      first: () => element,
      count: () => Promise.resolve(1),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      isVisible: () => Promise.resolve(true),
      hover: () => Promise.resolve(),
      screenshot: () => {
        clips.push('element')
        return Promise.resolve()
      },
      boundingBox: () => Promise.resolve(ANCHOR),
      evaluate: () => Promise.resolve(true),
    }
    const tip: Record<string, unknown> = {
      first: () => tip,
      waitFor: () => (tooltip ? Promise.resolve() : Promise.reject(new Error('timeout'))),
      // Grows read by read (an animation) before it settles at TIP: the crop must hold the final size.
      boundingBox: () =>
        Promise.resolve({
          ...TIP,
          width: Math.min(TIP.width, 20 + 40 * reads++),
          height: TIP.height,
        }),
    }
    const page = {
      setDefaultTimeout: () => undefined,
      goto: () => Promise.resolve(),
      locator: (selector: string) => (selector.includes('tooltip') ? tip : element),
      screenshot: (o: { clip?: unknown }) => {
        clips.push(o.clip)
        return Promise.resolve()
      },
      setContent: () => Promise.resolve(),
      mouse: { move: () => Promise.resolve() },
      keyboard: { press: () => Promise.resolve() },
      evaluate: (e: unknown) =>
        typeof e === 'function'
          ? Promise.resolve({ mantine: { spacing: {}, radius: {}, fontSizes: {} }, vx: {} })
          : String(e).includes('data-shot-states')
            ? Promise.resolve({ anchors: ['card'], declared: [] })
            : String(e).includes('activeElement')
              ? Promise.resolve(true)
              : Promise.resolve(undefined),
    }
    await capture({
      browser: {
        newContext: () =>
          Promise.resolve({
            newPage: () => Promise.resolve(page),
            addInitScript: () => Promise.resolve(),
            close: () => Promise.resolve(),
          }),
      } as never,
      base: 'http://x',
      routes: ['/'],
      states: [state],
      pngDir: '/unused',
      log: () => undefined,
      measure: () => Promise.resolve(measurement),
    })
    return clips
  }
  const covers = (clip: unknown): boolean => {
    const c = clip as { x: number; y: number; width: number; height: number }
    return (
      c.x <= TIP.x &&
      c.y <= TIP.y &&
      c.x + c.width >= TIP.x + TIP.width &&
      c.y + c.height >= TIP.y + TIP.height
    )
  }

  test('a focus crop grows to hold the tooltip', async () => {
    const clips = await run(true, 'focus')
    expect(clips.length).toBeGreaterThan(0)
    expect(clips.every(covers)).toBe(true)
  })
  test('a hover crop grows to hold the tooltip instead of cropping the anchor alone', async () => {
    const clips = await run(true, 'hover')
    expect(clips.length).toBeGreaterThan(0)
    expect(clips.every(covers)).toBe(true)
  })
  test('with no tooltip a focus crop is the anchor alone and a hover crop the element', async () => {
    expect((await run(false, 'focus')).every((c) => !covers(c))).toBe(true)
    expect((await run(false, 'hover')).every((c) => c === 'element')).toBe(true)
  })
})

describe('withBrowser', () => {
  test('falls back to the next channel and kills what it launched', async () => {
    const log: string[] = []
    const used = await withBrowser(fakePw([undefined], log), (_b, channel) =>
      Promise.resolve(channel),
    )
    expect(used).toBe('chrome')
    expect(log).toEqual(['launch chrome', 'kill'])
  })
  test('a channel preference reorders the attempts', async () => {
    const log: string[] = []
    const used = await withBrowser(fakePw([], log), (_b, c) => Promise.resolve(c), {
      channels: ['chrome', undefined],
    })
    expect(used).toBe('chrome')
  })
  test('every launch failing throws the install line with each first error line', async () => {
    const error = await withBrowser(fakePw([undefined, 'chrome']), () => Promise.resolve(1)).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ShotError)
    expect((error as Error).message.split('\n')).toEqual([
      INSTALL_LINE,
      '  bundled chromium: bundled missing',
      '  chrome: chrome missing',
    ])
  })
  test('kills the browser when fn throws', async () => {
    const log: string[] = []
    await expect(
      withBrowser(fakePw([], log), () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom')
    expect(log).toEqual(['launch bundled', 'kill'])
  })
})

describe('isPlaywright', () => {
  test('requires chromium.launchServer and connect as functions', () => {
    expect(isPlaywright(fakePw([]))).toBe(true)
    expect(isPlaywright({ chromium: { launchServer: 1, connect: () => 1 } })).toBe(false)
    expect(isPlaywright({})).toBe(false)
    expect(isPlaywright(null)).toBe(false)
  })
})

describe('serveDist', () => {
  test('a --dist that is not a directory is a ShotError', () => {
    const cwd = tmp()
    writeFileSync(join(cwd, 'f'), '')
    expect(() => serveDist(join(cwd, 'missing'))).toThrow(ShotError)
    expect(() => serveDist(join(cwd, 'f'))).toThrow(/not a directory/)
  })
})

describe('shot()', () => {
  test('missing Playwright prints the install line and exits 1', async () => {
    const { result, lines } = await errors(() =>
      shot(['/', '--base', 'http://x'], tmp(), { resolve: () => null }),
    )
    expect(result).toBe(1)
    expect(lines).toEqual([INSTALL_LINE])
    expect(INSTALL_LINE).toBe(
      'basalt-ui shot needs Playwright: bun add -d playwright && bunx playwright install chromium',
    )
  })

  test('a failed launch exits 1 with the install line and leaves the previous board intact', async () => {
    const cwd = tmp()
    mkdirSync(join(cwd, '.basalt/shots/latest'), { recursive: true })
    writeFileSync(join(cwd, '.basalt/shots/latest/metrics.json'), '{"version":1}')
    writeFileSync(join(cwd, '.basalt/shots/latest/board.html'), 'previous')
    const { result, lines } = await errors(() =>
      shot(['/', '--base', 'http://x'], cwd, { resolve: () => fakePw([undefined, 'chrome']) }),
    )
    expect(result).toBe(1)
    expect(lines[0]?.split('\n')[0]).toBe(INSTALL_LINE)
    expect(readFileSync(join(cwd, '.basalt/shots/latest/board.html'), 'utf8')).toBe('previous')
    expect(readdirNames(join(cwd, '.basalt/shots'))).toEqual(['latest'])
  })

  test('--out src is refused before anything is launched or deleted', async () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'src'))
    writeFileSync(join(cwd, 'src/keep.ts'), 'x')
    const log: string[] = []
    const { result, lines } = await errors(() =>
      shot(['/', '--base', 'http://x', '--out', 'src'], cwd, { resolve: () => fakePw([], log) }),
    )
    expect(result).toBe(1)
    expect(lines.join()).toMatch(/--out src exists and is not purely a previous shot output/)
    expect(log).toEqual([])
    expect(existsSync(join(cwd, 'src/keep.ts'))).toBe(true)
  })

  const run = (cwd: string, shots: ShotRecord[], logs: string[] = []): Promise<number> =>
    shot(['/dashboard', '--base', 'http://127.0.0.1:1', '--out', '.basalt/shots/r1'], cwd, {
      resolve: () => fakePw([]),
      now: () => new Date('2026-10-16T00:00:00.000Z'),
      log: (l) => void logs.push(l),
      capture: ({ pngDir }) => {
        writeFileSync(join(pngDir, 'a.png'), '')
        return Promise.resolve({
          anchors: fakeMetrics().anchors,
          shots,
          scale: fakeMetrics().scale,
        })
      },
    })

  test('writes metrics.json, board.html, last.json and .gitignore; exits 1 when a shot errored', async () => {
    const cwd = tmp()
    const logs: string[] = []
    const { result, lines } = await errors(() => run(cwd, fakeMetrics().shots, logs))
    expect(result).toBe(1)
    expect(lines).toEqual(['basalt-ui shot: 1 shot(s) failed; see board.html'])
    const out = join(cwd, '.basalt/shots/r1')
    const written = JSON.parse(readFileSync(join(out, 'metrics.json'), 'utf8')) as ShotMetrics
    expect(Object.keys(written)).toEqual([
      'version',
      'generatedAt',
      'base',
      'routes',
      'viewports',
      'schemes',
      'states',
      'scale',
      'anchors',
      'shots',
    ])
    expect(existsSync(join(out, 'png/a.png'))).toBe(true)
    expect(readFileSync(join(out, 'board.html'), 'utf8')).toContain('stat-card')
    expect(readFileSync(join(out, '.gitignore'), 'utf8')).toBe('*\n')
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/shots/last.json'), 'utf8'))).toEqual({
      version: 1,
      at: '2026-10-16T00:00:00.000Z',
      out: '.basalt/shots/r1',
      routes: ['/dashboard'],
    })
    expect(logs.join('\n')).toContain('2 shots')
    expect(logs.join('\n')).toContain('1 not declared, 1 skipped, 1 failed')
    expect(readdirNames(join(cwd, '.basalt/shots'))).toEqual(['.gitignore', 'last.json', 'r1'])
  })

  test('a named run, then the default run, then the default again all succeed', async () => {
    const cwd = tmp()
    const ok = fakeMetrics().shots.filter((s) => s.status === 'ok')
    const go = (extra: string[]): Promise<number> =>
      shot(['/dashboard', '--base', 'http://127.0.0.1:1', ...extra], cwd, {
        resolve: () => fakePw([]),
        log: () => undefined,
        capture: () => Promise.resolve({ anchors: [], shots: ok, scale: [] }),
      })
    expect(await go(['--out', '.basalt/shots/r1'])).toBe(0)
    expect(await go([])).toBe(0)
    expect(await go([])).toBe(0)
    expect(readdirNames(join(cwd, '.basalt/shots'))).toEqual([
      '.gitignore',
      'last.json',
      'latest',
      'r1',
    ])
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/shots/last.json'), 'utf8')).out).toBe(
      '.basalt/shots/latest',
    )
    expect(readFileSync(join(cwd, '.basalt/shots/latest/.gitignore'), 'utf8')).toBe('*\n')
  })

  test('exits 0 when every shot is ok, not-declared or skipped', async () => {
    const cwd = tmp()
    const { result } = await errors(() =>
      run(
        cwd,
        fakeMetrics().shots.filter((s) => s.status !== 'error'),
      ),
    )
    expect(result).toBe(0)
  })
})

const readdirNames = (dir: string): string[] =>
  [...new Bun.Glob('*').scanSync({ cwd: dir, dot: true, onlyFiles: false })].toSorted()

describe('buildBoard', () => {
  const html = buildBoard(fakeMetrics())
  test('is self-contained with relative image paths', () => {
    expect(html).not.toMatch(/(?:src|href)="(?:https?:)?\/\//)
    expect(html).toContain('src="png/a.png"')
    expect(html).toContain('<style>')
  })
  test('labels not-declared, skipped and error cells, with their notes', () => {
    expect(html).toContain('empty not-declared">not-declared: no [data-shot-tooltip] in the anchor')
    expect(html).toContain('empty error">error: anchor not found')
    expect(html).toContain('empty skipped">skipped: desktop only')
    expect(html).toContain('anchor only present in this state')
  })
  test('shows metrics, nested surfaces per row, the assumed backdrop, and escapes text', () => {
    expect(html).toContain('<th>contrast min</th>')
    expect(html).toContain('300×120')
    expect(html).toContain('light/desktop<ul><li>div.inner r6')
    expect(html).toContain('backdrop assumed white')
    expect(html).toContain('Muted &#60;b&#62;')
    expect(html).not.toContain('Muted <b>')
  })
  test('shows the theme scale once for identical scale entries', () => {
    expect(html.match(/<summary>Theme scale/g)).toHaveLength(1)
    expect(html).toContain(
      '<td>light/desktop, dark/desktop</td><td>xs 10 · sm 12</td><td>md 8 · card 7</td><td>sm 14</td>',
    )
  })
  test('a route without anchors says so', () => {
    const m = fakeMetrics()
    m.anchors = []
    m.shots = m.shots.filter((s) => s.name === '_page')
    expect(buildBoard(m)).toContain('no data-shot anchors on this route')
  })
})

describe('contrast maths', () => {
  test('WCAG anchors: black on white is 21, identical is 1', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5)
    expect(contrastRatio([119, 119, 119], [119, 119, 119])).toBeCloseTo(1, 5)
  })
  test('#767676 on white is the AA boundary (4.54)', () => {
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2)
  })
  test('large-text threshold: ≥ 24px, or ≥ 18.66px bold', () => {
    expect(contrastThreshold(16, false)).toBe(4.5)
    expect(contrastThreshold(24, false)).toBe(3)
    expect(contrastThreshold(18.66, true)).toBe(3)
    expect(contrastThreshold(18.66, false)).toBe(4.5)
    expect(contrastThreshold(18, true)).toBe(4.5)
  })
})

describe('finishMeasurement', () => {
  const { contrast: _, ...rest } = measurement
  const text = (over: Partial<TextReading>): TextReading => ({
    text: 't',
    fg: [0, 0, 0],
    bg: [255, 255, 255],
    fontSize: 16,
    bold: false,
    assumedWhite: false,
    ...over,
  })
  /** A grey-ish fg on white whose exact ratio lies in [threshold − 0.005, threshold). */
  const justUnder = (threshold: number): number[] => {
    for (let r = 100; r < 200; r++) {
      for (let b = 100; b < 200; b++) {
        const fg = [r, r, b]
        const ratio = contrastRatio(fg, [255, 255, 255])
        if (ratio < threshold && ratio >= threshold - 0.005) return fg
      }
    }
    throw new Error('no colour found')
  }

  test('min is the lowest ratio; failures use the size-aware threshold', () => {
    const m = finishMeasurement({
      ...rest,
      texts: [
        text({}),
        text({ text: 'grey', fg: [170, 170, 170] }),
        text({ text: 'big grey', fg: [150, 150, 150], fontSize: 28 }),
      ],
    })
    expect(m.contrast.min).toBe(2.32)
    expect(m.contrast.failures.map((f) => f.text)).toEqual(['grey', 'big grey'])
    expect(m.contrast.failures[0]).toEqual({
      text: 'grey',
      ratio: 2.32,
      fg: '#aaaaaa',
      bg: '#ffffff',
      fontSize: 16,
    })
    expect(m.contrast.backdrop).toBeUndefined()
  })
  test('a ratio that ROUNDS to the threshold but sits under it still fails (body 4.5, large 3)', () => {
    for (const [threshold, fontSize] of [
      [4.5, 16],
      [3, 28],
    ] as const) {
      const fg = justUnder(threshold)
      const m = finishMeasurement({ ...rest, texts: [text({ fg, fontSize })] })
      expect(m.contrast.failures).toHaveLength(1)
      expect(m.contrast.failures[0]?.ratio).toBe(threshold)
    }
  })
  test('exactly the threshold passes', () => {
    expect(
      finishMeasurement({ ...rest, texts: [text({ fg: [0, 0, 0], bg: [255, 255, 255] })] }).contrast
        .failures,
    ).toEqual([])
  })
  test('an assumed backdrop is recorded', () => {
    expect(
      finishMeasurement({ ...rest, texts: [text({ assumedWhite: true })] }).contrast.backdrop,
    ).toBe('assumed-white')
  })
  test('no text: min is null, no failures', () => {
    expect(finishMeasurement({ ...rest, texts: [] }).contrast).toEqual({ min: null, failures: [] })
  })
})

describe('capture helpers', () => {
  test('withParam puts the state query before any fragment', () => {
    expect(withParam('/a', 'empty')).toBe('/a?shot-state=empty')
    expect(withParam('/a?x=1', 'error')).toBe('/a?x=1&shot-state=error')
    expect(withParam('/a#top', 'empty')).toBe('/a?shot-state=empty#top')
    expect(withParam('/a?x=1#top', 'loading')).toBe('/a?x=1&shot-state=loading#top')
  })
  test('unionClip unions, grows by the margin and clamps to the viewport', () => {
    expect(
      unionClip(
        [
          { x: 2, y: 10, width: 100, height: 50 },
          { x: 90, y: 40, width: 60, height: 100 },
        ],
        8,
        'mobile',
      ),
    ).toEqual({
      x: 0,
      y: 2,
      width: 158,
      height: 146,
    })
  })
})
