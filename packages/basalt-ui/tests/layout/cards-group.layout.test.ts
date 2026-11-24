/**
 * `StatGroup`, `StatCell` and `DataPanel` in real Chrome at 1440, 768, 390 and 320 (docs/v3/issues/
 * g1/v3-cards-1-statgroup.json). Geometry happy-dom cannot hold: every track of a strip aligned
 * across its cells, one height for a cell and a panel across every phase (a throwing slot and both
 * error kinds included), one left edge in a cell, a cards group that never scrolls sideways,
 * no sideways scroll, and axe.
 *
 * The page is self-contained like `cards-lists`: `fixture/cards-group.css` is compiled with the
 * Tailwind CLI into a temp directory and `fixture/cards-group-fixture.tsx` is bundled in memory,
 * both inlined into a document served beside the shared fixture.
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const PROBES = [
  'ready',
  'loading',
  'stale',
  'empty',
  'error',
  'forbidden',
  'not-found',
  'throw',
] as const
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TOLERANCE = 0.5

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'cards-group-'))
  const cssOut = join(scratch, 'cards-group.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'cards-group.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`cards-group: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'cards-group-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`cards-group: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>cards-group</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="stat-group"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  // The snap row measures after paint; give the observer a frame.
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

type Rect = { left: number; top: number; bottom: number; height: number; width: number }

/** The rects of every match of `selector` inside the probe `id`, in document order. */
async function rects(page: LayoutPage, id: string, selector: string): Promise<Rect[]> {
  return page.raw.evaluate(
    ({ id: probe, selector: sel }) =>
      [...document.querySelectorAll(`[data-testid="${probe}"] ${sel}`)].map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, top: r.top, bottom: r.bottom, height: r.height, width: r.width }
      }),
    { id, selector },
  )
}

/** The horizontal scroll geometry of one node (`page.scroll` reads the vertical one). */
async function horizontal(
  page: LayoutPage,
  selector: string,
): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.raw.evaluate((sel) => {
    const el = document.querySelector(sel)
    return { scrollWidth: el?.scrollWidth ?? 0, clientWidth: el?.clientWidth ?? 0 }
  }, selector)
}

const CELL = '[data-phase][role="group"]'

const near = (a: number, b: number, label: string): void => {
  expect(Math.abs(a - b), `${label}: ${a} against ${b}`).toBeLessThanOrEqual(TOLERANCE)
}

layout('StatGroup strip on a phone', () => {
  test('the strip lays out two stats per row at 390', async () => {
    const page = await open(PHONE)
    const cells = await rects(page, 'cg-strip-ready', CELL)
    expect(cells.length).toBeGreaterThanOrEqual(4)
    const rows = [...new Set(cells.map((c) => Math.round(c.top)))]
    near(cells[0]!.top, cells[1]!.top, 'the first two stats share a row')
    expect(cells[2]!.top, 'the third stat starts the next row').toBeGreaterThan(
      cells[0]!.bottom - 1,
    )
    expect(rows.length).toBe(Math.ceil(cells.length / 2))
  })
})

layout('StatGroup with an odd count on two tracks', () => {
  for (const probe of ['cg-strip-three', 'cg-cards-three'] as const) {
    test(`${probe} at 390: the first cell takes the first line, the other two share the second`, async () => {
      const page = await open(PHONE)
      const cells = await rects(page, probe, CELL)
      expect(cells).toHaveLength(3)
      const [first, second, third] = cells as [Rect, Rect, Rect]
      near(second.top, third.top, 'the last two cells share a line')
      expect(second.top, 'the last two cells are under the first').toBeGreaterThan(first.bottom - 1)
      near(second.width, third.width, 'the last two cells are as wide as each other')
      near(first.left, second.left, 'the first cell starts where the second does')
      near(first.left + first.width, third.left + third.width, 'both lines end at the same edge')
    })
  }
})

const DESKTOP_1800: Viewport = { name: 'desktop', width: 1800, height: 1200 }

/** One cell's box, its rules and its figure's overflow, read in the page. */
type RuledCell = {
  left: number
  top: number
  ruleLeft: string
  ruleTop: string
  ruleColor: string
  ink: string
  figureClipped: boolean
  base: string | null
  pill: string | null
}

async function ruledCells(
  page: LayoutPage,
  id: string,
): Promise<{ card: Rect; cells: RuledCell[] }> {
  return page.raw.evaluate((probe) => {
    const root = document.querySelector(`[data-testid="${probe}"]`)!
    const c = root.querySelector('[data-slot="card"]')!.getBoundingClientRect()
    const cells = [...root.querySelectorAll('[data-phase][role="group"]')].map((el) => {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const figure = el.querySelector('[data-slot="stat-figure"] > span') as HTMLElement
      return {
        left: r.left,
        top: r.top,
        ruleLeft: style.borderLeftWidth,
        ruleTop: style.borderTopWidth,
        ruleColor: style.borderLeftColor,
        ink: style.color,
        figureClipped: figure.scrollWidth > figure.clientWidth + 1,
        base: el.querySelector('[data-slot="stat-base"]')?.textContent ?? null,
        pill:
          el.querySelector('[data-slot="stat-base"] [data-slot="delta-badge"]')?.textContent ??
          null,
      }
    })
    return {
      card: { left: c.left, top: c.top, bottom: c.bottom, height: c.height, width: c.width },
      cells,
    }
  }, id)
}

layout('StatGroup strip: ruled cells at 1800 and 390', () => {
  for (const [viewport, perLine] of [
    [DESKTOP_1800, 4],
    [PHONE, 2],
  ] as const) {
    for (const scheme of [undefined, 'dark'] as const) {
      test(`${viewport.width}${scheme ? ` ${scheme}` : ''}: ${perLine} cells a line, a hairline only between cells`, async () => {
        const page = await open(viewport, scheme)
        const { card, cells } = await ruledCells(page, 'cg-strip-fleet')
        expect(cells).toHaveLength(4)
        const lines = [...new Set(cells.map((c) => Math.round(c.top)))]
        expect(lines, 'lines of cells').toHaveLength(4 / perLine)
        cells.forEach((cell, i) => {
          expect(cell.ruleLeft, `cell ${i} left rule`).toBe('1px')
          expect(cell.ruleTop, `cell ${i} top rule`).toBe('1px')
          expect(cell.ruleColor, `cell ${i} rule is a hairline, not ink`).not.toBe(cell.ink)
          // The first cell of a line sits 1 px left of the card, which clips its left rule.
          const first = i % perLine === 0
          if (first) near(cell.left, card.left - 1, `cell ${i} starts the line`)
          else
            expect(cell.left, `cell ${i} is ruled off its neighbour`).toBeGreaterThan(card.left + 1)
          // The first line's top rule is clipped the same way; a later line is ruled off the one above.
          if (i < perLine) near(cell.top, card.top - 1, `cell ${i} is on the first line`)
          else
            expect(cell.top, `cell ${i} is ruled off the line above`).toBeGreaterThan(card.top + 1)
        })
      })
    }

    test(`${viewport.width}: every figure is whole and every delta names its base under the pill`, async () => {
      const page = await open(viewport)
      const { cells } = await ruledCells(page, 'cg-strip-fleet')
      for (const [i, cell] of cells.entries()) {
        expect(cell.figureClipped, `cell ${i} figure is truncated`).toBe(false)
        if (i === 0) continue
        expect(cell.base ?? '', `cell ${i} base line`).toContain('vs prior 7 days')
        expect(cell.pill, `cell ${i} pill on the base line`).not.toBeNull()
        expect(cell.pill ?? '', `cell ${i} pill stays short`).not.toContain('vs prior')
      }
      const bases = await rects(page, 'cg-strip-fleet', '[data-slot="stat-base"]')
      const onFirstLine = bases.filter((b) => Math.abs(b.top - bases[0]!.top) <= 1)
      for (const base of onFirstLine)
        near(base.top, onFirstLine[0]!.top, 'base lines share a track')
    })
  }
})

layout('StatGroup, StatCell and DataPanel', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('a strip of six 230 px cells aligns every track across its cells', async () => {
        const page = await open(viewport)
        const cells = await rects(page, 'cg-strip-230', CELL)
        expect(cells).toHaveLength(6)
        for (const cell of cells) near(cell.width, 230, 'cell width')
        for (const slot of ['stat-caption', 'stat-figure', 'stat-foot']) {
          const tops = (await rects(page, 'cg-strip-230', `[data-slot="${slot}"]`)).map(
            (r) => r.top,
          )
          for (const top of tops) near(top, tops[0]!, `${slot} top`)
        }
        for (const cell of cells) {
          near(cell.top, cells[0]!.top, 'cell top')
          near(cell.height, cells[0]!.height, 'cell height')
        }
        // The rows: the recovery cell has three, the strain cell four, in shared tracks.
        const rows = await rects(page, 'cg-strip-230', '[data-slot="stat-row"]')
        const tracks = new Set(rows.map((r) => Math.round(r.top)))
        expect(tracks.size, 'rows of two cells share their tracks').toBe(4)
      })

      test('tracks that no cell fills collapse and tracks one cell fills are shared', async () => {
        const page = await open(viewport)
        const cells = await rects(page, 'cg-strip-230', CELL)
        const meters = await rects(page, 'cg-strip-230', '[data-slot="stat-meter"]')
        expect(meters).toHaveLength(1)
        const caption = (await rects(page, 'cg-strip-230', '[data-slot="stat-caption"]'))[0]!
        const figure = (await rects(page, 'cg-strip-230', '[data-slot="stat-figure"]'))[0]!
        near(figure.top, caption.top + 16, 'the figure track starts under a 16 px caption')
        near(figure.height, 36, 'figure track, at the hero size from @regular')
        // The top rule 1 and padding 12, caption 16, figure 36, the delta line 24 (Downstream's pill),
        // meter 4 + 34, chart 4 + 28, four rows of 20, foot 16, padding 12.
        near(
          cells[0]!.height,
          1 + 12 + 16 + 36 + 24 + 38 + 32 + 80 + 16 + 12,
          'a fully declared strip',
        )
      })

      for (const kind of ['strip', 'panel'] as const) {
        test(`${kind}: card height is equal across every phase, a throwing slot and both error kinds`, async () => {
          const page = await open(viewport)
          const heights: [string, number][] = []
          for (const probe of PROBES) {
            const [card] = await rects(page, `cg-${kind}-${probe}`, '[data-slot="card"]')
            heights.push([probe, card!.height])
          }
          const first = heights[0]![1]
          for (const [probe, height] of heights) {
            expect(
              Math.abs(height - first),
              `${kind} ${probe} is ${height}px, ready is ${first}px`,
            ).toBeLessThanOrEqual(TOLERANCE)
          }
        })
      }

      test('strip: a loading cell has the height of its ready cell, cell for cell', async () => {
        const page = await open(viewport)
        const ready = await rects(page, 'cg-strip-ready', CELL)
        for (const probe of PROBES) {
          const cells = await rects(page, `cg-strip-${probe}`, CELL)
          expect(cells, probe).toHaveLength(ready.length)
          cells.forEach((cell, i) => near(cell.height, ready[i]!.height, `${probe} cell ${i}`))
        }
      })

      test('every phase prints its own data-phase', async () => {
        const page = await open(viewport)
        const printed = await page.raw.evaluate(() =>
          ['ready', 'loading', 'stale', 'empty', 'error'].map((phase) => [
            phase,
            document
              .querySelector(`[data-testid="cg-strip-${phase}"] [data-phase]`)
              ?.getAttribute('data-phase'),
            document
              .querySelector(`[data-testid="cg-panel-${phase}"] [data-slot="card-phase"]`)
              ?.getAttribute('data-phase'),
          ]),
        )
        for (const [phase, cell, panel] of printed) {
          expect(cell).toBe(phase)
          expect(panel).toBe(phase)
        }
      })

      test('one left edge: caption, figure, rows and foot start together in every cell', async () => {
        const page = await open(viewport)
        for (const id of ['cg-strip-230', 'cg-cards']) {
          const edges = await page.raw.evaluate(
            ({ id: probe }) =>
              [
                ...document.querySelectorAll(`[data-testid="${probe}"] [data-phase][role="group"]`),
              ].map((cell) =>
                [
                  '[data-slot="stat-caption"] > p:first-child',
                  '[data-slot="stat-figure"] > span:first-child',
                  '[data-slot="stat-row"] > div > span:first-child',
                  '[data-slot="stat-foot"] > p',
                ].flatMap((sel) =>
                  [...cell.querySelectorAll(sel)].map((el) => [
                    sel,
                    el.getBoundingClientRect().left,
                  ]),
                ),
              ),
            { id },
          )
          for (const cell of edges as [string, number][][]) {
            const first = cell[0]![1]
            for (const [sel, left] of cell) near(left, first, `${id} ${sel}`)
          }
        }
      })

      test('the strip wraps instead of scrolling the page', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(
          await page.horizontalOverflow(),
          'the group composites',
          viewport,
        )
      })

      test('the cards variant aligns its bands across tiles on one line', async () => {
        const page = await open(viewport)
        const cells = await rects(page, 'cg-cards', CELL)
        expect(cells).toHaveLength(5)
        const onFirstLine = cells.filter((c) => Math.abs(c.top - cells[0]!.top) <= TOLERANCE)
        const figures = await rects(page, 'cg-cards', '[data-slot="stat-figure"]')
        for (const figure of figures.slice(0, onFirstLine.length)) {
          near(figure.top, figures[0]!.top, 'figure top on the first line')
        }
        for (const cell of onFirstLine) near(cell.height, onFirstLine[0]!.height, 'cell height')
      })

      test('the cards group never scrolls sideways and adds no tab stop', async () => {
        const page = await open(viewport)
        for (const id of ['cg-cards', 'cg-cards-one']) {
          const selector = `[data-testid="${id}"] [data-slot="stat-scroll"]`
          const info = await horizontal(page, selector)
          expect(info.scrollWidth > info.clientWidth + 1, `${id} scrolls`).toBe(false)
          expect(await page.raw.getAttribute(selector, 'tabindex'), `${id} tabindex`).toBeNull()
          expect(await page.raw.getAttribute(selector, 'role'), `${id} role`).toBe('group')
        }
      })

      for (const [scheme, color] of [
        [undefined, 'rgb(11, 107, 203)'],
        ['dark', 'rgb(90, 169, 240)'],
      ] as const) {
        test(`a swatch paints its series color${scheme ? ` in ${scheme}` : ''}, before the label`, async () => {
          const page = await open(viewport, scheme)
          const swatches = await page.raw.evaluate(() =>
            [...document.querySelectorAll('[data-slot="stat-swatch"]')].map((el) => {
              const label = el.nextElementSibling?.getBoundingClientRect()
              const box = el.getBoundingClientRect()
              return {
                fill: getComputedStyle(el).backgroundColor,
                size: [box.width, box.height],
                before: label !== undefined && box.right <= label.left,
              }
            }),
          )
          expect(swatches.length).toBeGreaterThan(0)
          for (const s of swatches) expect(s).toEqual({ fill: color, size: [8, 8], before: true })
        })
      }

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}, in every state`, async () => {
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
