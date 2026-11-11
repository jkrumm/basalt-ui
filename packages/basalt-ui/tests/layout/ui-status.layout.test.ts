/**
 * P5b (docs/v3/concepts/primitives-distribution.md section 4, rows 27-32): the `Status`, `Swatch`,
 * `Alert`, `Progress`, `Ring` and `Meter` primitives in real Chrome at 1440, 768, 390 and 320.
 * Asserted here because happy-dom has no geometry and no colour computation: the meter's zones
 * partition its track in proportion to their bounds, the marker sits inside the track at the value's
 * position, the active zone word is on screen, the ring prints `42,5 %` in `de-DE`, a long alert
 * body wraps instead of pushing the page sideways, the dots and chips are drawn, and axe finds
 * nothing serious or critical (colour contrast included, in both colour schemes).
 *
 * The page is self-contained: `fixture/ui-status.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-status-fixture.tsx` is bundled in memory, both inlined into a document
 * served beside the shared fixture, so no shared fixture file carries a line for this suite.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  PHONE_SMALL,
  TABLET_768,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-status-'))
  const cssOut = join(scratch, 'ui-status.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-status.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-status: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-status-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-status: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-status</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="meter"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

type Zoned = {
  track: { left: number; width: number; height: number }
  segments: { left: number; width: number }[]
  marker: number | null
  word: string
  readout: string
}

/** The geometry of one zoned meter: its track, one rect per zone, the marker x and the readout. */
const zonedMeter = (page: LayoutPage, id: string): Promise<Zoned> =>
  page.raw.evaluate((testid) => {
    const root = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
    const track = root.firstElementChild!.getBoundingClientRect()
    const svg = root.querySelector('svg')
    const line = svg?.querySelector('line')
    const spans = root.querySelector('[data-readout]')!.querySelectorAll('span')
    return {
      track: { left: track.left, width: track.width, height: track.height },
      segments: [...(svg?.querySelectorAll('rect') ?? [])].map((r) => {
        const b = r.getBoundingClientRect()
        return { left: b.left, width: b.width }
      }),
      marker: line === null || line === undefined ? null : line.getBoundingClientRect().left,
      word: spans[0]?.textContent ?? '',
      readout: spans[1]?.textContent ?? '',
    }
  }, id)

layout('Status, Alert, Progress and Meter', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('zones partition the track in proportion to their bounds, marker at the value', async () => {
        const page = await open(viewport)
        const z = await zonedMeter(page, 'ui-meter-zones')
        expect(z.track.height).toBe(8)
        expect(z.segments).toHaveLength(3)
        const [a, b, c] = z.segments.map((s) => s.width / z.track.width) as [number, number, number]
        expect(a).toBeCloseTo(0.4, 2)
        expect(b).toBeCloseTo(0.25, 2)
        expect(c).toBeCloseTo(0.35, 2)
        expect(z.segments[1]!.left).toBeCloseTo(z.segments[0]!.left + z.segments[0]!.width, 0)
        // 1.1 on 0..2 is 55 % along the track.
        expect(z.marker).not.toBeNull()
        expect((z.marker! - z.track.left) / z.track.width).toBeCloseTo(0.55, 1)
      })

      test('the active zone word is printed and moves with the value; the readout is de-DE', async () => {
        const page = await open(viewport)
        expect((await zonedMeter(page, 'ui-meter-zones')).word).toBe('Optimal')
        expect((await zonedMeter(page, 'ui-meter-hot')).word).toBe('Overreaching')
        expect((await zonedMeter(page, 'ui-meter-zones')).readout).toBe('1,1')
        const nothing = await zonedMeter(page, 'ui-meter-null')
        expect(nothing.marker).toBeNull()
        expect(nothing.word).toBe('')
        expect(nothing.readout).toBe('—')
      })

      test('the plain meter fills 30 % of its track', async () => {
        const page = await open(viewport)
        const { fill, track } = await page.raw.evaluate(() => {
          const root = document.querySelector<HTMLElement>('[data-testid="ui-meter-plain"]')!
          return {
            fill: root.querySelector('[data-fill]')!.getBoundingClientRect().width,
            track: root.firstElementChild!.getBoundingClientRect().width,
          }
        })
        expect(fill / track).toBeCloseTo(0.3, 2)
      })

      test('Ring prints the percent with a comma in de-DE and draws a 48 px circle', async () => {
        const page = await open(viewport)
        const ring = await page.raw.evaluate(() => {
          const el = document.querySelector<HTMLElement>('[data-testid="ui-ring"]')!
          const box = el.getBoundingClientRect()
          return {
            text: el.textContent,
            valuetext: el.getAttribute('aria-valuetext'),
            width: box.width,
            height: box.height,
            dash: el.querySelectorAll('circle')[1]!.getAttribute('stroke-dasharray'),
          }
        })
        expect(ring.text).toBe('42,5 %')
        expect(ring.valuetext).toBe('42,5 %')
        expect([ring.width, ring.height]).toEqual([48, 48])
        expect(ring.dash).toBe('42.5 100')
      })

      test('Progress fills 40 % of its track and the indeterminate bar fills it all', async () => {
        const page = await open(viewport)
        const { part, whole } = await page.raw.evaluate(() => {
          const width = (testid: string): [number, number] => {
            const root = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
            return [
              root.firstElementChild!.getBoundingClientRect().width,
              root.getBoundingClientRect().width,
            ]
          }
          return { part: width('ui-progress'), whole: width('ui-progress-wait') }
        })
        expect(part[0] / part[1]).toBeCloseTo(0.4, 2)
        expect(whole[0] / whole[1]).toBeCloseTo(1, 2)
      })

      test('a status draws its dot, a swatch its 10 px chip', async () => {
        const page = await open(viewport)
        const probes = await page.raw.evaluate(() => {
          const dot = getComputedStyle(
            document.querySelector('[data-testid="ui-status-good"]')!,
            '::before',
          )
          const chip = document
            .querySelector<HTMLElement>('[data-testid="ui-swatch-0"]')!
            .getBoundingClientRect()
          return {
            dot: [dot.width, dot.height, dot.backgroundColor],
            chip: [chip.width, chip.height],
          }
        })
        expect(probes.dot[0]).toBe('8px')
        expect(probes.dot[1]).toBe('8px')
        expect(probes.dot[2]).not.toBe('rgba(0, 0, 0, 0)')
        expect(probes.chip).toEqual([10, 10])
      })

      test('alerts carry a role per tone and a long body wraps inside the alert', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() =>
          ['neutral', 'accent', 'good', 'warn', 'bad', 'info'].map((tone) => {
            const el = document.querySelector<HTMLElement>(`[data-testid="ui-alert-${tone}"]`)!
            const box = el.getBoundingClientRect()
            return {
              tone,
              role: el.getAttribute('role'),
              right: box.right,
              scroll: el.scrollWidth,
              client: el.clientWidth,
            }
          }),
        )
        expect(info.map((i) => i.role)).toEqual([
          'status',
          'status',
          'status',
          'alert',
          'alert',
          'status',
        ])
        for (const i of info) expect(i.scroll, `${i.tone} overflows`).toBeLessThanOrEqual(i.client)
      })

      test('the page does not scroll sideways', async () => {
        const page = await open(viewport)
        const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
          await page.raw.addScriptTag({ content: axeSource })
          const violations = await page.raw.evaluate(async () => {
            const axe = (
              window as unknown as {
                axe: {
                  run: () => Promise<{
                    violations: { id: string; impact: string; nodes: { html: string }[] }[]
                  }>
                }
              }
            ).axe
            const result = await axe.run()
            return result.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
          })
          expect(violations).toEqual([])
        })
      }
    })
  }
})
