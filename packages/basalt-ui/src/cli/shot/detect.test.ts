import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { detect, detectFindings, scoreOf } from './detect'
import type { Finding } from './detect'
import { planOut, shot } from './index'
import type { AnchorMetrics, ShotMetrics, ShotRecord } from './types'

const DESKTOP = '1800x1200'
const PHONE = '390x844'

const dirs: string[] = []
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'detect-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const SIDES = { top: 8, right: 8, bottom: 8, left: 8 }
const anchor = (over: Partial<AnchorMetrics> = {}): AnchorMetrics => ({
  route: '/',
  name: 'card',
  scheme: 'light',
  viewport: DESKTOP,
  box: { width: 300, height: 120 },
  padding: SIDES,
  gap: { row: 8, column: 8 },
  radius: 8,
  borderWidth: 0,
  fontSizes: [12, 14],
  nested: [],
  emptyRatio: 0.1,
  small: [],
  overlaps: [],
  ...over,
})
const okShot = (over: Partial<ShotRecord> = {}): ShotRecord => ({
  route: '/',
  name: 'card',
  scheme: 'light',
  viewport: DESKTOP,
  state: 'rest',
  file: 'png/a.png',
  status: 'ok',
  ...over,
})
const metrics = (over: Partial<ShotMetrics> = {}): ShotMetrics => ({
  version: 1,
  generatedAt: '2026-10-18T00:00:00.000Z',
  base: 'http://x',
  routes: ['/'],
  viewports: [DESKTOP, PHONE],
  schemes: ['light', 'dark'],
  states: ['rest'],
  scale: [
    {
      scheme: 'light',
      viewport: DESKTOP,
      spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
      radius: { sm: 4, md: 8, lg: 12 },
      fontSizes: { xs: 12, sm: 14 },
    },
  ],
  anchors: [anchor()],
  shots: [okShot()],
  ...over,
})
const rules = (m: ShotMetrics, lint?: unknown): string[] =>
  detectFindings(m, lint as never).map((f) => f.rule)

describe('detectFindings', () => {
  test('a clean round has no findings', () => {
    expect(detectFindings(metrics())).toEqual([])
  })

  test('a route that declares some state, or skipped one by choice, is not flagged', () => {
    const m = metrics({
      shots: [
        okShot({ state: 'empty' }),
        okShot({
          state: 'loading',
          file: null,
          status: 'not-declared',
          note: 'anchor does not declare this state',
        }),
      ],
    })
    expect(rules(m)).toEqual([])
  })

  test('craft-7/states-ignored: a state shot equal to rest is P1 and says which state', () => {
    const m = metrics({ shots: [okShot(), okShot({ state: 'empty', ignored: true })] })
    const f = detectFindings(m)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'craft-7/states-ignored', severity: 'P1', anchor: 'card' })
    expect(f[0]?.defect).toContain('?shot-state=empty')
    expect(f[0]?.cite).toContain('.ignored')
  })

  test('craft-1/off-scale-inset names the off-scale side (P1)', () => {
    const f = detectFindings(
      metrics({ anchors: [anchor({ padding: { ...SIDES, left: 10 } })] }),
    ).find((x) => x.rule === 'craft-1/off-scale-inset')
    expect(f).toMatchObject({ severity: 'P1', anchor: 'card' })
    expect(f?.cite).toContain('padding')
    expect(f?.defect).toContain('10')
  })
  test('zero and "full" are never off-scale', () => {
    const m = metrics({
      anchors: [anchor({ padding: { top: 0, right: 0, bottom: 0, left: 0 }, radius: 'full' })],
    })
    expect(rules(m)).toEqual([])
  })
  test('craft-1/off-scale-gap', () => {
    const m = metrics({ anchors: [anchor({ gap: { row: 8, column: 9.5 } })] })
    expect(rules(m)).toEqual(['craft-1/off-scale-gap'])
  })
  test('craft-1/off-scale-radius', () => {
    const m = metrics({ anchors: [anchor({ radius: 10 })] })
    expect(rules(m)).toEqual(['craft-1/off-scale-radius'])
  })
  test('an off-scale value within 1 px of a step is polish (P3)', () => {
    const m = metrics({ anchors: [anchor({ radius: 8.5 })] })
    expect(detectFindings(m)[0]).toMatchObject({ rule: 'craft-1/off-scale-radius', severity: 'P3' })
    expect(detectFindings(m)[0]?.defect).toStartWith('Radius 8.5px is not a radius step (')
  })
  test('a scheme × viewport with no scale entry skips the off-scale check', () => {
    const m = metrics({ anchors: [anchor({ scheme: 'dark', radius: 99 })] })
    expect(detectFindings(m)).toEqual([])
  })
  test('a scale is matched by route: a route-bound entry judges only its own route', () => {
    const entry = (route: string | undefined, radius: Record<string, number>) => ({
      ...(route ? { route } : {}),
      scheme: 'light' as const,
      viewport: DESKTOP,
      spacing: { sm: 8 },
      radius,
      fontSizes: { xs: 12 },
    })
    const m = metrics({
      scale: [entry('/', { md: 8 }), entry('/other', { md: 10 })],
      anchors: [anchor({ radius: 10 }), anchor({ route: '/other', radius: 10 })],
    })
    const f = detectFindings(m)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'craft-1/off-scale-radius', route: '/' })
    // An entry with no route stands for every route.
    expect(
      rules(metrics({ scale: [entry(undefined, { md: 10 })], anchors: [anchor({ radius: 10 })] })),
    ).toEqual([])
  })
  test('an anchor from an older metrics.json without small or overlaps is clean', () => {
    const { small: _s, overlaps: _o, ...old } = anchor()
    expect(rules(metrics({ anchors: [old as AnchorMetrics] }))).toEqual([])
  })
  test('an empty step list judges nothing off-scale', () => {
    const m = metrics({
      scale: [{ scheme: 'light', viewport: DESKTOP, spacing: {}, radius: {}, fontSizes: {} }],
      anchors: [anchor({ radius: 99, gap: { row: 99, column: 99 } })],
    })
    expect(rules(m)).toEqual([])
  })
  test('craft-1/off-scale-radius: a nested radius off the scale is always P1, on-scale and 0 pass', () => {
    const nested = (radius: number) => [{ path: 'div.chip', radius, padding: SIDES }]
    const run = (radius: number, over: Partial<AnchorMetrics> = {}) =>
      detectFindings(
        metrics({ anchors: [anchor({ radius: 12, nested: nested(radius), ...over })] }),
      )
    const [f] = run(3)
    expect(f).toMatchObject({ rule: 'craft-1/off-scale-radius', severity: 'P1' })
    expect(f?.defect).toContain('div.chip 3px')
    expect(run(6)[0]?.severity).toBe('P1')
    expect(run(4)).toEqual([])
    expect(run(0)).toEqual([])
  })
  test('the nested radius check follows a knob-shifted scale', () => {
    const shifted = metrics({
      scale: [
        {
          scheme: 'light',
          viewport: DESKTOP,
          spacing: { sm: 8 },
          radius: { sm: 3, md: 9 },
          fontSizes: { xs: 12 },
        },
      ],
      anchors: [anchor({ radius: 9, nested: [{ path: 'i', radius: 3, padding: SIDES }] })],
    })
    expect(rules(shifted)).toEqual([])
  })
  test('craft-1/nested-radius-step: a nested surface within 3 px of its parent fails', () => {
    const path = 'div.inner'
    const m = metrics({
      anchors: [anchor({ nested: [{ path, radius: 8, padding: SIDES }] })],
    })
    expect(rules(m)).toEqual(['craft-1/nested-radius-step'])
    const ok = metrics({
      anchors: [anchor({ radius: 12, nested: [{ path, radius: 8, padding: SIDES }] })],
    })
    expect(rules(ok)).toEqual([])
  })
  test('craft-1/scale-error when the theme scale was not read', () => {
    expect(rules(metrics({ scaleError: 'no styles' }))).toEqual(['craft-1/scale-error'])
    expect(rules(metrics({ scale: [] }))).toEqual(['craft-1/scale-error'])
  })

  test('craft-2/font-sizes: more than three distinct sizes (P1)', () => {
    const f = detectFindings(metrics({ anchors: [anchor({ fontSizes: [11, 12, 12, 14, 16] })] }))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'craft-2/font-sizes', severity: 'P1' })
    expect(rules(metrics({ anchors: [anchor({ fontSizes: [12, 12, 14, 16] })] }))).toEqual([])
  })

  test('craft-3/empty-region at 0.4 and above, not below', () => {
    expect(rules(metrics({ anchors: [anchor({ emptyRatio: 0.4 })] }))).toEqual([
      'craft-3/empty-region',
    ])
    expect(rules(metrics({ anchors: [anchor({ emptyRatio: 0.39 })] }))).toEqual([])
  })

  test('craft-6/overlap: text boxes covering each other are P1 and listed', () => {
    const f = detectFindings(
      metrics({ anchors: [anchor({ overlaps: ['div.a × span.b', 'p × em'] })] }),
    )
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'craft-6/overlap', severity: 'P1', layer: 'layout' })
    expect(f[0]?.defect).toContain('div.a × span.b; p × em')
  })

  test('craft-6/hit-floor: a control under 24 px is P1 and listed', () => {
    const f = detectFindings(metrics({ anchors: [anchor({ small: ['button.x 20x20'] })] }))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'craft-6/hit-floor', severity: 'P1', layer: 'layout' })
    expect(f[0]?.defect).toContain('button.x 20x20')
  })

  test('craft-6/document-overflow: a page wider than its viewport is P1, a fitting one is clean', () => {
    const page = (overflowX: number, viewport = PHONE) => ({
      route: '/',
      scheme: 'light' as const,
      viewport,
      overflowX,
    })
    const f = detectFindings(metrics({ pages: [page(0, DESKTOP), page(37)] }))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({
      rule: 'craft-6/document-overflow',
      severity: 'P1',
      route: '/',
      where: [`light/${PHONE}`],
    })
    expect(f[0]?.defect).toContain('37px')
    expect(rules(metrics({ pages: [page(0)] }))).toEqual([])
  })

  test('scan/shot-error: an error shot is P0 and cites its file note', () => {
    const m = metrics({
      shots: [okShot({ status: 'error', file: null, note: 'anchor not found' })],
    })
    const f = detectFindings(m)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'scan/shot-error', severity: 'P0', anchor: 'card' })
    expect(f[0]?.defect).toContain('anchor not found')
  })
  test('absent, not-declared and skipped shots are not defects', () => {
    const m = metrics({
      shots: ['absent', 'not-declared', 'skipped'].map((status) =>
        okShot({ status: status as ShotRecord['status'], file: null }),
      ),
    })
    expect(rules(m)).toEqual([])
  })
  test('scan/no-anchors: zero anchors is P0', () => {
    const f = detectFindings(metrics({ anchors: [] }))
    expect(f.map((x) => [x.rule, x.severity])).toEqual([['scan/no-anchors', 'P0']])
  })

  test('the same defect across schemes and viewports is one finding listing where', () => {
    const m = metrics({
      scale: (['light', 'dark'] as const).flatMap((scheme) =>
        [DESKTOP, PHONE].map((viewport) => ({
          ...metrics().scale[0]!,
          scheme,
          viewport,
        })),
      ),
      anchors: [
        anchor({ emptyRatio: 0.5 }),
        anchor({ emptyRatio: 0.5, viewport: PHONE }),
        anchor({ emptyRatio: 0.5, scheme: 'dark' }),
      ],
    })
    const f = detectFindings(m)
    expect(f).toHaveLength(1)
    expect(f[0]?.where).toEqual([`light/${DESKTOP}`, `light/${PHONE}`, `dark/${DESKTOP}`])
  })

  test('findings run content → layout → style', () => {
    const m = metrics({
      anchors: [anchor({ radius: 10, emptyRatio: 0.5 })],
      shots: [okShot({ status: 'error', file: null, note: 'boom' })],
    })
    expect(detectFindings(m).map((f) => f.layer)).toEqual(['content', 'layout', 'style'])
  })

  describe('oxlint report', () => {
    const diag = (code: string, severity: string, over: object = {}) => ({
      message: 'Never set p on a Card',
      code,
      severity,
      filename: 'src/routes/home.tsx',
      labels: [{ span: { offset: 10, length: 4, line: 12, column: 7 } }],
      ...over,
    })
    test('each basalt/* diagnostic becomes a style finding; other rules are ignored', () => {
      const f = detectFindings(metrics(), {
        diagnostics: [diag('basalt(card-inset)', 'error'), diag('eslint(no-debugger)', 'warning')],
      })
      expect(f).toHaveLength(1)
      expect(f[0]).toMatchObject({
        rule: 'lint/basalt/card-inset',
        severity: 'P1',
        layer: 'style',
        anchor: 'src/routes/home.tsx',
      })
      expect(f[0]?.cite).toBe('src/routes/home.tsx:12:7')
    })
    test('a warning is P2', () => {
      const f = detectFindings(metrics(), { diagnostics: [diag('basalt(card-inset)', 'warning')] })
      expect(f[0]?.severity).toBe('P2')
    })
    test('only the real `basalt(rule)` code is read', () => {
      expect(
        detectFindings(metrics(), { diagnostics: [diag('basalt/card-inset', 'error')] }),
      ).toEqual([])
    })
  })
})

describe('scoreOf', () => {
  const at = (severity: Finding['severity']): Finding => ({
    rule: 'r',
    route: '/',
    severity,
    layer: 'style',
    anchor: 'a',
    where: [],
    cite: 'c',
    defect: 'd',
  })
  test('100 minus 25/10/3/1 per P0/P1/P2/P3, floored at 0', () => {
    expect(scoreOf([])).toBe(100)
    expect(scoreOf([at('P0'), at('P1'), at('P2'), at('P3')])).toBe(61)
    expect(scoreOf(Array.from({ length: 5 }, () => at('P0')))).toBe(0)
  })
})

describe('detect command', () => {
  const setup = (m: ShotMetrics | string = metrics()) => {
    const cwd = tmp()
    const out = join(cwd, 'out')
    mkdirSync(out)
    writeFileSync(join(out, 'metrics.json'), typeof m === 'string' ? m : JSON.stringify(m))
    return { cwd, out }
  }
  const run = (flags: string[], cwd: string, n = 0) => {
    const lines: string[] = []
    return detect(flags, cwd, {
      now: () => new Date(Date.UTC(2026, 9, 18, 12, n)),
      log: (l) => void lines.push(l),
    }).then((code) => ({ code, text: lines.join('\n') }))
  }

  test('exits 0 on a clean round and writes detect.json only', async () => {
    const { cwd, out } = setup()
    const { code, text } = await run(['--out', out], cwd)
    expect(code).toBe(0)
    expect(text).toContain('score 100')
    const written = JSON.parse(readFileSync(join(out, 'detect.json'), 'utf8')) as {
      findings: unknown[]
      score: number
      at: string
    }
    expect(written).toMatchObject({ findings: [], score: 100, at: '2026-10-18T12:00:00.000Z' })
    expect(existsSync(join(cwd, '.basalt'))).toBe(false)
  })

  test('P2 and P3 findings are listed but exit 0; a P1 exits 2', async () => {
    const polish = setup(metrics({ anchors: [anchor({ radius: 8.5 })] }))
    const p3 = await run(['--out', polish.out], polish.cwd)
    expect(p3.code).toBe(0)
    expect(p3.text).toContain('P3')
    expect(p3.text).toContain('craft-1/off-scale-radius')
    const lint = join(polish.cwd, 'lint.json')
    writeFileSync(
      lint,
      JSON.stringify({
        diagnostics: [{ code: 'basalt(card-inset)', severity: 'warning', filename: 'a.tsx' }],
      }),
    )
    expect((await run(['--out', polish.out, '--lint', lint], polish.cwd)).code).toBe(0)
    const p1 = setup(metrics({ anchors: [anchor({ overlaps: ['a × b'] })] }))
    expect((await run(['--out', p1.out], p1.cwd)).code).toBe(2)
  })

  test('exits 2 with findings in a compact table, content first', async () => {
    const { cwd, out } = setup(metrics({ anchors: [anchor({ radius: 10, emptyRatio: 0.5 })] }))
    const { code, text } = await run(['--out', out], cwd)
    expect(code).toBe(2)
    expect(text).toContain('craft-3/empty-region')
    expect(text).toContain('craft-1/off-scale-radius')
    expect(text.indexOf('craft-3/empty-region')).toBeLessThan(
      text.indexOf('craft-1/off-scale-radius'),
    )
    expect(text).not.toMatch(/[┌┬─│└┘├┤┼]/)
    expect(text).toContain('P1')
  })

  test('no anchor resolved: "nothing measured", a null score, no numeric result', async () => {
    const { cwd, out } = setup(metrics({ anchors: [] }))
    const { code, text } = await run(['--out', out], cwd)
    expect(code).toBe(2)
    expect(text).toContain('nothing measured')
    expect(text).not.toContain('score 75')
    const written = JSON.parse(readFileSync(join(out, 'detect.json'), 'utf8')) as { score: unknown }
    expect(written.score).toBeNull()
  })

  test('a positional is refused with the --out form', async () => {
    const { cwd } = setup()
    const err = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect((await run(['before'], cwd)).code).toBe(1)
      expect(String(err.mock.calls[0]?.[0])).toContain('--out before')
    } finally {
      err.mockRestore()
    }
  })

  test('exit 1: missing or unreadable metrics.json writes nothing', async () => {
    const cwd = tmp()
    const out = join(cwd, 'nope')
    const err = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const missing = await run(['--out', out], cwd)
      expect(missing.code).toBe(1)
      expect(existsSync(join(out, 'detect.json'))).toBe(false)
      const bad = setup('{ not json')
      expect((await run(['--out', bad.out], bad.cwd)).code).toBe(1)
      const wrong = setup('{"version":2}')
      expect((await run(['--out', wrong.out], wrong.cwd)).code).toBe(1)
    } finally {
      err.mockRestore()
    }
  })

  test('--lint reads an oxlint JSON report; a bad file is exit 1', async () => {
    const { cwd, out } = setup()
    const lint = join(cwd, 'lint.json')
    writeFileSync(
      lint,
      JSON.stringify({
        diagnostics: [
          {
            message: 'm',
            code: 'basalt(card-inset)',
            severity: 'error',
            filename: 'a.tsx',
            labels: [{ span: { line: 1, column: 2 } }],
          },
        ],
      }),
    )
    const found = await run(['--out', out, '--lint', lint], cwd)
    expect(found.code).toBe(2)
    expect(found.text).toContain('lint/basalt/card-inset')
    const err = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      writeFileSync(lint, 'nope')
      expect((await run(['--out', out, '--lint', lint], cwd)).code).toBe(1)
      expect((await run(['--out', out, '--lint', join(cwd, 'gone.json')], cwd)).code).toBe(1)
    } finally {
      err.mockRestore()
    }
  })

  test('without --out it follows .basalt/last-shot.json', async () => {
    const cwd = tmp()
    const named = join(cwd, 'shots-2')
    mkdirSync(named, { recursive: true })
    writeFileSync(join(named, 'metrics.json'), JSON.stringify(metrics()))
    mkdirSync(join(cwd, '.basalt'))
    writeFileSync(join(cwd, '.basalt/last-shot.json'), JSON.stringify({ out: 'shots-2', round: 2 }))
    expect((await run([], cwd)).code).toBe(0)
    expect(existsSync(join(named, 'detect.json'))).toBe(true)
  })

  test('without --out and without last-shot.json it exits 1 naming the file', async () => {
    const cwd = tmp()
    const err: string[] = []
    const spy = spyOn(console, 'error').mockImplementation((l: string) => void err.push(l))
    try {
      expect((await run([], cwd)).code).toBe(1)
      expect(err.join('\n')).toContain('last-shot.json')
    } finally {
      spy.mockRestore()
    }
  })

  test('an unknown flag is exit 1', async () => {
    const { cwd } = setup()
    const err = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect((await run(['--nope'], cwd)).code).toBe(1)
    } finally {
      err.mockRestore()
    }
  })

  test('is reached as `shot detect`; its out dir is no fresh --out for the next shot', async () => {
    const { cwd, out } = setup()
    const rel = 'out'
    const lines: string[] = []
    const code = await shot(['detect', '--out', rel], cwd, { log: (l) => void lines.push(l) })
    expect(code).toBe(0)
    expect(existsSync(join(out, 'detect.json'))).toBe(true)
    // The dir exists, so planOut refuses it: every round writes to a fresh one.
    expect(() => planOut(cwd, rel)).toThrow('exists already')
  })
})
