import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { detect, detectFindings, scoreOf } from './detect'
import type { Finding } from './detect'
import { planOut, shot } from './index'
import type { AnchorMetrics, ShotMetrics, ShotRecord } from './types'

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
  viewport: 'desktop',
  box: { width: 300, height: 120 },
  padding: SIDES,
  gap: { row: 8, column: 8 },
  radius: 8,
  borderWidth: 0,
  fontSizes: [12, 14],
  nested: [],
  emptyRatio: 0.1,
  contrast: { min: 7, failures: [] },
  ...over,
})
const okShot = (over: Partial<ShotRecord> = {}): ShotRecord => ({
  route: '/',
  name: 'card',
  scheme: 'light',
  viewport: 'desktop',
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
  viewports: ['desktop', 'mobile'],
  schemes: ['light', 'dark'],
  states: ['rest'],
  scale: [
    {
      scheme: 'light',
      viewport: 'desktop',
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

  test('craft-7/no-declared-states: names the anchors with a state surface and the attribute to add (P2)', () => {
    const skipped = (
      state: 'empty' | 'loading' | 'error',
      route = '/',
      over: Partial<ShotRecord> = {},
    ) =>
      okShot({
        route,
        state,
        file: null,
        status: 'not-declared',
        note: 'page declares no data-shot-states',
        ...over,
      })
    const m = metrics({
      states: ['rest', 'empty', 'loading', 'error'],
      shots: [
        okShot(),
        skipped('empty', '/', { name: 'revenue', stateful: true }),
        skipped('loading', '/', { name: 'revenue', stateful: true }),
        skipped('error', '/', { name: 'kpis', stateful: true }),
        skipped('empty', '/', { name: 'plain' }),
        skipped('empty', '/b'),
      ],
    })
    const found = detectFindings(m).filter((f) => f.rule === 'craft-7/no-declared-states')
    expect(found.map((f) => f.route)).toEqual(['/'])
    expect(found[0]).toMatchObject({ severity: 'P2', anchor: '—' })
    expect(found[0]?.defect).toContain('revenue, kpis')
    expect(found[0]?.defect).not.toContain('plain')
    expect(found[0]?.defect).toContain('data-shot-states="empty loading error"')
  })

  test('a route that declares some state, or skipped one by choice, is not flagged', () => {
    const m = metrics({
      shots: [
        okShot({ state: 'empty' }),
        okShot({
          state: 'loading',
          file: null,
          status: 'not-declared',
          note: 'page does not declare this state',
        }),
      ],
    })
    expect(rules(m)).toEqual([])
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
  })
  test('a scheme × viewport with no scale entry is unverified, not judged off-scale (P1)', () => {
    const m = metrics({ anchors: [anchor({ scheme: 'dark', radius: 99 })] })
    expect(detectFindings(m).map((f) => [f.rule, f.severity])).toEqual([
      ['craft-1/scale-missing', 'P1'],
    ])
  })
  test('an empty step list judges nothing off-scale', () => {
    const m = metrics({
      scale: [{ scheme: 'light', viewport: 'desktop', spacing: {}, radius: {}, fontSizes: {} }],
      anchors: [anchor({ radius: 99, gap: { row: 99, column: 99 } })],
    })
    expect(rules(m)).toEqual([])
  })
  test('craft-1/off-scale-radius: a nested radius off the scale is named, on-scale and 0 pass', () => {
    const nested = (radius: number) => [{ path: 'div.chip', radius, padding: SIDES }]
    const run = (radius: number, over: Partial<AnchorMetrics> = {}) =>
      detectFindings(
        metrics({ anchors: [anchor({ radius: 12, nested: nested(radius), ...over })] }),
      )
    const [f] = run(3)
    expect(f).toMatchObject({ rule: 'craft-1/off-scale-radius', severity: 'P3' })
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
          viewport: 'desktop',
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

  test('craft-5/contrast: a non-empty failures list is P0', () => {
    const failures = [{ text: 'Rev', ratio: 2.1, fg: '#aaa', bg: '#fff', fontSize: 12 }]
    const f = detectFindings(metrics({ anchors: [anchor({ contrast: { min: 2.1, failures } })] }))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'craft-5/contrast', severity: 'P0' })
    expect(f[0]?.defect).toContain('2.1')
  })
  test('craft-5/assumed-backdrop is degraded (P2)', () => {
    const m = metrics({
      anchors: [anchor({ contrast: { min: 7, failures: [], backdrop: 'assumed-white' } })],
    })
    expect(detectFindings(m)[0]).toMatchObject({ rule: 'craft-5/assumed-backdrop', severity: 'P2' })
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
        (['desktop', 'mobile'] as const).map((viewport) => ({
          ...metrics().scale[0]!,
          scheme,
          viewport,
        })),
      ),
      anchors: [
        anchor({ emptyRatio: 0.5 }),
        anchor({ emptyRatio: 0.5, viewport: 'mobile' }),
        anchor({ emptyRatio: 0.5, scheme: 'dark' }),
      ],
    })
    const f = detectFindings(m)
    expect(f).toHaveLength(1)
    expect(f[0]?.where).toEqual(['light/desktop', 'light/mobile', 'dark/desktop'])
  })

  test('findings run content → layout → style', () => {
    const failures = [{ text: 'x', ratio: 2, fg: '#aaa', bg: '#fff', fontSize: 12 }]
    const m = metrics({
      anchors: [
        anchor({
          radius: 10,
          emptyRatio: 0.5,
          contrast: { min: 2, failures },
        }),
      ],
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
      commit: () => 'abc1234',
    }).then((code) => ({ code, text: lines.join('\n') }))
  }

  test('exits 0 on a clean round, writes detect.json and one history entry', async () => {
    const { cwd, out } = setup()
    const { code, text } = await run(['--out', out], cwd)
    expect(code).toBe(0)
    expect(text).toContain('score 100')
    const written = JSON.parse(readFileSync(join(out, 'detect.json'), 'utf8')) as {
      findings: unknown[]
      score: number
    }
    expect(written).toMatchObject({ findings: [], score: 100 })
    const history = JSON.parse(readFileSync(join(cwd, '.basalt/shots/history.json'), 'utf8'))
    expect(history).toEqual([
      {
        at: '2026-10-18T12:00:00.000Z',
        out: 'out',
        commit: 'abc1234',
        counts: { P0: 0, P1: 0, P2: 0, P3: 0 },
        score: 100,
      },
    ])
  })

  test('P2 and P3 findings are listed but exit 0; a P1 exits 2', async () => {
    const polish = setup(metrics({ anchors: [anchor({ radius: 8.5 })] }))
    const p3 = await run(['--out', polish.out], polish.cwd)
    expect(p3.code).toBe(0)
    expect(p3.text).toContain('P3')
    expect(p3.text).toContain('craft-1/off-scale-radius')
    const backdrop = setup(
      metrics({
        anchors: [anchor({ contrast: { min: 7, failures: [], backdrop: 'assumed-white' } })],
      }),
    )
    expect((await run(['--out', backdrop.out], backdrop.cwd)).code).toBe(0)
    const lint = join(polish.cwd, 'lint.json')
    writeFileSync(
      lint,
      JSON.stringify({
        diagnostics: [{ code: 'basalt(card-inset)', severity: 'warning', filename: 'a.tsx' }],
      }),
    )
    expect((await run(['--out', polish.out, '--lint', lint], polish.cwd)).code).toBe(0)
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

  test('history grows per run and prints the last five scores as a trend', async () => {
    const { cwd, out } = setup(metrics({ anchors: [anchor({ emptyRatio: 0.5 })] }))
    let text = ''
    for (let i = 0; i < 6; i++) text = (await run(['--out', out], cwd, i)).text
    const history = JSON.parse(readFileSync(join(cwd, '.basalt/shots/history.json'), 'utf8'))
    expect(history).toHaveLength(6)
    expect(text).toContain('trend 90 → 90 → 90 → 90 → 90')
    expect(text.match(/→/g)).toHaveLength(4)
  })

  describe('history file', () => {
    const history = (cwd: string): string => join(cwd, '.basalt/shots/history.json')
    const seed = (cwd: string, body: string): void => {
      mkdirSync(join(cwd, '.basalt/shots'), { recursive: true })
      writeFileSync(history(cwd), body)
    }
    test('a corrupt history is kept as .bak and a new one starts; detect still runs', async () => {
      const { cwd, out } = setup(metrics({ anchors: [anchor({ emptyRatio: 0.5 })] }))
      seed(cwd, '[')
      const { code, text } = await run(['--out', out], cwd)
      expect(code).toBe(2)
      expect(text).toContain('history.json.bak')
      expect(readFileSync(`${history(cwd)}.bak`, 'utf8')).toBe('[')
      expect(JSON.parse(readFileSync(history(cwd), 'utf8'))).toHaveLength(1)
    })
    test('a non-array history is treated the same way', async () => {
      const { cwd, out } = setup()
      seed(cwd, '{"runs":[]}')
      expect((await run(['--out', out], cwd)).code).toBe(0)
      expect(readFileSync(`${history(cwd)}.bak`, 'utf8')).toBe('{"runs":[]}')
      expect(JSON.parse(readFileSync(history(cwd), 'utf8'))).toHaveLength(1)
    })
    test('no temp file is left behind', async () => {
      const { cwd, out } = setup()
      await run(['--out', out], cwd)
      expect(existsSync(`${history(cwd)}.tmp`)).toBe(false)
      expect(existsSync(join(out, 'detect.json.tmp'))).toBe(false)
    })
    test('an unwritable out dir is exit 1 with a clean message and no history entry', async () => {
      const { cwd, out } = setup()
      chmodSync(out, 0o555)
      try {
        const err: string[] = []
        const spy = spyOn(console, 'error').mockImplementation((l: string) => void err.push(l))
        const { code } = await run(['--out', out], cwd)
        spy.mockRestore()
        // Root ignores the mode bits; only assert the contract where the mode is honoured.
        if (process.getuid?.() !== 0) {
          expect(code).toBe(1)
          expect(err.join('\n')).toContain('cannot write detect.json or history.json')
          expect(existsSync(history(cwd))).toBe(false)
        }
      } finally {
        chmodSync(out, 0o755)
      }
    })
  })

  test('exit 1: missing or unreadable metrics.json writes nothing', async () => {
    const cwd = tmp()
    const out = join(cwd, 'nope')
    const missing = await run(['--out', out], cwd)
    expect(missing.code).toBe(1)
    expect(existsSync(join(cwd, '.basalt/shots/history.json'))).toBe(false)
    const bad = setup('{ not json')
    expect((await run(['--out', bad.out], bad.cwd)).code).toBe(1)
    const wrong = setup('{"version":2}')
    expect((await run(['--out', wrong.out], wrong.cwd)).code).toBe(1)
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
    writeFileSync(lint, 'nope')
    expect((await run(['--out', out, '--lint', lint], cwd)).code).toBe(1)
    expect((await run(['--out', out, '--lint', join(cwd, 'gone.json')], cwd)).code).toBe(1)
  })

  test('without --out it follows last.json, then the default out dir', async () => {
    const cwd = tmp()
    const named = join(cwd, '.basalt/shots/r2')
    mkdirSync(named, { recursive: true })
    writeFileSync(join(named, 'metrics.json'), JSON.stringify(metrics()))
    writeFileSync(join(cwd, '.basalt/shots/last.json'), JSON.stringify({ out: '.basalt/shots/r2' }))
    expect((await run([], cwd)).code).toBe(0)
    expect(existsSync(join(named, 'detect.json'))).toBe(true)
  })

  test('an unknown flag is exit 1', async () => {
    const { cwd } = setup()
    expect((await run(['--nope'], cwd)).code).toBe(1)
  })

  test('is reached as `shot detect`, and a later shot may empty an out dir holding detect.json', async () => {
    const { cwd, out } = setup()
    const rel = 'out'
    const lines: string[] = []
    const code = await shot(['detect', '--out', rel], cwd, { log: (l) => void lines.push(l) })
    expect(code).toBe(0)
    expect(existsSync(join(out, 'detect.json'))).toBe(true)
    expect(() => planOut(cwd, rel)).not.toThrow()
  })
})
