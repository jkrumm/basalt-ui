/**
 * `KanbanCard` and the board recipe in real Chrome at 1800x1200 and 390x844 (docs/v3/issues/g1/
 * v3-cards-3-kanban.json). Geometry happy-dom cannot hold: the age and the menu never overlap
 * (they swap on a fine pointer, sit side by side on a coarse one), the menu is visible on coarse
 * without hover, a card is two tab stops, its focus ring paints, one board column below
 * `@regular`, a virtualised Done column, a menu that opens and returns focus, no sideways scroll,
 * and axe.
 *
 * Self-contained like `cards-group`: `fixture/cards-kanban.css` is compiled with the Tailwind CLI
 * into a temp directory and `fixture/cards-kanban-fixture.tsx` is bundled in memory.
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

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'cards-kanban-'))
  const cssOut = join(scratch, 'cards-kanban.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'cards-kanban.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`cards-kanban: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'cards-kanban-fixture.tsx')],
    target: 'browser',
    plugins: [
      {
        name: 'recipe',
        setup(builder) {
          builder.onResolve({ filter: /^@recipe\// }, (args) => ({
            path: join(
              REPO_ROOT,
              'apps',
              'playground',
              'src',
              'recipes',
              `${args.path.slice(8)}.tsx`,
            ),
          }))
        },
      },
    ],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`cards-kanban: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>cards-kanban</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme: 'light' | 'dark'): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    viewport,
    documentPath,
    'reduce',
    viewport === PHONE ? 'coarse' : 'fine',
  )
  await page.raw.waitForSelector('[data-slot="kanban-card"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

const SOLO = '[data-testid="kb-solo"]'
/** The opacity of the menu button's wrapper, which is what hides it at rest. */
const opacityOf = async (page: LayoutPage, selector: string): Promise<number> =>
  page.raw.evaluate((sel) => {
    const wrapper = document.querySelector(sel)?.parentElement
    return wrapper ? Number.parseFloat(getComputedStyle(wrapper).opacity) : Number.NaN
  }, selector)

/** The part of the trail that can be seen: a box with no opacity is not a collision. */
async function visibleBoxes(
  page: LayoutPage,
): Promise<{ age: DOMRect | null; menu: DOMRect | null }> {
  return page.raw.evaluate((solo) => {
    const rectOf = (sel: string): DOMRect | null => {
      const el = document.querySelector(`${solo} ${sel}`)
      if (!el) return null
      let node: Element | null = el
      while (node && node !== document.body) {
        if (Number.parseFloat(getComputedStyle(node).opacity) < 0.05) return null
        node = node.parentElement
      }
      return el.getBoundingClientRect()
    }
    return { age: rectOf('[data-slot="kanban-age"]'), menu: rectOf('[data-slot="kanban-menu"]') }
  }, SOLO)
}

const intersects = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

layout('KanbanCard and the board recipe', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const viewport of [DESKTOP, PHONE]) {
      const coarse = viewport === PHONE
      describe(`${viewport.name}, ${scheme}`, () => {
        test('the age and the menu never overlap, and the menu shows on coarse without hover', async () => {
          const page = await open(viewport, scheme)
          const rest = await visibleBoxes(page)
          expect(rest.age, 'age is visible at rest').not.toBeNull()
          if (coarse) {
            expect(rest.menu, 'the menu is visible on coarse without hover').not.toBeNull()
            expect(intersects(rest.age!, rest.menu!)).toBe(false)
            expect(rest.menu!.width).toBeGreaterThanOrEqual(43.5)
            expect(rest.menu!.height).toBeGreaterThanOrEqual(43.5)
            return
          }
          expect(rest.menu, 'the menu is hidden at rest on a fine pointer').toBeNull()
          await page.raw.hover(`${SOLO} [data-slot="kanban-card"]`)
          const hovered = await visibleBoxes(page)
          expect(hovered.menu, 'the menu shows on hover').not.toBeNull()
          expect(hovered.age, 'the age gives way to it').toBeNull()
          await page.raw.mouse.move(0, 0)
          await page.raw.focus(`${SOLO} [data-slot="kanban-menu"]`)
          const focused = await visibleBoxes(page)
          expect(focused.menu, 'the menu shows on focus').not.toBeNull()
          expect(focused.age, 'the age gives way on focus').toBeNull()
        })

        test('a card is two tab stops, and the stretched link paints its focus ring inside the card', async () => {
          const page = await open(viewport, scheme)
          const target = `${SOLO} [data-slot="kanban-target"]`
          const menu = `${SOLO} [data-slot="kanban-menu"]`
          await page.raw.keyboard.press('Tab') // keyboard modality, so :focus-visible matches
          await page.raw.focus(target)
          await page.settle()
          expect(await page.computed(target, 'outline-style')).toBe('solid')
          const ring = await page.box('target', target)
          const card = await page.box('card', `${SOLO} [data-slot="card"]`)
          expect(ring.box.left).toBeGreaterThanOrEqual(card.box.left)
          expect(ring.box.right).toBeLessThanOrEqual(card.box.right + 0.5)
          await page.raw.keyboard.press('Tab')
          expect(await page.raw.evaluate((sel) => document.activeElement?.matches(sel), menu)).toBe(
            true,
          )
          expect(await opacityOf(page, `${SOLO} [data-slot="kanban-menu"]`)).toBe(1)
          await page.raw.keyboard.press('Tab')
          const stray = await page.raw.evaluate(
            (solo) => document.activeElement?.closest(solo) !== null,
            SOLO,
          )
          expect(stray, 'a third tab stop inside the card').toBe(false)
        })

        test('Enter on the menu opens Move up, Move down and the other column; Escape returns focus', async () => {
          const page = await open(viewport, scheme)
          const menu = `${SOLO} [data-slot="kanban-menu"]`
          await page.raw.focus(menu)
          await page.raw.keyboard.press('Enter')
          await page.raw.waitForSelector('[role="menu"]')
          const items = await page.raw.$$eval('[role="menuitem"]', (els) =>
            els.map((el) => el.textContent),
          )
          expect(items).toEqual(['Move up', 'Move down', 'Move to Doing'])
          expect(await page.raw.evaluate(() => document.activeElement?.getAttribute('role'))).toBe(
            'menuitem',
          )
          await page.raw.keyboard.press('Escape')
          await page.raw.waitForSelector('[role="menu"]', { state: 'detached' })
          expect(await page.raw.evaluate((sel) => document.activeElement?.matches(sel), menu)).toBe(
            true,
          )
        })

        test('the board shows three columns wide and one on the phone; Done is virtualised', async () => {
          const page = await open(viewport, scheme)
          const shown = await page.raw.$$eval(
            '[data-testid="kb-board"] section',
            (els) => els.filter((el) => getComputedStyle(el).display !== 'none').length,
          )
          expect(shown).toBe(coarse ? 1 : 3)
          if (coarse) return
          const rendered = await page.count(
            '[data-testid="kb-board"] section[aria-label="Done"] [data-card-id]',
          )
          expect(rendered).toBeGreaterThan(0)
          expect(rendered).toBeLessThan(40)
        })

        test('the page does not scroll sideways', async () => {
          const page = await open(viewport, scheme)
          expectNoHorizontalOverflow(await page.horizontalOverflow(), 'cards-kanban', viewport)
        })

        test('axe finds nothing serious or critical', async () => {
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
      })
    }
  }
})
