/**
 * `Schedule` in real Chrome at 1800x1200 and 390x844 (the week's time grid, its phone week strip and
 * the month grid). Geometry happy-dom cannot hold: events that overlap stand side by side in lanes,
 * back-to-back events do not touch, a one-hour event and a fifteen-minute one keep their drawn heights,
 * the now line sits at its minute, one day shows under the week strip below `@regular`, and the month
 * is seven columns.
 *
 * Self-contained like `cards-kanban`: `fixture/cards-schedule.css` is compiled with the Tailwind CLI
 * into a temp directory and `fixture/cards-schedule-fixture.tsx` is bundled in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
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
const DESKTOP: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TODAY = '2026-11-23'
/** The cluster of four that overlaps on the shown day, by title. */
const CLUSTER = ['Bearing delivery', 'Supplier call', 'Crate handover', 'Seal check']
/** One grid hour, px. */
const HOUR_PX = 64
/** Sub-pixel slack for touching edges and rounding. */
const TOLERANCE = 0.5

type Rect = { left: number; top: number; right: number; bottom: number }
type Placed = Rect & { label: string }
type Column = Rect & { day: string | null; events: Placed[] }

let documentPath = ''
let scratch = ''

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'cards-schedule-'))
  const cssOut = join(scratch, 'cards-schedule.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'cards-schedule.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`cards-schedule: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'cards-schedule-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`cards-schedule: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" ` +
      `/><meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>cards-schedule</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

/** Opens the fixture; `query` is appended to the document path (`?view=month`). */
async function open(viewport: Viewport, query = ''): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    viewport,
    `${documentPath}${query}`,
    'reduce',
    viewport === PHONE ? 'coarse' : 'fine',
  )
  await page.raw.waitForSelector('[data-slot="schedule"]')
  await page.settle()
  return page
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right - TOLERANCE &&
  b.left < a.right - TOLERANCE &&
  a.top < b.bottom - TOLERANCE &&
  b.top < a.bottom - TOLERANCE

/** Every day column with its timed events, read in one round trip. */
async function columnsOf(page: LayoutPage): Promise<Column[]> {
  return page.raw.evaluate(() =>
    [...document.querySelectorAll('[data-slot="schedule-day"]')].map((col) => {
      const c = col.getBoundingClientRect()
      return {
        left: c.left,
        top: c.top,
        right: c.right,
        bottom: c.bottom,
        day: col.getAttribute('data-day'),
        events: [...col.querySelectorAll('[data-slot="schedule-event"]')].map((el) => {
          const r = el.getBoundingClientRect()
          return {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            label: el.getAttribute('aria-label') ?? '',
          }
        }),
      }
    }),
  )
}

/** The event whose accessible name starts with its title (the name then carries the time). */
function eventTitled(column: Column, title: string): Placed {
  const found = column.events.find((e) => e.label.startsWith(`${title},`))
  if (!found) throw new Error(`no event "${title}" on ${column.day}`)
  return found
}

function columnFor(columns: Column[], day: string): Column {
  const found = columns.find((c) => c.day === day)
  if (!found) throw new Error(`no day column ${day}`)
  return found
}

layout('Schedule', () => {
  describe(`${DESKTOP.name}, week`, () => {
    test('events that overlap in a day column stand side by side, inside the column', async () => {
      const page = await open(DESKTOP)
      const columns = await columnsOf(page)
      expect(columns).toHaveLength(7)
      for (const col of columns) {
        for (const ev of col.events) {
          expect(ev.left, `${ev.label} starts inside ${col.day}`).toBeGreaterThanOrEqual(
            col.left - TOLERANCE,
          )
          expect(ev.right, `${ev.label} ends inside ${col.day}`).toBeLessThanOrEqual(
            col.right + TOLERANCE,
          )
        }
        col.events.forEach((a, i) => {
          for (const b of col.events.slice(i + 1)) {
            expect(overlaps(a, b), `${a.label} and ${b.label} overlap on ${col.day}`).toBe(false)
          }
        })
      }
      const cluster = columnFor(columns, TODAY).events.filter((e) =>
        CLUSTER.some((title) => e.label.startsWith(`${title},`)),
      )
      expect(cluster).toHaveLength(CLUSTER.length)
      const lefts = new Set(cluster.map((e) => Math.round(e.left * 2) / 2))
      expect(lefts.size, 'the four-event cluster uses at least three lanes').toBeGreaterThanOrEqual(
        3,
      )
    })

    test('back-to-back events do not overlap vertically', async () => {
      const page = await open(DESKTOP)
      const today = columnFor(await columnsOf(page), TODAY)
      const early = eventTitled(today, 'Dock opening')
      const late = eventTitled(today, 'Forklift briefing')
      expect(early.bottom).toBeLessThanOrEqual(late.top + TOLERANCE)
    })

    test('a one-hour event draws 61 px tall and a fifteen-minute event at least 26 px', async () => {
      const page = await open(DESKTOP)
      const today = columnFor(await columnsOf(page), TODAY)
      const hour = eventTitled(today, 'Lunch review')
      const short = eventTitled(today, 'Seal check')
      expect(Math.abs(hour.bottom - hour.top - 61)).toBeLessThanOrEqual(1)
      expect(short.bottom - short.top).toBeGreaterThanOrEqual(26)
    })

    test("the now line sits inside today's column at 09:30", async () => {
      const page = await open(DESKTOP)
      const now = await page.raw.evaluate(() => {
        const line = document.querySelector('[data-slot="schedule-now"]')
        const col = line?.closest('[data-slot="schedule-day"]')
        if (!line || !col) return null
        const l = line.getBoundingClientRect()
        const c = col.getBoundingClientRect()
        return {
          day: col.getAttribute('data-day'),
          offsetTop: l.top - c.top,
          insideLeft: l.left - c.left,
          insideRight: c.right - l.right,
        }
      })
      expect(now, 'the now line is drawn').not.toBeNull()
      expect(now!.day).toBe(TODAY)
      expect(Math.abs(now!.offsetTop - 9.5 * HOUR_PX)).toBeLessThanOrEqual(2)
      expect(now!.insideLeft).toBeGreaterThanOrEqual(-TOLERANCE)
      expect(now!.insideRight).toBeGreaterThanOrEqual(-TOLERANCE)
    })
  })

  describe(`${PHONE.name}, week`, () => {
    test('the week strip shows and one day column is displayed, with no sideways scroll', async () => {
      const page = await open(PHONE)
      const state = await page.raw.evaluate(() => {
        const strip = document.querySelector('[data-slot="schedule-week-strip"]')
        const head = document.querySelector('[data-slot="schedule-head-row"]')
        return {
          strip:
            strip !== null &&
            strip.getClientRects().length > 0 &&
            strip.getBoundingClientRect().width > 0,
          head:
            head !== null &&
            head.getClientRects().length > 0 &&
            head.getBoundingClientRect().width > 0,
          shown: [...document.querySelectorAll('[data-slot="schedule-day"]')]
            .filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0)
            .map((el) => el.getAttribute('data-day')),
        }
      })
      expect(state.strip, 'the week strip is visible below @regular').toBe(true)
      expect(state.head, 'the header row is hidden below @regular').toBe(false)
      expect(state.shown).toEqual([TODAY])
      expectNoHorizontalOverflow(
        await page.horizontalOverflow(),
        'the phone week fits 390 px',
        PHONE,
      )
    })
  })

  describe(`${DESKTOP.name}, month`, () => {
    test('the month is 42 day cells in seven columns, with no overflow', async () => {
      const page = await open(DESKTOP, '?view=month')
      const lefts = await page.raw.evaluate(() =>
        [...document.querySelectorAll('[data-slot="schedule-month-day"]')].map(
          (el) => el.getBoundingClientRect().left,
        ),
      )
      expect(lefts).toHaveLength(42)
      expect(new Set(lefts.map((x) => Math.round(x * 2) / 2)).size).toBe(7)
      expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the month fits 1800 px', DESKTOP)
    })
  })
})
