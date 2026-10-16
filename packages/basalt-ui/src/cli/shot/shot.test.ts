import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildBoard } from './board'
import { unionClip } from './capture'
import { shot, parseShotArgs, prepareOut } from './index'
import { contrastRatio, contrastThreshold, finishMeasurement } from './measure'
import { INSTALL_LINE, ShotError } from './playwright'
import type { Playwright } from './playwright'
import type { Measurement, ShotMetrics } from './types'

const dirs: string[] = []
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'shot-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

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
  },
}

const fakeMetrics = (): ShotMetrics => ({
  version: 1,
  generatedAt: '2026-10-16T00:00:00.000Z',
  base: 'http://127.0.0.1:1',
  routes: ['/dashboard'],
  viewports: ['desktop', 'mobile'],
  schemes: ['light', 'dark'],
  states: ['rest', 'tooltip'],
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
    {
      route: '/dashboard',
      name: '_page',
      scheme: 'light',
      viewport: 'desktop',
      state: 'rest',
      file: 'png/p.png',
      status: 'ok',
    },
    {
      route: '/dashboard',
      name: 'stat-card',
      scheme: 'light',
      viewport: 'desktop',
      state: 'rest',
      file: 'png/a.png',
      status: 'ok',
    },
    {
      route: '/dashboard',
      name: 'stat-card',
      scheme: 'light',
      viewport: 'desktop',
      state: 'tooltip',
      file: null,
      status: 'not-declared',
      note: 'no [data-shot-tooltip] in the anchor',
    },
    {
      route: '/dashboard',
      name: 'stat-card',
      scheme: 'dark',
      viewport: 'desktop',
      state: 'rest',
      file: null,
      status: 'error',
      note: 'anchor not found',
    },
  ],
})

describe('parseShotArgs', () => {
  test('routes, --dist, defaults', () => {
    const a = parseShotArgs(['/', '/dashboard', '--dist', 'dist'])
    expect(a.routes).toEqual(['/', '/dashboard'])
    expect(a.out).toBe('.basalt/shots')
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
    [['/a', '--base', 'u', '--dist', 'd'], /exactly one of --base/],
    [['a', '--dist', 'd'], /must start with '\//],
    [['/a', '--dist', 'd', '--states', 'rest,nope'], /unknown state 'nope'/],
    [['/a', '--dist', 'd', '--bogus'], /bogus/],
  ])('rejects %j', (flags, message) => {
    expect(() => parseShotArgs(flags)).toThrow(ShotError)
    expect(() => parseShotArgs(flags)).toThrow(message)
  })
})

describe('shot()', () => {
  test('missing Playwright prints the install line and exits 1', async () => {
    const lines: string[] = []
    const orig = console.error
    console.error = (l: string) => void lines.push(l)
    try {
      expect(await shot(['/', '--base', 'http://x'], tmp(), { resolve: () => null })).toBe(1)
    } finally {
      console.error = orig
    }
    expect(lines).toEqual([INSTALL_LINE])
    expect(INSTALL_LINE).toBe(
      'basalt-ui shot needs Playwright: bun add -d playwright && bunx playwright install chromium',
    )
  })

  test('both browsers failing to launch exits 1 with the install line', async () => {
    const pw: Playwright = {
      chromium: {
        launchServer: () => Promise.reject(new Error('no browser')),
        connect: () => Promise.reject(new Error('unreachable')),
      },
    }
    const lines: string[] = []
    const orig = console.error
    console.error = (l: string) => void lines.push(l)
    try {
      expect(await shot(['/', '--base', 'http://x'], tmp(), { resolve: () => pw })).toBe(1)
    } finally {
      console.error = orig
    }
    expect(lines).toEqual([INSTALL_LINE])
  })

  test('writes metrics.json, board.html, last.json and a .gitignore', async () => {
    const cwd = tmp()
    const killed: string[] = []
    const pw: Playwright = {
      chromium: {
        launchServer: () =>
          Promise.resolve({
            wsEndpoint: () => 'ws://fake',
            kill: () => (killed.push('k'), Promise.resolve()),
          }),
        connect: () => Promise.resolve({ newContext: () => Promise.reject(new Error('unused')) }),
      },
    }
    const logs: string[] = []
    const metrics = fakeMetrics()
    const code = await shot(
      ['/dashboard', '--base', 'http://127.0.0.1:1', '--out', '.basalt/shots/r1'],
      cwd,
      {
        resolve: () => pw,
        now: () => new Date('2026-10-16T00:00:00.000Z'),
        log: (l) => void logs.push(l),
        capture: () => Promise.resolve({ anchors: metrics.anchors, shots: metrics.shots }),
      },
    )
    expect(code).toBe(0)
    expect(killed).toEqual(['k'])
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
      'anchors',
      'shots',
    ])
    expect(written.viewports).toEqual(['desktop', 'mobile'])
    expect(written.anchors[0]?.contrast.failures[0]?.ratio).toBe(2.1)
    expect(readFileSync(join(out, 'board.html'), 'utf8')).toContain('stat-card')
    expect(readFileSync(join(out, '.gitignore'), 'utf8')).toBe('*\n')
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/shots/last.json'), 'utf8'))).toEqual({
      version: 1,
      at: '2026-10-16T00:00:00.000Z',
      out: '.basalt/shots/r1',
      routes: ['/dashboard'],
    })
    expect(logs.join('\n')).toContain('1 not declared, 1 failed')
  })
})

describe('prepareOut', () => {
  test('empties the out dir; outside .basalt there is no out .gitignore but last.json is still written', () => {
    const cwd = tmp()
    mkdirSync(join(cwd, 'design/x'), { recursive: true })
    writeFileSync(join(cwd, 'design/x/stale.png'), 'old')
    const dir = prepareOut(cwd, 'design/x', ['/'], new Date(0))
    expect(existsSync(join(dir, 'stale.png'))).toBe(false)
    expect(existsSync(join(dir, 'png'))).toBe(true)
    expect(existsSync(join(dir, '.gitignore'))).toBe(false)
    expect(readFileSync(join(cwd, '.basalt/shots/.gitignore'), 'utf8')).toBe('*\n')
    expect(JSON.parse(readFileSync(join(cwd, '.basalt/shots/last.json'), 'utf8')).out).toBe(
      'design/x',
    )
  })
  test('refuses the project root and paths outside it', () => {
    const cwd = tmp()
    expect(() => prepareOut(cwd, '.', ['/'], new Date(0))).toThrow(ShotError)
    expect(() => prepareOut(cwd, '../elsewhere', ['/'], new Date(0))).toThrow(/inside the project/)
  })
})

describe('buildBoard', () => {
  const html = buildBoard(fakeMetrics())
  test('is self-contained with relative image paths', () => {
    expect(html).not.toMatch(/(?:src|href)="(?:https?:)?\/\//)
    expect(html).toContain('src="png/a.png"')
    expect(html).toContain('<style>')
  })
  test('labels not-declared and error cells, with their notes', () => {
    expect(html).toContain('empty not-declared">not-declared: no [data-shot-tooltip] in the anchor')
    expect(html).toContain('empty error">error: anchor not found')
  })
  test('shows the metrics table and escapes text', () => {
    expect(html).toContain('<th>contrast min</th>')
    expect(html).toContain('300×120')
    expect(html).toContain('Muted &#60;b&#62;')
    expect(html).not.toContain('Muted <b>')
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

const text = (over: object) => ({
  text: 't',
  fg: [0, 0, 0],
  bg: [255, 255, 255],
  fontSize: 16,
  bold: false,
  ...over,
})

describe('finishMeasurement', () => {
  const { contrast: _, ...rest } = measurement
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
  })
  test('no text: min is null, no failures', () => {
    expect(finishMeasurement({ ...rest, texts: [] }).contrast).toEqual({ min: null, failures: [] })
  })
})

describe('unionClip', () => {
  test('unions, grows by the margin and clamps to the viewport', () => {
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
