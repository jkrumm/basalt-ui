import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildBoard } from './board'
import {
  capture,
  describedByOf,
  fileName,
  groupScale,
  hasFocusTarget,
  hoverAtOf,
  hoverTrigger,
  markVisibleTooltips,
  openContext,
  parseHoverAt,
  readScaleInPage,
  sheetName,
  tagAutoAnchors,
  tooltipSelector,
  unionClip,
  visibleTooltip,
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
import { contrastRatio, contrastThreshold, finishMeasurement, radiusReading } from './measure'
import type { TextReading } from './measure'
import { INSTALL_LINE, ShotError, isPlaywright, withBrowser } from './playwright'
import type { Playwright } from './playwright'
import { seedScript } from './real-data'
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
  test('skips a candidate CSS never renders (display:none, visibility:hidden)', () => {
    expect(hasFocusTarget(host('<button style="display:none">x</button>'))).toBe(false)
    expect(hasFocusTarget(host('<div style="display:none"><a href="/x">x</a></div>'))).toBe(false)
    expect(hasFocusTarget(host('<button style="visibility:hidden">x</button>'))).toBe(false)
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

describe('scaleError', () => {
  const browserWith = (scale: () => unknown) => {
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
      setContent: () => Promise.resolve(),
      mouse: { move: () => Promise.resolve() },
      keyboard: { press: () => Promise.resolve() },
      evaluate: (e: unknown) =>
        typeof e === 'function'
          ? Promise.resolve().then(scale)
          : String(e).includes('data-shot-states')
            ? Promise.resolve({ anchors: ['card'], declared: [] })
            : Promise.resolve(undefined),
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
  const read = { mantine: { spacing: {}, radius: {}, fontSizes: {} }, vx: {} }
  const run = (scale: () => unknown, log: string[] = []) =>
    capture({
      browser: browserWith(scale),
      base: 'http://x',
      routes: ['/'],
      states: ['rest'],
      pngDir: '/unused',
      log: (l) => log.push(l),
      measure: () => Promise.resolve(measurement),
    })

  test('a read that fails once and then succeeds leaves no scaleError', async () => {
    let calls = 0
    const log: string[] = []
    const out = await run(() => {
      if (calls++ === 0) throw new Error('first read failed')
      return read
    }, log)
    expect(out.scale.length).toBe(3)
    expect(out.scaleError).toBeUndefined()
    expect(log.some((l) => /scale unavailable/.test(l))).toBe(false)
  })
  test('a scale that never reads reports the first reason once', async () => {
    const log: string[] = []
    const out = await run(() => {
      throw new Error('never')
    }, log)
    expect(out.scale).toEqual([])
    expect(out.scaleError).toBe('never')
    expect(log.filter((l) => /scale unavailable: never/.test(l))).toHaveLength(1)
  })
})

describe('tooltip lookup', () => {
  test('tooltipSelector prefers the trigger’s own id, else excludes what was already open', () => {
    expect(tooltipSelector('tip-1')).toBe('[role="tooltip"][id="tip-1"]')
    expect(tooltipSelector('')).toBe('[role="tooltip"]:not([data-shot-seen])')
  })
  test('the probe narrows to a rendered readout', () => {
    expect(visibleTooltip('')).toBe('[role="tooltip"]:not([data-shot-seen]):visible')
  })
  test('data-shot-at is two fractions of the box; anything else is null, so the centre', () => {
    expect(parseHoverAt('0.25,0.5')).toEqual({ x: 0.25, y: 0.5 })
    expect(parseHoverAt(' 0 , 0.99 ')).toEqual({ x: 0, y: 0.99 })
    expect(parseHoverAt('.5,.5')).toEqual({ x: 0.5, y: 0.5 })
    for (const bad of [
      '',
      'a,b',
      '0.5,',
      ',0.5',
      ',',
      '1.5,-0.2',
      '-1,0.5',
      '0.5,0.5,0.5',
      '1.01,0',
    ])
      expect(parseHoverAt(bad)).toBeNull()
    document.body.innerHTML = '<i id="t" data-shot-at="0.1,0.2"></i>'
    expect(hoverAtOf(document.getElementById('t'))).toBe('0.1,0.2')
    expect(hoverAtOf(null)).toBe('')
  })
  describe('hoverTrigger', () => {
    const run = async (attr: string, box: { width: number; height: number } | null) => {
      const hovered: unknown[] = []
      const target = {
        evaluate: () => Promise.resolve(attr),
        boundingBox: () => Promise.resolve(box),
        hover: (o: unknown) => {
          hovered.push(o)
          return Promise.resolve()
        },
      }
      await hoverTrigger(target as unknown as Parameters<typeof hoverTrigger>[0])
      return hovered[0] as { timeout: number; position?: { x: number; y: number } }
    }
    test('a declared point hovers at the fractions of the box', async () => {
      const o = await run('0.25,0.5', { width: 400, height: 200 })
      expect(o.position).toEqual({ x: 100, y: 100 })
      expect(typeof o.timeout).toBe('number')
    })
    test('no attribute, a malformed one, or no box hovers the centre', async () => {
      for (const [attr, box] of [
        ['', { width: 400, height: 200 }],
        ['0.5,', { width: 400, height: 200 }],
        ['0.25,0.5', null],
      ] as const) {
        const o = await run(attr, box)
        expect(o.position).toBeUndefined()
        expect(typeof o.timeout).toBe('number')
      }
    })
  })
  test('markVisibleTooltips marks only visible tooltips and forgets stale marks', () => {
    document.body.innerHTML =
      '<span id="a" role="tooltip">a</span><span id="b" role="tooltip">b</span><span id="c" data-shot-seen></span>'
    const [a, b] = ['a', 'b'].map((id) => document.getElementById(id) as Element)
    a!.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect
    b!.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect
    markVisibleTooltips()
    expect(a!.hasAttribute('data-shot-seen')).toBe(true)
    expect(b!.hasAttribute('data-shot-seen')).toBe(false)
    expect(document.getElementById('c')!.hasAttribute('data-shot-seen')).toBe(false)
  })
  test('describedByOf reads the first id on the trigger or a descendant', () => {
    document.body.innerHTML =
      '<div id="t"><button aria-describedby="x y">i</button></div><p id="p"></p>'
    expect(describedByOf(document.getElementById('t'))).toBe('x')
    expect(describedByOf(document.getElementById('p'))).toBe('')
    expect(describedByOf(null)).toBe('')
  })
  test('a foreign tooltip that was already open is not the one cropped', async () => {
    const FOREIGN = { x: 900, y: 700, width: 100, height: 30 }
    const ANCHOR = { x: 100, y: 100, width: 200, height: 60 }
    const TIP = { x: 120, y: 170, width: 180, height: 40 }
    const clips: unknown[] = []
    const asked: string[] = []
    const element: Record<string, unknown> = {
      first: () => element,
      count: () => Promise.resolve(1),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      isVisible: () => Promise.resolve(true),
      hover: () => Promise.resolve(),
      screenshot: () => Promise.resolve(),
      boundingBox: () => Promise.resolve(ANCHOR),
      evaluate: () => Promise.resolve(''),
    }
    const tipFor = (selector: string): Record<string, unknown> => {
      const tip: Record<string, unknown> = {
        first: () => tip,
        waitFor: () => Promise.resolve(),
        // A bare `[role="tooltip"]` finds the foreign one first; the snapshot-aware one finds ours.
        boundingBox: () => Promise.resolve(selector.includes('data-shot-seen') ? TIP : FOREIGN),
      }
      return tip
    }
    const page = {
      setDefaultTimeout: () => undefined,
      goto: () => Promise.resolve(),
      locator: (selector: string) => {
        if (!selector.includes('tooltip')) return element
        asked.push(selector)
        return tipFor(selector)
      },
      screenshot: (o: { clip?: unknown }) => {
        clips.push(o.clip)
        return Promise.resolve()
      },
      setContent: () => Promise.resolve(),
      mouse: { move: () => Promise.resolve() },
      keyboard: { press: () => Promise.resolve() },
      evaluate: (e: unknown) =>
        typeof e === 'function'
          ? Promise.resolve(undefined)
          : String(e).includes('data-shot-states')
            ? Promise.resolve({ anchors: ['card'], declared: [] })
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
      states: ['hover'],
      pngDir: '/unused',
      log: () => undefined,
      measure: () => Promise.resolve(measurement),
    })
    expect(asked.every((q) => q === '[role="tooltip"]:not([data-shot-seen]):visible')).toBe(true)
    expect(clips.length).toBeGreaterThan(0)
    for (const clip of clips) {
      const c = clip as { x: number; y: number; width: number; height: number }
      expect(c.x + c.width).toBeLessThan(FOREIGN.x)
      expect(c.y + c.height).toBeGreaterThan(TIP.y + TIP.height - 1)
    }
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
  const HOUR_AHEAD = () => new Date(Date.now() + 2 * 60 * 60 * 1000)
  const dead = () => false
  test('removes old tmp dirs whose pid is gone, by age alone when the name has no pid', () => {
    const home = tmp()
    for (const d of ['tmp-4242-aaaaaa', 'tmp-oldstyle', 'keep']) mkdirSync(join(home, d))
    sweepStaleTmp(home, HOUR_AHEAD(), dead)
    expect(existsSync(join(home, 'tmp-4242-aaaaaa'))).toBe(false)
    expect(existsSync(join(home, 'tmp-oldstyle'))).toBe(false)
    expect(existsSync(join(home, 'keep'))).toBe(true)
  })
  test('keeps a dir whose pid is alive, however old, and one younger than an hour', () => {
    const home = tmp()
    mkdirSync(join(home, `tmp-${process.pid}-live`))
    sweepStaleTmp(home, HOUR_AHEAD(), (pid) => pid === process.pid)
    expect(existsSync(join(home, `tmp-${process.pid}-live`))).toBe(true)
    mkdirSync(join(home, 'tmp-4242-fresh'))
    sweepStaleTmp(home, new Date(), dead)
    expect(existsSync(join(home, 'tmp-4242-fresh'))).toBe(true)
  })
  test('a plain file, a dangling symlink and a missing home never abort', () => {
    const home = tmp()
    writeFileSync(join(home, 'tmp-1-file'), 'x')
    symlinkSync(join(home, 'nowhere'), join(home, 'tmp-2-dangling'))
    mkdirSync(join(home, 'tmp-3-old'))
    expect(() => sweepStaleTmp(home, HOUR_AHEAD(), dead)).not.toThrow()
    expect(existsSync(join(home, 'tmp-1-file'))).toBe(true)
    expect(existsSync(join(home, 'tmp-3-old'))).toBe(false)
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
  test('a full-round radius renders as "full" on the anchor and as "r full" on a nested box', () => {
    const m = fakeMetrics()
    const [anchor] = m.anchors
    if (!anchor) throw new Error('fixture has no anchor')
    m.anchors = [
      {
        ...anchor,
        radius: 'full',
        nested: [
          { path: 'span.dot', radius: 'full', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        ],
      },
    ]
    const out = buildBoard(m)
    expect(out).toContain('<td>full</td>')
    expect(out).toContain('span.dot r full p')
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

describe('radiusReading', () => {
  const box = { width: 40, height: 40 }
  test('a 50% radius is "full", never 50px', () => {
    expect(radiusReading({ value: '50%', ...box })).toBe('full')
    expect(radiusReading({ value: '50%', width: 120, height: 24 })).toBe('full')
    expect(radiusReading({ value: '60%', width: 400, height: 40 })).toBe('full')
  })
  test('a pill radius (9999px) or one at half the shorter side is "full"', () => {
    expect(radiusReading({ value: '9999px', width: 80, height: 24 })).toBe('full')
    expect(radiusReading({ value: '12px', width: 80, height: 24 })).toBe('full')
  })
  test('a smaller radius stays in px, a percentage resolved against the box', () => {
    expect(radiusReading({ value: '10px', width: 80, height: 40 })).toBe(10)
    expect(radiusReading({ value: '10%', width: 80, height: 80 })).toBe(8)
    expect(radiusReading({ value: '0px', ...box })).toBe(0)
  })
  test('a 20% radius on a wide, short box is not full', () => {
    expect(radiusReading({ value: '20%', width: 400, height: 40 })).toBe(8)
  })
  test('a zero-size box has nothing to round', () => {
    expect(radiusReading({ value: '50%', width: 0, height: 0 })).toBe(0)
    expect(radiusReading({ value: '9999px', width: 0, height: 24 })).toBe(0)
  })
  test('finishMeasurement reports it on the anchor and on nested boxes', () => {
    const { contrast: _, radius: __, nested: ___, ...tail } = measurement
    const out = finishMeasurement({
      ...tail,
      radius: { value: '50%', ...box },
      nested: [
        {
          path: 'span',
          radius: { value: '6px', width: 100, height: 40 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      ],
      texts: [],
    })
    expect(out.radius).toBe('full')
    expect(out.nested[0]?.radius).toBe(6)
  })
})

describe('finishMeasurement', () => {
  const { contrast: _, radius: __, nested: ___, ...tail } = measurement
  const rest = { ...tail, radius: { value: '8px', width: 100, height: 100 }, nested: [] }
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
  test('text inside a disabled control is exempt (WCAG 1.4.3 inactive components)', () => {
    const m = finishMeasurement({
      ...rest,
      texts: [text({ text: 'Disabled', fg: [170, 170, 170], disabled: true }), text({})],
    })
    expect(m.contrast.failures).toEqual([])
    expect(m.contrast.min).toBe(21)
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

describe('real-app flags', () => {
  const src = { env: { TOKEN: 's3cret-token', EMPTY: '' }, cwd: '/nowhere' }
  const parse = (...extra: string[]) => parseShotArgs(['/', '--dist', 'd', ...extra], src)

  test('defaults: no seeds, no proxy, no extra wait, no auto anchors, read-only', () => {
    const a = parse()
    expect([a.localStorage, a.api, a.headers, a.wait, a.autoAnchors, a.allowWrites]).toEqual([
      [],
      [],
      [],
      0,
      false,
      false,
    ])
  })
  test('--local-storage takes @env and @file, repeatable', () => {
    const cwd = tmp()
    writeFileSync(join(cwd, 'tok'), 'from-file\n')
    const a = parseShotArgs(
      ['/', '--dist', 'd', '--local-storage', 'b=@env:TOKEN', '--local-storage', 'c=@file:tok'],
      { env: src.env, cwd },
    )
    expect(a.localStorage).toEqual([
      ['b', 's3cret-token'],
      ['c', 'from-file'],
    ])
  })
  test('--api, --header, --wait, --auto-anchors, --api-allow-writes', () => {
    const a = parse(
      '--api',
      '/api/=https://x.example.com/ignored',
      '--header',
      'authorization=@env:TOKEN',
      '--wait',
      '1500',
      '--auto-anchors',
      '--api-allow-writes',
    )
    expect(a.api).toEqual([{ prefix: '/api', origin: 'https://x.example.com' }])
    expect(a.headers).toEqual([['authorization', 's3cret-token']])
    expect([a.wait, a.autoAnchors, a.allowWrites]).toEqual([1500, true, true])
    expect(parse('--wait', 'networkidle').wait).toBe(0)
  })
  test('http is fine for loopback, and without --header', () => {
    expect(parse('--api', '/a=http://localhost:3000', '--header', 'x=@env:TOKEN').api).toHaveLength(
      1,
    )
    expect(parse('--api', '/a=http://remote.example.com').api).toHaveLength(1)
    expect(
      parse('--api', '/a=http://127.0.0.1:3000', '--local-storage', 'k=@env:TOKEN').api,
    ).toHaveLength(1)
    // Several origins are fine while no --header would be sent to all of them.
    expect(
      parse('--api', '/a=https://x.example.com', '--api', '/b=https://y.example.com').api,
    ).toHaveLength(2)
  })
  test.each([
    [['--local-storage', 'novalue'], /expects <name>=<value>/],
    [['--local-storage', 'a=lit=eral'], /never a literal/],
    [['--local-storage', 'k=@env:MISSING'], /@env:MISSING is empty/],
    [['--local-storage', 'k=@env:toString'], /@env:toString is empty/],
    [['--local-storage', 'k=@env:EMPTY'], /@env:EMPTY is empty/],
    [['--local-storage', 'k=@file:nope'], /cannot read @file:nope/],
    [['--api', 'api=https://x'], /prefix must start/],
    [['--api', '/=https://x'], /prefix must start/],
    [['--api', '//=https://x'], /prefix must start/],
    [['--api', '/api=ftp://x'], /http\(s\)/],
    [['--header', 'a=@env:TOKEN'], /sent on --api requests only/],
    [['--api', '/api=https://x', '--header', 'a=literal'], /never a literal/],
    [['--api', '/api=http://remote.example.com', '--header', 'a=@env:TOKEN'], /must be https/],
    [
      ['--api', '/api=http://remote.example.com', '--local-storage', 'k=@env:TOKEN'],
      /must be https/,
    ],
    [
      [
        '--api',
        '/a=https://x.example.com',
        '--api',
        '/b=https://y.example.com',
        '--header',
        'a=@env:TOKEN',
      ],
      /more than one/,
    ],
    [['--api', '/api=https://x', '--header', 'host=@env:TOKEN'], /--header host: not a header/],
    [['--api', '/api=https://x', '--header', 'bad name=@env:TOKEN'], /not a header/],
    [['--wait', 'soon'], /--wait takes/],
  ])('rejects %j', (flags, message) => {
    expect(() => parse(...flags)).toThrow(ShotError)
    expect(() => parse(...flags)).toThrow(message)
  })
  test('a header value with a line break is refused by name, without the value', () => {
    const bad = { env: { T: 'ok\r\nx-evil: 1' }, cwd: '/' }
    const flags = ['/', '--dist', 'd', '--api', '/a=https://x', '--header', 'x-key=@env:T']
    expect(() => parseShotArgs(flags, bad)).toThrow(/--header x-key: value has characters/)
    expect(() => parseShotArgs(flags, bad)).not.toThrow(/evil/)
  })
  test('--api needs --dist', () => {
    expect(() => parseShotArgs(['/', '--base', 'http://x', '--api', '/a=https://x'], src)).toThrow(
      /--api needs --dist/,
    )
  })
  test('an error never carries the secret value', () => {
    for (const flags of [
      ['--local-storage', 's3cret-token'],
      ['--local-storage', 'k=s3cret-token'],
      ['--api', '/api=https://x', '--header', 'a=s3cret-token'],
      ['--api', '/api=http://remote.example.com', '--header', 'a=@env:TOKEN'],
    ]) {
      expect(() => parse(...flags)).toThrow(ShotError)
      try {
        parse(...flags)
      } catch (error) {
        expect((error as Error).message).not.toContain('s3cret-token')
      }
    }
  })
  test('the help.ts gate accepts the new flags', () => {
    expect(
      unknownFlag('shot', [
        '/',
        '--dist',
        'd',
        '--api',
        '/a=https://x',
        '--header',
        'h=@env:X',
        '--local-storage',
        'k=@env:X',
        '--wait',
        '1',
        '--auto-anchors',
        '--api-allow-writes',
      ]),
    ).toBeNull()
  })
})

describe('auto anchors', () => {
  test('tagAutoAnchors numbers every match and tags only those over 120×60', () => {
    const tagged: Record<string, string> = {}
    const el = (name: string, width: number, height: number) => ({
      getBoundingClientRect: () => ({ width, height }),
      setAttribute: (_: string, value: string) => void (tagged[name] = value),
    })
    const els = [
      el('small', 100, 200),
      el('card', 300, 100),
      el('flat', 300, 60),
      el('table', 500, 400),
    ]
    const g = globalThis as { document?: unknown }
    const saved = g.document
    g.document = { querySelectorAll: () => els }
    try {
      tagAutoAnchors()
    } finally {
      g.document = saved
    }
    expect(tagged).toEqual({ card: 'auto-02', table: 'auto-04' })
  })
})

/** A browser whose one page behaves as `page` says; enough of the surface for the real `capture`. */
const scriptedBrowser = (page: Record<string, unknown>) =>
  ({
    newContext: () =>
      Promise.resolve({
        newPage: () => Promise.resolve(page),
        addInitScript: () => Promise.resolve(),
        close: () => Promise.resolve(),
      }),
  }) as never

const quietPage = (over: Record<string, unknown> = {}) => {
  const locator: Record<string, unknown> = {
    first: () => locator,
    count: () => Promise.resolve(0),
    screenshot: () => Promise.resolve(),
  }
  return {
    setDefaultTimeout: () => undefined,
    goto: () => Promise.resolve(),
    locator: () => locator,
    screenshot: () => Promise.resolve(),
    setContent: () => Promise.resolve(),
    mouse: { move: () => Promise.resolve() },
    keyboard: { press: () => Promise.resolve() },
    evaluate: (expression: unknown) =>
      Promise.resolve(
        typeof expression === 'string' && expression.includes('data-shot-states')
          ? { anchors: [], declared: [] }
          : undefined,
      ),
    ...over,
  }
}

describe('data trust in capture', () => {
  const input = (browser: never, over: object = {}) => ({
    browser,
    base: 'http://x',
    routes: ['/'],
    states: ['rest' as const],
    pngDir: '/unused',
    log: () => undefined,
    ...over,
  })

  test('a 401/403 or unanswered proxied call turns the page shot into an error', async () => {
    const logs: string[] = []
    const out = await capture(
      input(scriptedBrowser(quietPage()), {
        apiProblems: () => ['GET /api/kpi 401'],
        log: (l: string) => void logs.push(l),
      }),
    )
    const pages = out.shots.filter((s) => s.name === '_page')
    expect(pages).toHaveLength(4)
    expect(pages.every((s) => s.status === 'error' && s.note === 'GET /api/kpi 401')).toBe(true)
    expect(logs.join('\n')).toContain('GET /api/kpi 401')
  })

  test('a failed localStorage seed is logged by key and fails the page', async () => {
    const logs: string[] = []
    const page = quietPage({
      evaluate: (expression: unknown) =>
        Promise.resolve(
          String(expression).includes('__shotSeedFailed')
            ? 'auth'
            : String(expression).includes('data-shot-states')
              ? { anchors: [], declared: [] }
              : undefined,
        ),
    })
    const out = await capture(
      input(scriptedBrowser(page), {
        localStorage: [['auth', 'tok-secret']],
        log: (l: string) => void logs.push(l),
      }),
    )
    expect(out.shots.every((s) => s.status === 'error')).toBe(true)
    expect(logs.join('\n')).toContain('localStorage seed failed (auth)')
    expect(logs.join('\n')).not.toContain('tok-secret')
  })

  /** A page with one `card` anchor whose hover, goto and screenshots can queue proxy problems. */
  const cardPage = (hooks: {
    goto?: (url: string) => void
    hover?: () => void
    shot?: (url: string) => void
  }) => {
    let url = ''
    const locator: Record<string, unknown> = {
      first: () => locator,
      count: () => Promise.resolve(1),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      isVisible: () => Promise.resolve(true),
      screenshot: () => Promise.resolve(),
      hover: () => Promise.resolve(hooks.hover?.()),
      evaluate: () => Promise.resolve(''),
      boundingBox: () => Promise.resolve(null),
      waitFor: () => Promise.reject(new Error('no tooltip')),
    }
    return quietPage({
      goto: (to: string) => {
        url = to
        return Promise.resolve(hooks.goto?.(to))
      },
      locator: () => locator,
      screenshot: () => Promise.resolve(hooks.shot?.(url)),
      evaluate: (expression: unknown) =>
        Promise.resolve(
          typeof expression === 'string' && expression.includes('data-shot-states')
            ? { anchors: ['card'], declared: [] }
            : undefined,
        ),
    })
  }
  /** The proxy's drain, as a queue the page hooks append to. */
  const queue = () => {
    let pending: string[] = []
    return {
      push: (p: string) => void pending.push(p),
      drain: () => ((p) => ((pending = []), p))(pending),
    }
  }

  test('a 401 during hover fails the page: the rest crop, the hover crop and _page', async () => {
    const q = queue()
    const out = await capture(
      input(scriptedBrowser(cardPage({ hover: () => q.push('GET /api +1 401') })), {
        states: ['rest', 'hover'],
        apiProblems: q.drain,
      }),
    )
    const desktop = out.shots.filter((s) => s.viewport === 'desktop' && s.scheme === 'light')
    expect(desktop.map((s) => [s.name, s.state, s.status]).toSorted()).toEqual([
      ['_page', 'rest', 'error'],
      ['card', 'hover', 'error'],
      ['card', 'rest', 'error'],
    ])
    expect(desktop.every((s) => s.note === 'GET /api +1 401')).toBe(true)
    // Mobile skips hover, so its page visit never sees the 401: scoped per visit, it stays ok.
    expect(
      out.shots.filter((s) => s.viewport === 'mobile' && s.state === 'rest').map((s) => s.status),
    ).toEqual(Array(4).fill('ok'))
  })

  test('a 401 queued during route A fails A only; route B is clean', async () => {
    const q = queue()
    const out = await capture(
      input(
        scriptedBrowser(
          cardPage({ shot: (url) => url.endsWith('/a') && q.push('GET /api +1 401') }),
        ),
        { routes: ['/a', '/b'], apiProblems: q.drain },
      ),
    )
    expect(out.shots.filter((s) => s.route === '/a').every((s) => s.status === 'error')).toBe(true)
    expect(out.shots.filter((s) => s.route === '/b').every((s) => s.status === 'ok')).toBe(true)
  })

  test("a problem left in the queue before a route starts is not that route's", async () => {
    const q = queue()
    q.push('GET /api +1 401')
    const out = await capture(input(scriptedBrowser(cardPage({})), { apiProblems: q.drain }))
    expect(out.shots.every((s) => s.status === 'ok')).toBe(true)
  })

  test('leaving the app origin is reported as not seeded, not as a failed seed', async () => {
    const logs: string[] = []
    const page = quietPage({
      evaluate: (expression: unknown) =>
        Promise.resolve(
          String(expression).includes('__shotSeedFailed')
            ? 'origin'
            : String(expression).includes('data-shot-states')
              ? { anchors: [], declared: [] }
              : undefined,
        ),
    })
    const out = await capture(
      input(scriptedBrowser(page), {
        localStorage: [['auth', 'x']],
        log: (l: string) => void logs.push(l),
      }),
    )
    expect(logs.join('\n')).toContain('page left the app origin; not seeded')
    expect(logs.join('\n')).not.toContain('seed failed')
    expect(out.shots.every((s) => s.status === 'ok')).toBe(true)
  })

  test('auto anchors are tagged again on a state reload', async () => {
    let tags = 0
    const page = quietPage({
      evaluate: (expression: unknown) => {
        if (typeof expression === 'function') {
          if (expression.name === 'tagAutoAnchors') tags++
          return Promise.resolve(undefined)
        }
        return Promise.resolve(
          String(expression).includes('data-shot-states')
            ? { anchors: [], declared: ['empty'] }
            : undefined,
        )
      },
    })
    await capture(input(scriptedBrowser(page), { autoAnchors: true, states: ['rest', 'empty'] }))
    // Per scheme × viewport: one tag on the first load, one on the `empty` reload.
    expect(tags).toBe(8)
  })
})

describe('seedScript', () => {
  const run = (origin: string, store: Map<string, string>, throwing = false) => {
    const g: Record<string, unknown> = {}
    new Function(
      'location',
      'localStorage',
      'globalThis',
      seedScript([['auth', 'a"b']], 'http://app'),
    )(
      { origin },
      {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (throwing) throw new Error('quota')
          store.set(k, v)
        },
      },
      g,
    )
    return g['__shotSeedFailed']
  }
  test('sets the keys on the app origin only', () => {
    const here = new Map<string, string>()
    expect(run('http://app', here)).toBeUndefined()
    expect([...here]).toEqual([['auth', 'a"b']])
    const there = new Map<string, string>()
    expect(run('http://elsewhere', there)).toBe('origin')
    expect(there.size).toBe(0)
  })
  test('a key the app already holds (a rotated token) is not overwritten', () => {
    const store = new Map([['auth', 'rotated']])
    expect(run('http://app', store)).toBeUndefined()
    expect(store.get('auth')).toBe('rotated')
  })
  test('reports the keys that could not be set', () => {
    expect(run('http://app', new Map(), true)).toBe('auth')
  })
})

describe('real-data run', () => {
  const dist = (): string => {
    const dir = tmp()
    writeFileSync(join(dir, 'index.html'), '<h1>app</h1>')
    return dir
  }
  /**
   * Runs in its own bun process: the happy-dom preload swaps the global `Response`/`fetch` for ones
   * `Bun.serve` rejects, so a real server only works outside it. `body` sees `up(...)` helpers.
   */
  const inBun = async (distDir: string, body: string): Promise<Record<string, unknown>> => {
    const script = `
      import { apiProxy } from ${JSON.stringify(join(import.meta.dir, 'real-data'))}
      import { serveDist } from ${JSON.stringify(join(import.meta.dir, 'serve'))}
      const DIST = ${JSON.stringify(distDir)}
      const seen = []
      const logs = []
      const api = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
        const url = new URL(req.url)
        seen.push({ path: url.pathname + url.search, auth: req.headers.get('authorization'), method: req.method, body: await req.text() })
        const status = { '/api/denied': 401, '/api/missing': 404, '/api/missing/9f8e7d': 404, '/api/boom': 500 }[url.pathname]
        if (url.pathname === '/api/moved') return new Response(null, { status: 302, headers: { location: '/login' } })
        return status ? new Response('no', { status }) : Response.json({ ok: true })
      } })
      const closed = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('') })
      const closedPort = closed.port
      closed.stop(true)
      const hang = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Promise(() => {}) })
      const up = (routes, headers, opts = {}) => {
        const proxy = apiProxy(routes, headers, { log: (l) => logs.push(l), ...opts })
        return { proxy, server: serveDist(DIST, proxy.handle) }
      }
      const result = {}
      ${body}
      console.log(JSON.stringify({ ...result, seen, logs }))
      process.exit(0)`
    const run = Bun.spawn(['bun', '-e', script], { stdout: 'pipe', stderr: 'pipe' })
    const out = await new Response(run.stdout).text()
    await run.exited
    return JSON.parse(out) as Record<string, unknown>
  }
  const HEAD = "const base = 'http://127.0.0.1:' + api.port"

  test('proxies GET with the header, but never on a navigation; other paths stay static', async () => {
    const r = await inBun(
      dist(),
      `${HEAD}
      const { server } = up([{ prefix: '/api', origin: base }], [['authorization', 'Bearer s3cret']])
      result.page = await (await fetch(server.origin + '/dashboard')).text()
      result.kpi = await (await fetch(server.origin + '/api/kpi?range=7d', { headers: { authorization: 'page-token' } })).json()
      await fetch(server.origin + '/api/nav', { headers: { 'sec-fetch-mode': 'navigate' } })
      await fetch(server.origin + '/api/doc', { headers: { 'sec-fetch-dest': 'document' } })
      await fetch(server.origin + '/apiary')`,
    )
    expect(r['page']).toContain('<h1>app</h1>')
    expect(r['kpi']).toEqual({ ok: true })
    expect(r['seen']).toEqual([
      { path: '/api/kpi?range=7d', auth: 'Bearer s3cret', method: 'GET', body: '' },
      { path: '/api/nav', auth: null, method: 'GET', body: '' },
      { path: '/api/doc', auth: null, method: 'GET', body: '' },
    ])
  })

  test('writes get a logged 405 unless --api-allow-writes', async () => {
    const r = await inBun(
      dist(),
      `${HEAD}
      const ro = up([{ prefix: '/api', origin: base }], [])
      result.blocked = (await fetch(ro.server.origin + '/api/save', { method: 'POST', body: 'x=1' })).status
      const rw = up([{ prefix: '/api', origin: base }], [], { allowWrites: true })
      result.allowed = (await fetch(rw.server.origin + '/api/save', { method: 'POST', body: 'x=1' })).status`,
    )
    expect([r['blocked'], r['allowed']]).toEqual([405, 200])
    expect(r['seen']).toEqual([{ path: '/api/save', auth: null, method: 'POST', body: 'x=1' }])
    expect(String(r['logs'])).toContain('POST /api +1 blocked')
  })

  test('401 is logged and drained; a closed port and a hung origin are logged 502s', async () => {
    const r = await inBun(
      dist(),
      `${HEAD}
      const a = up([{ prefix: '/api', origin: base }], [['authorization', 'Bearer s3cret']])
      result.denied = (await fetch(a.server.origin + '/api/denied?token=q1')).status
      result.drained = a.proxy.drain()
      result.again = a.proxy.drain()
      const dead = up([{ prefix: '/api', origin: 'http://127.0.0.1:' + closedPort }], [])
      result.dead = (await fetch(dead.server.origin + '/api/x')).status
      const slow = up([{ prefix: '/api', origin: 'http://127.0.0.1:' + hang.port }], [], { timeoutMs: 100 })
      result.slow = (await fetch(slow.server.origin + '/api/x')).status
      result.slowDrained = slow.proxy.drain()`,
    )
    expect([r['denied'], r['dead'], r['slow']]).toEqual([401, 502, 502])
    expect(r['drained']).toEqual(['GET /api +1 401'])
    expect(r['again']).toEqual([])
    expect(r['slowDrained']).toEqual(['GET /api +1 TimeoutError'])
    const logs = (r['logs'] as string[]).join('\n')
    expect(logs).toContain('api GET /api +1 → 401')
    expect(logs).toContain('api GET /api +1 failed:')
    expect(logs).not.toMatch(/s3cret|q1|denied|\/api\/x/)
  })

  test('a 302, 404 or 500 from upstream is a problem, a 200 is not; no path reaches the log', async () => {
    const r = await inBun(
      dist(),
      `${HEAD}
      const a = up([{ prefix: '/api', origin: base }], [])
      for (const p of ['/api/ok', '/api/moved', '/api/missing/9f8e7d', '/api/boom']) await fetch(a.server.origin + p)
      result.problems = a.proxy.drain()`,
    )
    expect(r['problems']).toEqual(['GET /api +1 302', 'GET /api +2 404', 'GET /api +1 500'])
    expect(String(r['logs'])).not.toMatch(/9f8e7d|missing|boom/)
  })

  test('with a proxy live, a foreign Host or Origin is refused', async () => {
    const r = await inBun(
      dist(),
      `${HEAD}
      const { server } = up([{ prefix: '/api', origin: base }], [])
      result.own = (await fetch(server.origin + '/')).status
      result.origin = (await fetch(server.origin + '/api/x', { headers: { origin: 'http://evil.example' } })).status
      result.sameOrigin = (await fetch(server.origin + '/', { headers: { origin: server.origin } })).status
      result.host = (await fetch(server.origin + '/api/x', { headers: { host: 'evil.example' } })).status
      const h = (extra) => fetch(server.origin + '/', { headers: extra }).then((x) => x.status)
      result.noCorsSameSite = await h({ 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'same-site' })
      result.noCorsNoSite = await h({ 'sec-fetch-mode': 'no-cors' })
      result.crossSite = await h({ 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'cross-site' })
      result.stylesheet = await h({ 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'same-origin' })
      result.navigate = await h({ 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none' })
      const plain = serveDist(DIST)
      result.noProxy = (await fetch(plain.origin + '/', { headers: { origin: 'http://evil.example' } })).status`,
    )
    expect([r['own'], r['origin'], r['sameOrigin'], r['host'], r['noProxy']]).toEqual([
      200, 403, 200, 403, 200,
    ])
    expect([r['noCorsSameSite'], r['noCorsNoSite'], r['crossSite']]).toEqual([403, 403, 403])
    expect([r['stylesheet'], r['navigate']]).toEqual([200, 200])
    expect(r['seen']).toEqual([])
  })

  test('shot() hands the seeds to capture and writes the secret to no file or log', async () => {
    const cwd = tmp()
    const logs: string[] = []
    const seen: { localStorage?: unknown; wait?: unknown; autoAnchors?: unknown }[] = []
    process.env['SHOT_TEST_TOKEN'] = 'tok-7f3a9c'
    process.env['SHOT_TEST_BEARER'] = 'Bearer bearer-91bd'
    try {
      const { result, lines } = await errors(() =>
        shot(
          [
            '/',
            '--dist',
            dist(),
            '--out',
            '.basalt/shots/r1',
            '--api',
            '/api=https://api.example.com',
            '--local-storage',
            'auth=@env:SHOT_TEST_TOKEN',
            '--header',
            'authorization=@env:SHOT_TEST_BEARER',
            '--auto-anchors',
          ],
          cwd,
          {
            resolve: () => fakePw([]),
            log: (l) => void logs.push(l),
            capture: (input) => {
              seen.push(input)
              writeFileSync(join(input.pngDir, 'a.png'), '')
              return Promise.resolve({
                anchors: [],
                shots: fakeMetrics().shots.filter((s) => s.status === 'ok'),
                scale: [],
              })
            },
          },
        ),
      )
      expect(result).toBe(0)
      expect(seen[0]).toMatchObject({
        localStorage: [['auth', 'tok-7f3a9c']],
        wait: 0,
        autoAnchors: true,
      })
      expect(everythingWritten(cwd, logs, lines)).not.toMatch(/tok-7f3a9c|bearer-91bd/)
    } finally {
      delete process.env['SHOT_TEST_TOKEN']
      delete process.env['SHOT_TEST_BEARER']
    }
  })

  test('the real capture against a failing page leaves no secret in the log, board or metrics', async () => {
    const cwd = tmp()
    const logs: string[] = []
    process.env['SHOT_TEST_TOKEN'] = 'tok-7f3a9c'
    process.env['SHOT_TEST_BEARER'] = 'Bearer bearer-91bd'
    const page = quietPage({
      goto: () => Promise.reject(new Error('net::ERR_CONNECTION_REFUSED at tok-7f3a9c?')),
    })
    const pw: Playwright = {
      chromium: {
        launchServer: () =>
          Promise.resolve({ wsEndpoint: () => 'ws://fake', kill: () => Promise.resolve() }),
        connect: () => Promise.resolve(scriptedBrowser(page)),
      },
    }
    try {
      const { result, lines } = await errors(() =>
        shot(
          [
            '/',
            '--dist',
            dist(),
            '--out',
            '.basalt/shots/r1',
            '--api',
            '/api=https://api.example.com',
            '--local-storage',
            'auth=@env:SHOT_TEST_TOKEN',
            '--header',
            'authorization=@env:SHOT_TEST_BEARER',
          ],
          cwd,
          { resolve: () => pw, log: (l) => void logs.push(l) },
        ),
      )
      expect(result).toBe(1)
      const written = everythingWritten(cwd, logs, lines)
      expect(written).toContain('load failed')
      expect(existsSync(join(cwd, '.basalt/shots/r1/board.html'))).toBe(true)
      expect(existsSync(join(cwd, '.basalt/shots/r1/metrics.json'))).toBe(true)
      expect(written).not.toMatch(/bearer-91bd/)
    } finally {
      delete process.env['SHOT_TEST_TOKEN']
      delete process.env['SHOT_TEST_BEARER']
    }
  })

  test('openContext seeds localStorage through an origin-guarded init script', async () => {
    const scripts: string[] = []
    const browser = {
      newContext: () => Promise.resolve({ addInitScript: (s: string) => void scripts.push(s) }),
    }
    await openContext(browser as never, 'light', 'desktop', [['auth', 'a"b']], 'http://app')
    expect(scripts).toHaveLength(2)
    expect(scripts[1]).toBe(seedScript([['auth', 'a"b']], 'http://app'))
    expect(scripts[1]).toContain('location.origin!=="http://app"')
  })
})

/** Every log line, error line and file under `cwd`, as one string. */
const everythingWritten = (cwd: string, logs: string[], lines: string[]): string =>
  [
    ...logs,
    ...lines,
    ...[...new Bun.Glob('**/*').scanSync({ cwd, dot: true })].map((f) =>
      readFileSync(join(cwd, f), 'utf8'),
    ),
  ].join('\n')

describe('absent anchors', () => {
  const run = async () => {
    let url = ''
    const page = quietPage({
      goto: (u: string) => {
        url = u
        return Promise.resolve()
      },
      evaluate: (expression: unknown) =>
        Promise.resolve(
          typeof expression === 'string' && expression.includes('data-shot-states')
            ? url.includes('shot-state=')
              ? { anchors: [], declared: ['empty'] }
              : {
                  anchors: ['chart', 'table'],
                  declared: ['empty'],
                  absent: { chart: ['empty', 'error'] },
                }
            : undefined,
        ),
    })
    const out = await capture({
      browser: scriptedBrowser(page),
      base: 'http://x',
      routes: ['/'],
      states: ['empty'],
      pngDir: '/unused',
      log: () => undefined,
    })
    return out.shots.filter((s) => s.state === 'empty')
  }

  test('a rest anchor that declared itself absent in the state is `absent`, not an error', async () => {
    const chart = (await run()).filter((s) => s.name === 'chart')
    expect(chart).toHaveLength(4)
    expect(chart.every((s) => s.status === 'absent' && s.file === null)).toBe(true)
  })
  test('an undeclared absence stays an error', async () => {
    const table = (await run()).filter((s) => s.name === 'table')
    expect(
      table.every((s) => s.status === 'error' && /absent in this state/.test(s.note ?? '')),
    ).toBe(true)
  })
  test('the board labels an absent cell and the summary counts it', () => {
    const html = buildBoard({
      ...fakeMetrics(),
      shots: [
        {
          route: '/dashboard',
          name: 'chart',
          scheme: 'light',
          viewport: 'desktop',
          state: 'tooltip',
          file: null,
          status: 'absent',
          note: 'declared absent in this state',
        },
      ],
    })
    expect(html).toContain('empty absent">absent: declared absent in this state')
  })
  test('a run with only absent and ok shots exits 0 and reports the count', async () => {
    const logs: string[] = []
    const cwd = tmp()
    writeFileSync(join(cwd, 'package.json'), '{}')
    const code = await shot(['/', '--base', 'http://x'], cwd, {
      resolve: () => fakePw([]),
      now: () => new Date('2026-10-16T00:00:00.000Z'),
      log: (l) => void logs.push(l),
      capture: () =>
        Promise.resolve({
          anchors: [],
          scale: [],
          shots: [
            {
              route: '/',
              name: 'a',
              scheme: 'light',
              viewport: 'desktop',
              state: 'rest',
              file: 'png/a.png',
              status: 'ok',
            },
            {
              route: '/',
              name: 'a',
              scheme: 'light',
              viewport: 'desktop',
              state: 'empty',
              file: null,
              status: 'absent',
            },
          ],
        }),
    })
    expect(code).toBe(0)
    expect(logs.join('\n')).toContain('1 absent')
  })
})
