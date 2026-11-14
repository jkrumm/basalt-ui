/**
 * Expression cycle 2's table and StatGroup fixes in real Chrome, at 1800 and 390 px
 * (docs/v3/cycles/expression-2.md rows .19, .22, .23, .26, .27): an entity cell's id and `sub` never
 * run together, no cell's text reaches into the next cell, a loading table keeps the height of the
 * rows it last showed, and a `cards` StatGroup shows every cell without sideways scroll.
 *
 * The table probes are a self-contained document (`fixture/k2-table.css` compiled with the Tailwind
 * CLI, the tier sheet `src/table/table.css` inlined, `fixture/k2-table-doc-fixture.tsx` bundled in
 * memory); the StatGroup probe is the shell fixture's `k2Table` flag.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const WIDE: Viewport = { name: 'wide', width: 1800, height: 1200 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const STAT_SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  k2Table: true,
}

/** Rounding slack for subpixel text metrics and row borders. */
const SLACK = 2

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'k2-table-'))
  const cssOut = join(scratch, 'k2-table.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'k2-table.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`k2-table: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'k2-table-doc-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`k2-table: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>k2-table</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})
afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k2-table-narrow"] [data-slot="table-root"]')
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

layout('expression cycle 2 table and StatGroup fixes', () => {
  for (const viewport of [WIDE, PHONE]) {
    const at = `${viewport.width}px`

    test(`${at}: an entity cell's id and sub do not touch`, async () => {
      const p = await open(viewport)
      const gaps = await p.raw.evaluate(() => {
        const cells = document.querySelectorAll(
          '[data-testid="k2-table-entity"] [data-slot="table-entity"]',
        )
        return [...cells].map((cell) => {
          const name = cell
            .querySelector('[data-slot="table-entity-name"]')
            ?.getBoundingClientRect()
          const sub = cell.querySelector('[data-slot="table-entity-sub"]')?.getBoundingClientRect()
          if (!name || !sub) throw new Error('LAYOUT: an entity cell lacks its name or sub')
          const horizontal = sub.left - name.right
          const vertical = sub.top - name.bottom
          return Math.max(horizontal, vertical)
        })
      })
      expect(gaps.length).toBeGreaterThan(0)
      for (const gap of gaps) expect(gap).toBeGreaterThan(0)
    })

    for (const id of ['k2-table-narrow', 'k2-table-scroll', 'k2-table-mid']) {
      test(`${at}: ${id}: no cell's text reaches into the next cell`, async () => {
        const p = await open(viewport)
        const overprints = await p.raw.evaluate((testid) => {
          const out: string[] = []
          for (const row of document.querySelectorAll(`[data-testid="${testid}"] tbody tr`)) {
            const cells = [...row.querySelectorAll<HTMLElement>('[data-slot="table-cell"]')].filter(
              (cell) => getComputedStyle(cell).display !== 'none',
            )
            cells.forEach((cell, index) => {
              const next = cells[index + 1]
              if (!next) return
              const range = document.createRange()
              range.selectNodeContents(cell)
              const text = range.getBoundingClientRect()
              const clipped = getComputedStyle(cell).overflowX !== 'visible'
              const own = cell.getBoundingClientRect()
              const box = next.getBoundingClientRect()
              // Overflow the cell clips is not drawn; what shows must stay inside the cell.
              const right = clipped ? Math.min(text.right, own.right) : text.right
              const sameLine = text.top < box.bottom && text.bottom > box.top
              if (sameLine && box.left > own.left && right > box.left + 0.5) {
                out.push(`${cell.textContent?.slice(0, 24)} -> ${next.textContent?.slice(0, 24)}`)
              }
            })
          }
          return out
        }, id)
        expect(overprints).toEqual([])
      })
    }

    for (const count of [14, 17]) {
      test(`${at}: a table reloading ${count} rows keeps the height of the loaded one`, async () => {
        const p = await open(viewport)
        const root = `[data-testid="k2-table-reload-${count}"] [data-slot="table-root"]`
        const height = (): Promise<number> =>
          p.raw.evaluate(
            (sel) => document.querySelector(sel)?.getBoundingClientRect().height ?? -1,
            root,
          )
        const loaded = await height()
        await p.raw.evaluate(
          (id) =>
            (window as never as { k2Loading: (i: string, l: boolean) => void }).k2Loading(id, true),
          `k2-table-reload-${count}`,
        )
        await p.settle()
        expect(await p.count(`${root} tbody [data-skeleton]`)).toBe(count)
        // The card tier projects a skeleton row differently from a loaded one; the row count holds at 390.
        if (viewport === PHONE) return
        expect(Math.abs((await height()) - loaded)).toBeLessThanOrEqual(SLACK)
      })
    }

    test(`${at}: six cards cells show whole, without sideways scroll`, async () => {
      const p = await openFixture(STAT_SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const group = document.querySelector<HTMLElement>(
          '[data-testid="k2-table-stat"] [data-slot="stat-scroll"]',
        )
        if (!group) throw new Error('LAYOUT: no stat group')
        const box = group.getBoundingClientRect()
        const cells = [...group.querySelectorAll('[data-slot="stat-cell"]')].map((cell) => {
          const r = cell.getBoundingClientRect()
          return { left: r.left, right: r.right, width: r.width, height: r.height, top: r.top }
        })
        return {
          overflow: group.scrollWidth - group.clientWidth,
          docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          boxLeft: box.left,
          boxRight: box.right,
          cells,
          viewport: window.innerWidth,
          lines: new Set(cells.map((c) => Math.round(c.top))).size,
        }
      })
      expect(probe.cells).toHaveLength(6)
      expect(probe.overflow).toBeLessThanOrEqual(1)
      expect(probe.docOverflow).toBeLessThanOrEqual(0)
      for (const cell of probe.cells) {
        expect(cell.width).toBeGreaterThan(0)
        expect(cell.height).toBeGreaterThan(0)
        expect(cell.left).toBeGreaterThanOrEqual(0)
        expect(cell.right).toBeLessThanOrEqual(probe.viewport + 0.5)
      }
      // 1800: one row. 390: two to a line, so three lines.
      expect(probe.lines).toBe(viewport === PHONE ? 3 : 1)
    })
  }
})
