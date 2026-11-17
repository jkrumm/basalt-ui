/**
 * `InfoHint` (docs/v3 primitives) in real Chrome at 1440, 768, 390 and 320: the glyph is a 44 px
 * target on a touch pointer, and its panel opens on a press and stays inside the viewport whether the
 * glyph sits at the left or the right edge. Asserted here because happy-dom has no geometry.
 *
 * Self-contained like `ui-base.layout.test.ts`: the fixture CSS is compiled with the Tailwind CLI and
 * the fixture bundled in memory, both inlined into one document.
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
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'info-hint-'))
  const cssOut = join(scratch, 'info-hint.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'info-hint.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`info-hint: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'info-hint-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`info-hint: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>info-hint</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'coarse')
  await page.raw.waitForSelector('[data-slot="info-hint"]')
  await page.settle()
  return page
}

layout('InfoHint', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('on a touch pointer the glyph answers a press 10 px outside its 24 px box', async () => {
        const page = await open(viewport)
        const hit = await page.raw.evaluate(() => {
          const el = document.querySelector<HTMLElement>(
            '[data-testid="hint-text"] [data-slot="info-hint"]',
          )!
          const r = el.getBoundingClientRect()
          const at = (x: number, y: number) => document.elementFromPoint(x, y) === el
          return {
            size: [r.width, r.height],
            below: at(r.left + r.width / 2, r.bottom + 9),
            beyond: at(r.left + r.width / 2, r.bottom + 12),
          }
        })
        expect(hit.size).toEqual([24, 24])
        expect(hit.below, 'the extended target').toBe(true)
        expect(hit.beyond, 'no further').toBe(false)
      })

      for (const key of ['Enter', 'Space']) {
        test(`${key} on the focused glyph opens the panel and Escape closes it`, async () => {
          const page = await open(viewport)
          await page.raw.focus('[data-testid="hint-text"] [data-slot="info-hint"]')
          expect(await page.raw.locator('[role="dialog"]').count(), 'focus alone').toBe(0)
          await page.raw.keyboard.press(key)
          await page.raw.waitForSelector('[role="dialog"]')
          await page.raw.keyboard.press('Escape')
          await page.raw.waitForSelector('[role="dialog"]', { state: 'detached' })
        })
      }

      for (const edge of ['left', 'right']) {
        test(`the panel opened at the ${edge} edge stays inside the viewport`, async () => {
          const page = await open(viewport)
          await page.raw.click(`[data-testid="hint-${edge}"] [data-slot="info-hint"]`)
          await page.raw.waitForSelector('[role="dialog"]')
          await page.settle()
          const box = await page.raw.evaluate(() => {
            const r = document
              .querySelector<HTMLElement>('[role="dialog"]')!
              .getBoundingClientRect()
            return { left: r.left, right: r.right, width: r.width, inner: window.innerWidth }
          })
          expect(box.left).toBeGreaterThanOrEqual(0)
          expect(box.right).toBeLessThanOrEqual(box.inner)
          expect(box.width).toBeLessThanOrEqual(320)
        })
      }
    })
  }
})
