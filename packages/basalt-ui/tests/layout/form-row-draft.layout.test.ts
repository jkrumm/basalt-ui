/**
 * A restored draft never hides a `FormRow` (docs/v3/issues/cycles/v3-state-1-draft-formrow.json,
 * state cycle 1 finding state-1.4). The record reopens in a `Sheet` on first mount, `useFormDraft`
 * restores an amount that differs from the server value, and every field of the row keeps a
 * non-zero height at 1800 and 390 px.
 *
 * The cause was Chrome's: a size container (`@container`) that is a direct child of a `<fieldset>`
 * lost the layout of its whole subtree (0 px, normal computed `display`) when one commit, after a
 * forced layout, both showed the "Draft restored" line before it and changed an input inside it.
 * `FormRow` was that container, inside the form's `Fieldset`; its container is now its own fieldset.
 *
 * Self-contained like `form-field`: `fixture/form-row-draft.css` is compiled with the Tailwind CLI
 * into a temp directory and `fixture/form-row-draft-fixture.tsx` is bundled in memory.
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
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const WIDE_1800: Viewport = { name: 'wide desktop', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [WIDE_1800, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'form-row-draft-'))
  const cssOut = join(scratch, 'form-row-draft.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'form-row-draft.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`form-row-draft: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'form-row-draft-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`form-row-draft: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>form-row-draft</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

layout('a restored draft in a Sheet leaves every FormRow field visible', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px`, async () => {
      const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'no-preference', 'fine')
      await page.raw.waitForFunction(
        () =>
          document.querySelector('output')?.textContent === 'Draft restored from this device.' &&
          document.querySelector<HTMLInputElement>('[data-slot="number-field"] input')?.value ===
            '€4,321.00',
      )
      await page.settle()
      const heights = await page.raw.evaluate(() => {
        const row = document.querySelector<HTMLElement>('[data-slot="form-row"]')!
        const fields = [...row.querySelectorAll<HTMLElement>('[data-slot="field"]')]
        return {
          row: row.getBoundingClientRect().height,
          fields: fields.map((field) => ({
            label: field.querySelector('[data-slot="field-label"]')?.textContent ?? '',
            height: field.getBoundingClientRect().height,
          })),
        }
      })
      expect(heights.fields.map((f) => f.label)).toEqual(['Status', 'Amount (EUR)'])
      expect(heights.row).toBeGreaterThan(0)
      expect(heights.fields.filter((f) => f.height === 0)).toEqual([])
    })
  }
})
