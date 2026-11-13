/**
 * `FormField` and `FormRow` in real Chrome at 1440, 768, 390 and 320 (docs/v3/issues/g3/
 * v3-ctl-7-formfield.json), with long labels, descriptions and errors: no frame overflows sideways,
 * a row lays out by its OWN container (side by side from the `regular` tier, stacked below it), the
 * error region is mounted before any error, a coarse pointer gets a 44 px hit box on every interactive
 * element, and axe finds nothing serious or critical.
 *
 * The page is self-contained like `controls-view`: `fixture/form-field.css` is compiled with the
 * Tailwind CLI into a temp directory and `fixture/form-field-fixture.tsx` is bundled in memory.
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
const EMPTY_SPEC = { sections: [] } as FixtureSpec
/** The `regular` container tier of `css/tailwind.css`: 30rem. */
const REGULAR_PX = 480

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'form-field-'))
  const cssOut = join(scratch, 'form-field.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'form-field.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`form-field: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'form-field-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`form-field: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>form-field</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: 'fine' | 'coarse' = 'fine'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-testid="ff-kinds"] [data-slot="field"]')
  await page.settle()
  return page
}

const INTERACTIVE =
  'button, input:not([type="hidden"]), select, [role="switch"], [role="combobox"], [role="checkbox"], [role="slider"]'

layout('FormField and FormRow', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('no horizontal overflow, and every frame holds its fields', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'FormField', viewport)
        const wide = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-testid^="ff-"]')]
            .map((frame) => {
              const edge = frame.getBoundingClientRect().right
              const out = [...frame.querySelectorAll<HTMLElement>('*')].filter((el) => {
                const r = el.getBoundingClientRect()
                return r.width > 0 && r.right > edge + 0.5
              })
              return out.length === 0
                ? null
                : `${frame.dataset['testid']}: ${out
                    .slice(0, 3)
                    .map((el) => el.getAttribute('data-slot') ?? el.tagName)
                    .join(', ')}`
            })
            .filter((line) => line !== null),
        )
        expect(wide).toEqual([])
      })

      test('a row lays out by its own container: beside from the regular tier, stacked below', async () => {
        const page = await open(viewport)
        const rows = await page.raw.evaluate(() =>
          ['ff-wide', 'ff-narrow'].map((id) => {
            const group = document.querySelector<HTMLElement>(
              `[data-testid="${id}"] [data-slot="form-row-fields"]`,
            )!
            const [a, b] = [...group.children].map((el) => el.getBoundingClientRect())
            return {
              id,
              container: group.getBoundingClientRect().width,
              beside: Math.abs(a!.top - b!.top) < 1 && b!.left > a!.right - 1,
            }
          }),
        )
        for (const row of rows) {
          expect(row.beside).toBe(row.id === 'ff-wide' && row.container >= REGULAR_PX)
        }
      })

      test('the error region is mounted before any error and a long error wraps inside its field', async () => {
        const page = await open(viewport)
        const result = await page.raw.evaluate(() => {
          const clean = document.querySelector<HTMLElement>(
            '[data-testid="ff-clean"] [data-slot="field-error-region"]',
          )
          const errors = [
            ...document.querySelectorAll<HTMLElement>(
              '[data-testid="ff-kinds"] [data-slot="field-error"]',
            ),
          ]
          return {
            cleanLive: clean?.getAttribute('aria-live'),
            cleanText: clean?.textContent,
            cleanHeight: clean?.getBoundingClientRect().height,
            errors: errors.length,
            clipped: errors.filter((e) => e.scrollWidth > e.clientWidth + 1).length,
          }
        })
        expect(result.cleanLive).toBe('polite')
        expect(result.cleanText).toBe('')
        expect(result.cleanHeight).toBe(0)
        expect(result.errors).toBe(6)
        expect(result.clipped).toBe(0)
      })

      test('the required mark is a visible glyph, not colour alone', async () => {
        const page = await open(viewport)
        const mark = await page.raw.evaluate(() => {
          const el = document.querySelector<HTMLElement>('[data-slot="field-required"]')
          return el === null ? null : { text: el.innerText, visible: el.offsetWidth > 0 }
        })
        expect(mark).toEqual({ text: '*', visible: true })
      })

      test('a coarse pointer gets a 44 px hit box on every interactive element', async () => {
        const page = await open(viewport, 'coarse')
        const { short, checked } = await page.raw.evaluate((selector) => {
          const HIT = 44
          const short: string[] = []
          let checked = 0
          for (const input of document.querySelectorAll<HTMLElement>(selector)) {
            const el =
              input instanceof HTMLInputElement
                ? (input.closest<HTMLElement>('[data-slot="number-field"]') ?? input)
                : input
            // A checkbox's or a slider thumb's own input is Base UI's hidden form field; the role element is the tap target and is judged itself.
            if (
              input instanceof HTMLInputElement &&
              (input.type === 'checkbox' || input.type === 'range' || input.type === 'radio')
            )
              continue
            const r = el.getBoundingClientRect()
            if (r.width < 4 || r.height < 4) continue
            const style = getComputedStyle(el)
            if (style.visibility === 'hidden' || style.pointerEvents === 'none') continue
            const after = getComputedStyle(el, '::after')
            const aw = parseFloat(after.width)
            const ah = parseFloat(after.height)
            const w = Math.max(r.width, Number.isNaN(aw) || after.content === 'none' ? 0 : aw)
            const h = Math.max(r.height, Number.isNaN(ah) || after.content === 'none' ? 0 : ah)
            checked++
            if (h + 0.5 < HIT || (w + 0.5 < HIT && el.getAttribute('role') !== 'switch'))
              short.push(
                `${el.tagName.toLowerCase()}[${el.getAttribute('data-slot') ?? ''}] ${w.toFixed(0)}x${h.toFixed(0)}`,
              )
          }
          return { short, checked }
        }, INTERACTIVE)
        expect(checked).toBeGreaterThan(8)
        expect(short).toEqual([])
      })

      test('axe finds nothing serious or critical', async () => {
        const page = await open(viewport)
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
})
