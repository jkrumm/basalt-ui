import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { unknownFlag } from '../help'
import { buildBoard, buildSheet } from './board'
import {
  capture,
  fileName,
  openContext,
  readFactsInPage,
  sheetName,
  snapClip,
  tagAutoAnchors,
  unionClip,
  withParam,
} from './capture'
import type { CaptureInput } from './capture'
import { manifestViewports, parseShotArgs, planOut, sanitizeBase, shot } from './index'
import { finishMeasurement, radiusReading } from './measure'
import { INSTALL_LINE, ShotError, isPlaywright, withBrowser } from './playwright'
import type { Playwright } from './playwright'
import { seedScript } from './real-data'
import { serveDist } from './serve'
import { NO_STATES_NOTE, parseViewport } from './types'
import type { Measurement, ShotMetrics, ShotRecord, ViewportSpec } from './types'

const DESKTOP = '1800x1200'
const PHONE = '390x844'

const specs = (...labels: string[]): ViewportSpec[] =>
  labels.map((l) => {
    const spec = parseViewport(l)
    if (!spec) throw new Error(`bad viewport ${l}`)
    return spec
  })
const SPECS = specs(DESKTOP, PHONE)

const dirs: string[] = []
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'shot-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))
// the happy-dom document is shared with every later file in the run: leave it empty
afterEach(() => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  }
})

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
  small: [],
  overlaps: [],
}

const record = (over: Partial<ShotRecord>): ShotRecord => ({
  route: '/dashboard',
  name: 'stat-card',
  scheme: 'light',
  viewport: DESKTOP,
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
  viewports: [DESKTOP, PHONE],
  schemes: ['light', 'dark'],
  states: ['rest', 'tooltip'],
  scale: [
    {
      scheme: 'light',
      viewport: DESKTOP,
      spacing: { xs: 10, sm: 12 },
      radius: { md: 8, card: 7 },
      fontSizes: { sm: 14 },
    },
    {
      scheme: 'dark',
      viewport: DESKTOP,
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
      viewport: DESKTOP,
      ...measurement,
    },
  ],
  pages: [{ route: '/dashboard', scheme: 'light', viewport: PHONE, overflowX: 12 }],
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
      viewport: PHONE,
      status: 'skipped',
      note: 'touch viewport',
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

// ── fake browser plumbing ──────────────────────────────────────────────────────────────────────

type FactsLike = {
  anchors: string[]
  states: Record<string, string[]>
  absent: Record<string, string[]>
  content: string
  overflowX: number
}
const facts = (over: Partial<FactsLike> = {}): FactsLike => ({
  anchors: [],
  states: {},
  absent: {},
  content: '',
  overflowX: 0,
  ...over,
})
const NO_SCALE = { spacing: {}, radius: {}, fontSizes: {} }

/** `page.evaluate` as the real page answers it: facts for the facts reader, a scale for the scale reader. */
const evaluating =
  (
    read: () => unknown = () => facts(),
    scale: () => unknown = () => NO_SCALE,
    other: (expression: unknown) => unknown = () => undefined,
  ) =>
  (e: unknown, _arg?: unknown): Promise<unknown> => {
    if (e === readFactsInPage) return Promise.resolve().then(read)
    if (typeof e === 'function')
      return Promise.resolve().then(() => (e.name === 'readScaleInPage' ? scale() : undefined))
    return Promise.resolve().then(() => other(e))
  }

const NO_TIP: Record<string, unknown> = {
  first: () => NO_TIP,
  last: () => NO_TIP,
  count: () => Promise.resolve(0),
  waitFor: () => Promise.reject(new Error('no tooltip')),
  boundingBox: () => Promise.resolve(null),
}
/** The anchor locator, or `tip` for any tooltip selector. */
const byTooltip =
  (anchor: unknown, tip: unknown = NO_TIP) =>
  (selector: string) =>
    selector.includes('tooltip') ? tip : anchor

const BOX = { x: 0, y: 0, width: 10, height: 10 }
/** A visible anchor whose every Playwright call succeeds. */
const visibleAnchor = (over: Record<string, unknown> = {}): Record<string, unknown> => {
  const anchor: Record<string, unknown> = {
    first: () => anchor,
    count: () => Promise.resolve(1),
    hover: () => Promise.resolve(),
    boundingBox: () => Promise.resolve(BOX),
    screenshot: () => Promise.resolve(),
    evaluate: () => Promise.resolve(''),
    ...over,
  }
  return anchor
}

const pageOf = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  setDefaultTimeout: () => undefined,
  setViewportSize: () => Promise.resolve(),
  goto: () => Promise.resolve(),
  locator: byTooltip(visibleAnchor()),
  screenshot: () => Promise.resolve(),
  setContent: () => Promise.resolve(),
  mouse: { move: () => Promise.resolve() },
  keyboard: { press: () => Promise.resolve() },
  evaluate: evaluating(),
  ...over,
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

const input = (browser: never, over: Partial<CaptureInput> = {}): CaptureInput => ({
  browser,
  base: 'http://x',
  routes: ['/'],
  viewports: SPECS,
  states: ['rest'],
  pngDir: '/unused',
  log: () => undefined,
  ...over,
})

/** A page with one `card` anchor, for tests that only need the shots to exist. */
const cardPage = (over: Record<string, unknown> = {}) =>
  pageOf({ evaluate: evaluating(() => facts({ anchors: ['card'] })), ...over })

// ── tests ──────────────────────────────────────────────────────────────────────────────────────

describe('withBrowser launch flags', () => {
  test('launches Chrome with the blink pointer settings so desktop contexts hover', async () => {
    const args: string[][] = []
    const pw: Playwright = {
      chromium: {
        launchServer: (options) => {
          args.push(options.args)
          return Promise.resolve({ wsEndpoint: () => 'ws://fake', kill: () => Promise.resolve() })
        },
        connect: () => Promise.resolve({ newContext: () => Promise.reject(new Error('unused')) }),
      },
    }
    await withBrowser(pw, () => Promise.resolve())
    expect(args[0]?.join(' ')).toContain('--blink-settings=primaryHoverType=2')
    expect(args[0]?.join(' ')).toContain('primaryPointerType=4')
  })
})

describe('parseShotArgs', () => {
  const src = () => ({ env: {}, cwd: tmp() })
  test('routes, --dist, --out, defaults', () => {
    const a = parseShotArgs(['/', '/dashboard', '--dist', 'dist', '--out', 'shots-1'], src())
    expect(a.routes).toEqual(['/', '/dashboard'])
    expect(a.out).toBe('shots-1')
    expect(a.states).toEqual(['rest', 'hover', 'focus', 'tooltip', 'empty', 'loading', 'error'])
    expect(a.viewports.map((v) => [v.label, v.mobile])).toEqual([
      [DESKTOP, false],
      [PHONE, true],
    ])
  })
  test('--out is required', () => {
    expect(() => parseShotArgs(['/', '--dist', 'dist'], src())).toThrow(ShotError)
    expect(() => parseShotArgs(['/', '--dist', 'dist'], src())).toThrow(/--out <dir> is required/)
  })
  test('--states keeps canonical order', () => {
    const flags = ['/', '--base', 'http://x/', '--out', 'o']
    expect(parseShotArgs([...flags, '--states', 'focus,rest'], src()).states).toEqual([
      'rest',
      'focus',
    ])
    expect(parseShotArgs(flags, src()).base).toBe('http://x')
  })
  test.each([
    [[], /no route/],
    [['/a'], /exactly one of --base/],
    [['/a', '--base', 'http://x', '--dist', 'd'], /exactly one of --base/],
    [['a', '--dist', 'd'], /must start with '\//],
    [['/a', '--dist', 'd', '--out', 'o', '--states', 'rest,nope'], /unknown state 'nope'/],
    [['/a', '--dist', 'd', '--bogus'], /bogus/],
    [['/a /b', '--dist', 'd'], /separate argument|its own argument/],
  ])('rejects %j', (flags, message) => {
    expect(() => parseShotArgs(flags, src())).toThrow(ShotError)
    expect(() => parseShotArgs(flags, src())).toThrow(message)
  })
  test('the help.ts gate lets shot take routes but still names an unknown flag', () => {
    expect(unknownFlag('shot', ['/', '/dashboard', '--dist', 'd', '--states', 'rest'])).toBeNull()
    expect(unknownFlag('shot', ['/', '--out', 'o'])).toBeNull()
    expect(unknownFlag('shot', ['/', '--bogus'])).toBe('--bogus')
  })

  describe('manifest viewports', () => {
    const withManifest = (viewports: unknown): string => {
      const cwd = tmp()
      mkdirSync(join(cwd, '.basalt'))
      writeFileSync(
        join(cwd, '.basalt/manifest.json'),
        JSON.stringify({ profile: 'app', version: '3.0.0', viewports }),
      )
      return cwd
    }
    test('a desktop-only manifest yields no phone viewport and no failure', () => {
      const cwd = withManifest(['1440x900', '1024x700'])
      const a = parseShotArgs(['/', '--dist', 'd', '--out', 'o'], { env: {}, cwd })
      expect(a.viewports.map((v) => [v.label, v.width, v.height, v.mobile])).toEqual([
        ['1440x900', 1440, 900, false],
        ['1024x700', 1024, 700, false],
      ])
    })
    test('is found from a subdirectory, walking up', () => {
      const cwd = withManifest(['1440x900'])
      mkdirSync(join(cwd, 'apps/web'), { recursive: true })
      expect(manifestViewports(join(cwd, 'apps/web')).map((v) => v.label)).toEqual(['1440x900'])
    })
    test('a manifest declaring none falls back to the defaults', () => {
      expect(manifestViewports(withManifest([])).map((v) => v.label)).toEqual([DESKTOP, PHONE])
    })
    test('a viewport that is not <width>x<height> is a ShotError', () => {
      expect(() => manifestViewports(withManifest(['desktop']))).toThrow(ShotError)
      expect(() => manifestViewports(withManifest(['desktop']))).toThrow(
        /'desktop' is not <width>x<height>/,
      )
    })
    test('parseViewport: under 600 px wide is a phone', () => {
      expect(parseViewport('599x800')?.mobile).toBe(true)
      expect(parseViewport('600x800')?.mobile).toBe(false)
      expect(parseViewport('wide')).toBeNull()
    })
  })
})

describe('planOut', () => {
  test('accepts a directory that does not exist yet, however deep', () => {
    const cwd = tmp()
    for (const out of ['absent', 'a/b/absent', '..shots', '.basalt/shots-2', 'shots-1']) {
      expect(planOut(cwd, out), out).toBe(join(cwd, out))
      expect(existsSync(join(cwd, out)), out).toBe(false)
    }
  })
  test('refuses a directory or file that exists: every round is fresh', () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'src'))
    writeFileSync(join(cwd, 'file'), '')
    for (const out of ['src', 'file']) {
      expect(() => planOut(cwd, out), out).toThrow(ShotError)
      expect(() => planOut(cwd, out), out).toThrow(/exists already/)
    }
    expect(existsSync(join(cwd, 'src'))).toBe(true)
  })
  test('refuses the project root, escapes and protected dirs', () => {
    const cwd = tmp()
    for (const out of ['.', '..', '../elsewhere', '/', '.git', 'a/.git/b', 'node_modules/x']) {
      expect(() => planOut(cwd, out), out).toThrow(ShotError)
    }
  })
  test('names the project dir when --out escapes it', () => {
    const cwd = tmp()
    expect(() => planOut(cwd, '..')).toThrow(
      `inside the project (${cwd}; in a monorepo, the app dir)`,
    )
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
    expect(fileName('/a/b', 'n', 'light', DESKTOP, 'rest')).not.toBe(
      fileName('/a-b', 'n', 'light', DESKTOP, 'rest'),
    )
    expect(fileName('/', 'x y', 'light', DESKTOP, 'rest')).not.toBe(
      fileName('/', 'x-y', 'light', DESKTOP, 'rest'),
    )
    expect(fileName('/a', 'n', 'dark', PHONE, 'hover')).toMatch(
      /^a-[0-9a-f]{6}__n-[0-9a-f]{6}__dark__390x844__hover\.png$/,
    )
  })
})

describe('capture() with a fake browser', () => {
  const browserWith = (scale: () => unknown) =>
    scriptedBrowser(pageOf({ evaluate: evaluating(() => facts({ anchors: ['card'] }), scale) }))

  test('a throwing measurer keeps the PNG ok and notes the failure separately', async () => {
    const out = await capture(
      input(
        browserWith(() => NO_SCALE),
        { measure: () => Promise.reject(new Error('canvas gone\nstack')) },
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
        browserWith(() => {
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

  test('records ok, skipped and not-declared per anchor, state and viewport', async () => {
    const page = pageOf({
      evaluate: evaluating(() =>
        facts({ anchors: ['card', 'plain'], states: { card: ['empty'], plain: [] } }),
      ),
    })
    const out = await capture(
      input(scriptedBrowser(page), {
        states: ['rest', 'hover', 'empty'],
        measure: () => Promise.resolve(measurement),
      }),
    )
    const at = (name: string, state: string, viewport: string) => [
      ...new Set(
        out.shots
          .filter((s) => s.name === name && s.state === state && s.viewport === viewport)
          .map((s) => s.status),
      ),
    ]
    expect(at('_page', 'rest', DESKTOP)).toEqual(['ok'])
    expect(at('card', 'rest', PHONE)).toEqual(['ok'])
    expect(at('card', 'hover', DESKTOP)).toEqual(['ok'])
    expect(at('card', 'hover', PHONE)).toEqual(['skipped'])
    expect(at('card', 'empty', DESKTOP)).toEqual(['ok'])
    expect(at('plain', 'empty', DESKTOP)).toEqual(['not-declared'])
    const plain = out.shots.find((s) => s.name === 'plain' && s.state === 'empty')
    expect(plain).toMatchObject({ file: null, note: 'anchor does not declare this state' })
    expect(out.shots.every((s) => s.ignored === undefined)).toBe(true)
  })

  test('a state shot byte-equal to the same anchor’s rest shot is `ignored`; a different one is not', async () => {
    const dir = tmp()
    const writing = (empty: string) =>
      visibleAnchor({
        screenshot: (o: { path: string }) => {
          writeFileSync(o.path, o.path.includes('__empty') ? empty : 'rest-bytes')
          return Promise.resolve()
        },
      })
    const run = async (empty: string) =>
      capture(
        input(
          scriptedBrowser(
            pageOf({
              locator: byTooltip(writing(empty)),
              evaluate: evaluating(() => facts({ anchors: ['card'], states: { card: ['empty'] } })),
            }),
          ),
          {
            states: ['rest', 'empty'],
            pngDir: dir,
            viewports: specs(DESKTOP),
            measure: () => Promise.resolve(measurement),
          },
        ),
      )
    const same = await run('rest-bytes')
    const shots = same.shots.filter((s) => s.name === 'card' && s.state === 'empty')
    expect(shots.length).toBeGreaterThan(0)
    expect(shots.every((s) => s.status === 'ok' && s.ignored === true)).toBe(true)
    expect(same.shots.some((s) => s.state === 'rest' && s.ignored)).toBe(false)
    const different = await run('empty-bytes')
    expect(different.shots.some((s) => s.ignored)).toBe(false)
  })

  test('a page wider than its viewport is recorded per scheme × viewport', async () => {
    const out = await capture(
      input(scriptedBrowser(pageOf({ evaluate: evaluating(() => facts({ overflowX: 12 })) }))),
    )
    expect(out.pages).toHaveLength(4)
    expect(out.pages?.every((p) => p.overflowX === 12 && p.route === '/')).toBe(true)
    expect(out.pages?.map((p) => `${p.scheme}/${p.viewport}`).toSorted()).toEqual([
      `dark/${DESKTOP}`,
      `dark/${PHONE}`,
      `light/${DESKTOP}`,
      `light/${PHONE}`,
    ])
  })

  test('a desktop-only viewport list records no phone shot, no skip and no failure', async () => {
    const out = await capture(
      input(scriptedBrowser(cardPage()), {
        viewports: specs('1440x900'),
        states: ['rest', 'hover', 'tooltip'],
        measure: () => Promise.resolve(measurement),
      }),
    )
    expect(out.shots.length).toBeGreaterThan(0)
    expect(out.shots.every((s) => s.viewport === '1440x900')).toBe(true)
    expect(out.shots.some((s) => s.status === 'skipped' || s.status === 'error')).toBe(false)
    expect(out.pages?.every((p) => p.viewport === '1440x900')).toBe(true)
  })
})

describe('focus state', () => {
  const pageWith = (focusable: boolean, countFails = false) => {
    const anchor = visibleAnchor({
      count: () => (countFails ? Promise.reject(new Error('locator died')) : Promise.resolve(1)),
      evaluate: () =>
        countFails ? Promise.reject(new Error('locator died')) : Promise.resolve(focusable),
    })
    return scriptedBrowser(
      pageOf({
        locator: byTooltip(anchor),
        evaluate: evaluating(
          () => facts({ anchors: ['card'] }),
          () => NO_SCALE,
          // The Tab loop lands immediately.
          (e) => (String(e).includes('activeElement') ? true : undefined),
        ),
      }),
    )
  }
  const run = (focusable: boolean, countFails = false) =>
    capture(
      input(pageWith(focusable, countFails), {
        states: ['focus'],
        measure: () => Promise.resolve(measurement),
      }),
    )
  const focus = (out: Awaited<ReturnType<typeof run>>) =>
    out.shots.filter((s) => s.name === 'card' && s.state === 'focus')

  test('an anchor nothing in it Tab reaches records not-declared, never error', async () => {
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

describe('scaleError', () => {
  const read = NO_SCALE
  const run = (scale: () => unknown, log: string[] = []) =>
    capture(
      input(
        scriptedBrowser(
          pageOf({ evaluate: evaluating(() => facts({ anchors: ['card'] }), scale) }),
        ),
        { log: (l) => log.push(l), measure: () => Promise.resolve(measurement) },
      ),
    )

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
  test('the scale is read on every page and carries its route', async () => {
    const out = await capture(
      input(scriptedBrowser(pageOf({ evaluate: evaluating(() => facts({ anchors: ['card'] })) })), {
        routes: ['/a', '/b'],
        measure: () => Promise.resolve(measurement),
      }),
    )
    expect(out.scale).toHaveLength(8)
    expect(out.scale.filter((s) => s.route === '/a' && s.viewport === PHONE)).toHaveLength(2)
    expect(out.scale.filter((s) => s.route === '/b' && s.scheme === 'dark')).toHaveLength(2)
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

describe('hover, focus and tooltip crops', () => {
  const ANCHOR = { x: 100, y: 100, width: 200, height: 60 }
  const TIP = { x: 120, y: 170, width: 180, height: 40 }
  /** An anchor whose hover (or focus) opens a tooltip when `tooltip`; `trigger` adds a `[data-shot-tooltip]` inside it. */
  const rig = (opts: { tooltip: boolean; trigger?: boolean }) => {
    const clips: unknown[] = []
    let open = false
    const anchor = visibleAnchor({
      hover: () => {
        open = opts.tooltip
        return Promise.resolve()
      },
      screenshot: () => {
        clips.push('element')
        return Promise.resolve()
      },
      boundingBox: () => Promise.resolve(ANCHOR),
      evaluate: () => Promise.resolve(true),
    })
    const marked: Record<string, unknown> = {
      ...anchor,
      first: () => marked,
      count: () => Promise.resolve(opts.trigger ? 1 : 0),
    }
    const tip: Record<string, unknown> = {
      first: () => tip,
      last: () => tip,
      count: () => Promise.resolve(open ? 1 : 0),
      waitFor: () => (open ? Promise.resolve() : Promise.reject(new Error('timeout'))),
      boundingBox: () => Promise.resolve(TIP),
    }
    const page = pageOf({
      locator: (selector: string) =>
        selector.includes('data-shot-tooltip')
          ? marked
          : selector.includes('role="tooltip"')
            ? tip
            : anchor,
      screenshot: (o: { clip?: unknown }) => {
        clips.push(o.clip)
        return Promise.resolve()
      },
      mouse: {
        move: () => {
          open = false
          return Promise.resolve()
        },
      },
      evaluate: evaluating(
        () => facts({ anchors: ['card'] }),
        () => NO_SCALE,
        (e) => {
          // The Tab loop lands at once, with the tooltip its focus opens.
          if (String(e).includes(':focus-visible')) open = opts.tooltip
          return String(e).includes('activeElement') ? true : undefined
        },
      ),
    })
    const run = async (state: 'hover' | 'focus' | 'tooltip') => {
      const out = await capture(
        input(scriptedBrowser(page), {
          states: [state],
          measure: () => Promise.resolve(measurement),
        }),
      )
      return { clips, out }
    }
    return run
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
    const { clips } = await rig({ tooltip: true })('focus')
    expect(clips.length).toBeGreaterThan(0)
    expect(clips.every(covers)).toBe(true)
  })
  test('a hover crop grows to hold the tooltip instead of cropping the anchor alone', async () => {
    const { clips } = await rig({ tooltip: true })('hover')
    expect(clips.length).toBeGreaterThan(0)
    expect(clips.every(covers)).toBe(true)
  })
  test('with no tooltip a focus crop is the anchor alone and a hover crop the element', async () => {
    expect((await rig({ tooltip: false })('focus')).clips.every((c) => !covers(c))).toBe(true)
    expect((await rig({ tooltip: false })('hover')).clips.every((c) => c === 'element')).toBe(true)
  })
  test('a tooltip state with no [data-shot-tooltip] trigger is not-declared', async () => {
    const { out } = await rig({ tooltip: true, trigger: false })('tooltip')
    const shots = out.shots.filter((s) => s.name === 'card' && s.state === 'tooltip')
    expect(
      shots.filter((s) => s.viewport === DESKTOP).every((s) => s.status === 'not-declared'),
    ).toBe(true)
    expect(shots.filter((s) => s.viewport === PHONE).every((s) => s.status === 'skipped')).toBe(
      true,
    )
  })
  test('a tooltip state whose trigger shows no tooltip is an error', async () => {
    const { out } = await rig({ tooltip: false, trigger: true })('tooltip')
    const desktop = out.shots.filter(
      (s) => s.name === 'card' && s.state === 'tooltip' && s.viewport === DESKTOP,
    )
    expect(desktop.length).toBeGreaterThan(0)
    expect(
      desktop.every(
        (s) => s.status === 'error' && /no visible \[role="tooltip"\]/.test(s.note ?? ''),
      ),
    ).toBe(true)
  })
  test('a tooltip state with a trigger and a tooltip is captured', async () => {
    const { out } = await rig({ tooltip: true, trigger: true })('tooltip')
    const desktop = out.shots.filter((s) => s.name === 'card' && s.viewport === DESKTOP)
    expect(desktop.every((s) => s.status === 'ok')).toBe(true)
  })
})

describe('contact sheets', () => {
  test('buildSheet lays every state × scheme × viewport of one anchor on one page', () => {
    const html = buildSheet('/dashboard', 'stat-card', {
      viewports: [DESKTOP, PHONE],
      states: ['rest', 'hover'],
      shots: [record({ file: 'data:image/png;base64,AAAA' }), record({ state: 'hover' })],
    })
    expect(html).toContain('stat-card')
    expect(html).toContain('/dashboard')
    expect(html).toContain(`light · ${DESKTOP}`)
    expect(html).toContain(`dark · ${PHONE}`)
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).not.toContain('loading="lazy"')
  })
  test('one sheet per anchor is written and listed on the anchor', async () => {
    const dir = tmp()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    )
    const write = (o: { path: string }) => {
      writeFileSync(o.path, png)
      return Promise.resolve()
    }
    let html = ''
    const page = cardPage({
      locator: byTooltip(visibleAnchor({ screenshot: write })),
      screenshot: write,
      setContent: (h: string) => {
        html = h
        return Promise.resolve()
      },
    })
    const out = await capture(
      input(scriptedBrowser(page), {
        pngDir: dir,
        measure: () => Promise.resolve(measurement),
      }),
    )
    const file = `png/${sheetName('/', 'card')}`
    expect(out.anchors.every((a) => a.sheet === file)).toBe(true)
    expect(existsSync(join(dir, sheetName('/', 'card')))).toBe(true)
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('loading="lazy"')
  })
  test('a sheet that cannot be written is logged and left unlisted', async () => {
    const log: string[] = []
    const out = await capture(
      input(
        scriptedBrowser(cardPage({ setContent: () => Promise.reject(new Error('no content')) })),
        { pngDir: tmp(), log: (l) => log.push(l), measure: () => Promise.resolve(measurement) },
      ),
    )
    expect(out.anchors.some((a) => a.sheet !== undefined)).toBe(false)
    expect(log.some((l) => /sheet not written/.test(l))).toBe(true)
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
  test('hands this run’s kill to `stops`', async () => {
    const stops: (() => unknown)[] = []
    await withBrowser(fakePw([]), () => Promise.resolve(1), { stops })
    expect(stops).toHaveLength(1)
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
  const FLAGS = ['/', '--base', 'http://x', '--out', 'shots-1']

  test('missing Playwright prints the install line and exits 1', async () => {
    const { result, lines } = await errors(() => shot(FLAGS, tmp(), { resolve: () => null }))
    expect(result).toBe(1)
    expect(lines).toEqual([INSTALL_LINE])
    expect(INSTALL_LINE).toBe(
      'basalt-ui shot needs Playwright: bun add -d playwright && bunx playwright install chromium',
    )
  })

  test('without --out it exits 1 saying so', async () => {
    const { result, lines } = await errors(() =>
      shot(['/', '--base', 'http://x'], tmp(), { resolve: () => fakePw([]) }),
    )
    expect(result).toBe(1)
    expect(lines.join()).toMatch(/--out <dir> is required/)
  })

  test('a failed launch exits 1 with the install line and leaves no out dir behind', async () => {
    const cwd = tmp()
    const { result, lines } = await errors(() =>
      shot(FLAGS, cwd, { resolve: () => fakePw([undefined, 'chrome']) }),
    )
    expect(result).toBe(1)
    expect(lines[0]?.split('\n')[0]).toBe(INSTALL_LINE)
    expect(existsSync(join(cwd, 'shots-1'))).toBe(false)
    expect(existsSync(join(cwd, '.basalt/last-shot.json'))).toBe(false)
  })

  test('a capture that fails removes the out dir it made', async () => {
    const cwd = tmp()
    const { result, lines } = await errors(() =>
      shot(FLAGS, cwd, {
        resolve: () => fakePw([]),
        log: () => undefined,
        capture: () => Promise.reject(new ShotError('boom')),
      }),
    )
    expect(result).toBe(1)
    expect(lines).toEqual(['boom'])
    expect(existsSync(join(cwd, 'shots-1'))).toBe(false)
  })

  test('--out of an existing dir is refused before anything is launched or deleted', async () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'src'))
    writeFileSync(join(cwd, 'src/keep.ts'), 'x')
    const log: string[] = []
    const { result, lines } = await errors(() =>
      shot(['/', '--base', 'http://x', '--out', 'src'], cwd, { resolve: () => fakePw([], log) }),
    )
    expect(result).toBe(1)
    expect(lines.join()).toMatch(/--out src exists already/)
    expect(log).toEqual([])
    expect(existsSync(join(cwd, 'src/keep.ts'))).toBe(true)
  })

  const run = (cwd: string, shots: ShotRecord[], logs: string[] = [], out = 'shots-1') =>
    shot(['/dashboard', '--base', 'http://127.0.0.1:1', '--out', out], cwd, {
      resolve: () => fakePw([]),
      now: () => new Date('2026-10-16T00:00:00.000Z'),
      log: (l) => void logs.push(l),
      capture: ({ pngDir }) => {
        writeFileSync(join(pngDir, 'a.png'), '')
        return Promise.resolve({
          anchors: fakeMetrics().anchors,
          shots,
          scale: fakeMetrics().scale,
          pages: fakeMetrics().pages ?? [],
        })
      },
    })

  test('writes metrics.json, board.html, last-shot.json and .gitignore; exits 1 when a shot errored', async () => {
    const cwd = tmp()
    const logs: string[] = []
    const { result, lines } = await errors(() => run(cwd, fakeMetrics().shots, logs))
    expect(result).toBe(1)
    expect(lines).toEqual(['basalt-ui shot: 1 shot(s) failed; see board.html'])
    const out = join(cwd, 'shots-1')
    const written = JSON.parse(readFileSync(join(out, 'metrics.json'), 'utf8')) as ShotMetrics
    expect(written).toMatchObject({
      version: 1,
      generatedAt: '2026-10-16T00:00:00.000Z',
      base: 'http://127.0.0.1:1',
      routes: ['/dashboard'],
      viewports: [DESKTOP, PHONE],
      schemes: ['light', 'dark'],
      pages: [{ route: '/dashboard', scheme: 'light', viewport: PHONE, overflowX: 12 }],
    })
    expect(written.shots).toHaveLength(5)
    expect(existsSync(join(out, 'png/a.png'))).toBe(true)
    expect(readFileSync(join(out, 'board.html'), 'utf8')).toContain('stat-card')
    expect(readFileSync(join(out, '.gitignore'), 'utf8')).toBe('*\n')
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/last-shot.json'), 'utf8'))).toEqual({
      out: 'shots-1',
      round: 1,
    })
    expect(logs.join('\n')).toContain('2 shots')
    expect(logs.join('\n')).toContain('1 not declared, 1 skipped, 1 failed')
  })

  test('each successful round bumps the round and points last-shot.json at its dir', async () => {
    const cwd = tmp()
    const ok = fakeMetrics().shots.filter((s) => s.status === 'ok')
    expect(await run(cwd, ok, [], 'shots-1')).toBe(0)
    expect(await run(cwd, ok, [], 'shots-2')).toBe(0)
    expect(await run(cwd, ok, [], '.basalt/shots-3')).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/last-shot.json'), 'utf8'))).toEqual({
      out: '.basalt/shots-3',
      round: 3,
    })
    // The previous rounds stay: nothing is swapped or emptied.
    expect(existsSync(join(cwd, 'shots-1/metrics.json'))).toBe(true)
    expect(readFileSync(join(cwd, 'shots-2/.gitignore'), 'utf8')).toBe('*\n')
    // A dir already used is refused, not overwritten.
    expect((await errors(() => run(cwd, ok, [], 'shots-1'))).result).toBe(1)
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

  test('a desktop-only manifest reaches capture as desktop viewports only and exits 0', async () => {
    const cwd = tmp()
    mkdirSync(join(cwd, '.basalt'))
    writeFileSync(
      join(cwd, '.basalt/manifest.json'),
      JSON.stringify({ profile: 'app', version: '3.0.0', viewports: ['1440x900', '1024x700'] }),
    )
    const seen: ViewportSpec[][] = []
    const code = await shot(['/', '--base', 'http://x', '--out', 'shots-1'], cwd, {
      resolve: () => fakePw([]),
      log: () => undefined,
      capture: ({ viewports }) => {
        seen.push([...viewports])
        return Promise.resolve({
          anchors: [],
          scale: [],
          shots: viewports.map((v) => record({ viewport: v.label, file: 'png/a.png' })),
        })
      },
    })
    expect(code).toBe(0)
    expect(seen[0]?.map((v) => [v.label, v.mobile])).toEqual([
      ['1440x900', false],
      ['1024x700', false],
    ])
    const written = JSON.parse(
      readFileSync(join(cwd, 'shots-1/metrics.json'), 'utf8'),
    ) as ShotMetrics
    expect(written.viewports).toEqual(['1440x900', '1024x700'])
    expect(written.shots.some((s) => parseViewport(s.viewport)?.mobile)).toBe(false)
  })
})

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
    expect(html).toContain('empty skipped">skipped: touch viewport')
    expect(html).toContain('anchor only present in this state')
  })
  test('a state shot that ignored the state says so', () => {
    const m = fakeMetrics()
    m.shots = [record({ state: 'rest', file: 'png/a.png', ignored: true })]
    expect(buildBoard(m)).toContain('ignored the state')
    expect(html).not.toContain('ignored the state')
  })
  test('one text line per anchor, scale on one line, nothing of the old tables', () => {
    expect(html).toContain(`light/${DESKTOP} 300×120 · radius 8 · font 12, 24 · empty 0.25`)
    expect(html).toContain('scale: spacing 10 12 · radius 8 7 · font 14')
    expect(html.match(/scale: spacing/g)).toHaveLength(1)
    expect(html).not.toContain('<table')
    expect(html).not.toContain('backdrop')
    expect(html).not.toContain('contrast')
  })
  test('a page wider than the viewport is a line on its route', () => {
    expect(html).toContain(`light/${PHONE}: document 12px wider than the viewport`)
    const m = fakeMetrics()
    m.pages = []
    expect(buildBoard(m)).not.toContain('wider than the viewport')
  })
  test('a scale that could not be read is a line, not a silent gap', () => {
    const m = fakeMetrics()
    m.scale = []
    m.scaleError = 'no probe'
    const out = buildBoard(m)
    expect(out).toContain('scale unavailable: no probe')
    expect(out).not.toContain('scale: spacing')
  })
  test('escapes notes and names', () => {
    const m = fakeMetrics()
    m.shots = [record({ status: 'error', note: 'Muted <b> & "q"' })]
    const out = buildBoard(m)
    expect(out).toContain('Muted &#60;b&#62; &#38; &#34;q&#34;')
    expect(out).not.toContain('Muted <b>')
  })
  test('a full-round radius renders as "full" on the anchor line', () => {
    const m = fakeMetrics()
    const [anchor] = m.anchors
    if (!anchor) throw new Error('fixture has no anchor')
    m.anchors = [{ ...anchor, radius: 'full' }]
    expect(buildBoard(m)).toContain('radius full')
  })
  test('a route without anchors says so', () => {
    const m = fakeMetrics()
    m.anchors = []
    m.shots = m.shots.filter((s) => s.name === '_page')
    expect(buildBoard(m)).toContain('no anchors on this route')
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
  test('finishMeasurement reports it on the anchor and on nested boxes, and keeps small and overlaps', () => {
    const { radius: _, nested: __, ...tail } = measurement
    const out = finishMeasurement({
      ...tail,
      small: ['button 20x20'],
      overlaps: ['a × b'],
      radius: { value: '50%', ...box },
      nested: [
        {
          path: 'span',
          radius: { value: '6px', width: 100, height: 40 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      ],
    })
    expect(out.radius).toBe('full')
    expect(out.nested[0]?.radius).toBe(6)
    expect(out.small).toEqual(['button 20x20'])
    expect(out.overlaps).toEqual(['a × b'])
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
        specs(PHONE)[0] as ViewportSpec,
      ),
    ).toEqual({
      x: 0,
      y: 2,
      width: 158,
      height: 146,
    })
  })
  test('unionClip reports a box below the live page height as empty, never a sliver', () => {
    expect(
      unionClip(
        [{ x: 10, y: 900, width: 50, height: 40 }],
        8,
        specs(PHONE)[0] as ViewportSpec,
        600,
      ),
    ).toBeNull()
  })
})

describe('snapClip', () => {
  const out = { x: 10, y: 900, width: 50, height: 40 }
  const rig = (reads: (typeof out | null)[]) => {
    const shots: unknown[] = []
    const locator = { boundingBox: async () => reads.shift() ?? null }
    const page = {
      evaluate: async () => 600,
      screenshot: async (o: unknown) => void shots.push(o),
    }
    const c = { page, spec: specs(PHONE)[0] } as unknown as Parameters<typeof snapClip>[0]
    return { shots, run: () => snapClip(c, 'x.png', [locator as never]) }
  }
  const inside = { x: 10, y: 100, width: 50, height: 40 }

  test('an out-of-viewport box is re-measured after a frame and snapped once in view', async () => {
    const { shots, run } = rig([out, inside])
    await run()
    expect(shots).toHaveLength(1)
    expect(shots[0]).toMatchObject({ clip: { x: 2, y: 92, width: 66, height: 56 } })
  })
  test('a box that stays out of the viewport throws and never snaps', async () => {
    const { shots, run } = rig([out, out])
    await expect(run()).rejects.toThrow(/Clipped area/)
    expect(shots).toHaveLength(0)
  })
})

describe('real-app flags', () => {
  const src = { env: { TOKEN: 's3cret-token', EMPTY: '' }, cwd: '/nowhere' }
  const parse = (...extra: string[]) =>
    parseShotArgs(['/', '--dist', 'd', '--out', 'o', ...extra], src)

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
      [
        '/',
        '--dist',
        'd',
        '--out',
        'o',
        '--local-storage',
        'b=@env:TOKEN',
        '--local-storage',
        'c=@file:tok',
      ],
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
    const flags = [
      '/',
      '--dist',
      'd',
      '--out',
      'o',
      '--api',
      '/a=https://x',
      '--header',
      'x-key=@env:T',
    ]
    expect(() => parseShotArgs(flags, bad)).toThrow(/--header x-key: value has characters/)
    expect(() => parseShotArgs(flags, bad)).not.toThrow(/evil/)
  })
  test('--api needs --dist', () => {
    expect(() =>
      parseShotArgs(['/', '--base', 'http://x', '--out', 'o', '--api', '/a=https://x'], src),
    ).toThrow(/--api needs --dist/)
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
  const fakeEl =
    (tagged: Record<string, string>) => (name: string, width: number, height: number) => ({
      getBoundingClientRect: () => ({ width, height }),
      setAttribute: (_: string, value: string) => void (tagged[name] = value),
    })
  const withDocument = (querySelectorAll: (selector: string) => unknown[]): void => {
    const g = globalThis as { document?: unknown }
    const saved = g.document
    g.document = { querySelectorAll }
    try {
      tagAutoAnchors()
    } finally {
      g.document = saved
    }
  }

  test('tagAutoAnchors numbers every match and tags only those over 120×60', () => {
    const tagged: Record<string, string> = {}
    const el = fakeEl(tagged)
    const els = [
      el('small', 100, 200),
      el('card', 300, 100),
      el('flat', 300, 60),
      el('table', 500, 400),
    ]
    const asked: string[] = []
    withDocument((selector) => {
      asked.push(selector)
      return els
    })
    expect(tagged).toEqual({ card: 'auto-02', table: 'auto-04' })
    expect(asked).toEqual(['[data-slot="card"], table'])
  })

  test('tagAutoAnchors falls back to main/section/header/form when no card or table qualifies', () => {
    const tagged: Record<string, string> = {}
    const el = fakeEl(tagged)
    withDocument((selector) =>
      selector.includes('data-slot="card"')
        ? [el('tiny-card', 50, 50)]
        : [el('main', 800, 600), el('header', 800, 40), el('form', 400, 300)],
    )
    expect(tagged).toEqual({ main: 'auto-01', form: 'auto-03' })
  })
})

describe('data trust in capture', () => {
  test('a 401/403 or unanswered proxied call turns the page shot into an error', async () => {
    const logs: string[] = []
    const out = await capture(
      input(scriptedBrowser(pageOf()), {
        apiProblems: () => ['GET /api/kpi 401'],
        log: (l: string) => void logs.push(l),
      }),
    )
    const pages = out.shots.filter((s) => s.name === '_page')
    expect(pages).toHaveLength(4)
    expect(pages.every((s) => s.status === 'error' && s.note === 'GET /api/kpi 401')).toBe(true)
    expect(logs.join('\n')).toContain('GET /api/kpi 401')
  })

  const textPage = (textOf: (url: string) => string) => {
    let url = ''
    return pageOf({
      goto: (u: string) => {
        url = u
        return Promise.resolve()
      },
      evaluate: evaluating(() => facts({ content: textOf(url) })),
    })
  }

  test('warns when every route renders the same content', async () => {
    const logs: string[] = []
    await capture(
      input(scriptedBrowser(textPage(() => 'Enter PIN')), {
        routes: ['/a', '/b'],
        log: (l: string) => void logs.push(l),
      }),
    )
    expect(logs.join('\n')).toContain('every route rendered the same content')
    expect(logs.join('\n')).toContain('--api')
  })

  test('stays quiet when routes differ, or when there is only one', async () => {
    const logs: string[] = []
    const log = (l: string) => void logs.push(l)
    await capture(input(scriptedBrowser(textPage((u) => u)), { routes: ['/a', '/b'], log }))
    await capture(input(scriptedBrowser(textPage(() => 'same')), { routes: ['/a'], log }))
    expect(logs.join('\n')).not.toContain('same content')
  })

  test('a failed localStorage seed is logged by key and fails the page', async () => {
    const logs: string[] = []
    const page = pageOf({
      evaluate: evaluating(
        () => facts(),
        () => NO_SCALE,
        (e) => (String(e).includes('__shotSeedFailed') ? 'auth' : undefined),
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
  const problemPage = (hooks: {
    goto?: (url: string) => void
    hover?: () => void
    shot?: (url: string) => void
  }) => {
    let url = ''
    const anchor = visibleAnchor({
      hover: () => Promise.resolve(hooks.hover?.()),
      boundingBox: () => Promise.resolve(null),
    })
    return pageOf({
      goto: (to: string) => {
        url = to
        return Promise.resolve(hooks.goto?.(to))
      },
      locator: byTooltip(anchor),
      screenshot: () => Promise.resolve(hooks.shot?.(url)),
      evaluate: evaluating(() => facts({ anchors: ['card'] })),
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
      input(scriptedBrowser(problemPage({ hover: () => q.push('GET /api +1 401') })), {
        states: ['rest', 'hover'],
        apiProblems: q.drain,
      }),
    )
    const desktop = out.shots.filter((s) => s.viewport === DESKTOP && s.scheme === 'light')
    expect(desktop.map((s) => [s.name, s.state, s.status]).toSorted()).toEqual([
      ['_page', 'rest', 'error'],
      ['card', 'hover', 'error'],
      ['card', 'rest', 'error'],
    ])
    expect(desktop.every((s) => s.note === 'GET /api +1 401')).toBe(true)
    // The phone skips hover, so its page visit never sees the 401: scoped per visit, it stays ok.
    expect(
      out.shots.filter((s) => s.viewport === PHONE && s.state === 'rest').map((s) => s.status),
    ).toEqual(Array(4).fill('ok'))
  })

  test('a 401 queued during route A fails A only; route B is clean', async () => {
    const q = queue()
    const out = await capture(
      input(
        scriptedBrowser(
          problemPage({ shot: (url) => url.endsWith('/a') && q.push('GET /api +1 401') }),
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
    const out = await capture(input(scriptedBrowser(problemPage({})), { apiProblems: q.drain }))
    expect(out.shots.every((s) => s.status === 'ok')).toBe(true)
  })

  test('leaving the app origin is reported as not seeded, not as a failed seed', async () => {
    const logs: string[] = []
    const page = pageOf({
      evaluate: evaluating(
        () => facts(),
        () => NO_SCALE,
        (e) => (String(e).includes('__shotSeedFailed') ? 'origin' : undefined),
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
    let tagged = false
    let tags = 0
    const page = pageOf({
      goto: () => {
        tagged = false
        return Promise.resolve()
      },
      evaluate: (e: unknown, arg?: unknown) => {
        if (typeof e === 'function' && e.name === 'tagAutoAnchors') {
          tags++
          tagged = true
          return Promise.resolve(undefined)
        }
        return evaluating(() =>
          tagged ? facts({ anchors: ['auto-01'], states: { 'auto-01': ['empty'] } }) : facts(),
        )(e, arg)
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
            'shots-1',
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
            capture: (args) => {
              seen.push(args)
              writeFileSync(join(args.pngDir, 'a.png'), '')
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
    const page = pageOf({
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
            'shots-1',
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
      expect(existsSync(join(cwd, 'shots-1/board.html'))).toBe(true)
      expect(existsSync(join(cwd, 'shots-1/metrics.json'))).toBe(true)
      expect(written).not.toMatch(/bearer-91bd/)
    } finally {
      delete process.env['SHOT_TEST_TOKEN']
      delete process.env['SHOT_TEST_BEARER']
    }
  })

  test('openContext seeds the scheme and localStorage through init scripts', async () => {
    const scripts: string[] = []
    const options: { isMobile: boolean; hasTouch: boolean; colorScheme: string }[] = []
    const browser = {
      newContext: (o: (typeof options)[number]) => {
        options.push(o)
        return Promise.resolve({ addInitScript: (s: string) => void scripts.push(s) })
      },
    }
    const [desktop, phone] = SPECS as [ViewportSpec, ViewportSpec]
    await openContext(browser as never, 'dark', desktop, [['auth', 'a"b']], 'http://app')
    expect(scripts).toHaveLength(2)
    expect(scripts[0]).toContain("setItem('basalt:scheme','dark')")
    expect(scripts[0]).toContain("setAttribute('data-theme','dark')")
    expect(scripts[0]).not.toContain('mantine')
    expect(scripts[1]).toBe(seedScript([['auth', 'a"b']], 'http://app'))
    expect(scripts[1]).toContain('location.origin!=="http://app"')
    await openContext(browser as never, 'light', phone)
    expect(options.map((o) => [o.isMobile, o.hasTouch, o.colorScheme])).toEqual([
      [false, false, 'dark'],
      [true, true, 'light'],
    ])
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
    const page = pageOf({
      goto: (u: string) => {
        url = u
        return Promise.resolve()
      },
      evaluate: evaluating(() =>
        url.includes('shot-state=')
          ? facts()
          : facts({
              anchors: ['chart', 'table'],
              states: { chart: ['empty'], table: ['empty'] },
              absent: { chart: ['empty', 'error'] },
            }),
      ),
    })
    const out = await capture(input(scriptedBrowser(page), { states: ['empty'] }))
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
  test('a route where no anchor declares a state says so on every anchor', async () => {
    const page = pageOf({ evaluate: evaluating(() => facts({ anchors: ['chart'] })) })
    const out = await capture(input(scriptedBrowser(page), { states: ['empty', 'loading'] }))
    expect(out.shots).toHaveLength(8)
    expect(out.shots.every((s) => s.status === 'not-declared' && s.note === NO_STATES_NOTE)).toBe(
      true,
    )
  })
  test('the board labels an absent cell and the summary counts it', () => {
    const html = buildBoard({
      ...fakeMetrics(),
      shots: [
        record({
          name: 'chart',
          state: 'tooltip',
          status: 'absent',
          note: 'declared absent in this state',
        }),
      ],
    })
    expect(html).toContain('empty absent">absent: declared absent in this state')
  })
  test('a run with only absent and ok shots exits 0 and reports the count', async () => {
    const logs: string[] = []
    const cwd = tmp()
    const code = await shot(['/', '--base', 'http://x', '--out', 'shots-1'], cwd, {
      resolve: () => fakePw([]),
      now: () => new Date('2026-10-16T00:00:00.000Z'),
      log: (l) => void logs.push(l),
      capture: () =>
        Promise.resolve({
          anchors: [],
          scale: [],
          shots: [
            record({ route: '/', name: 'a', file: 'png/a.png' }),
            record({ route: '/', name: 'a', state: 'empty', status: 'absent' }),
          ],
        }),
    })
    expect(code).toBe(0)
    expect(logs.join('\n')).toContain('1 absent')
  })
})
