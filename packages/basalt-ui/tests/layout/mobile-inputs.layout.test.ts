/**
 * One rule for input text, in real Chrome: a coarse primary pointer computes 16 px on Input, Textarea,
 * a Select trigger, a Combobox and a DatePicker field, and the control height is the token's 44 px; a
 * fine pointer keeps the control size (`text-sm`) and `--basalt-ctl-h`. The rule comes from the
 * sheets an app loads: `tailwind.css` (utilities and tokens) and `styles.css`, which both import
 * `css/touch.css`; a bare `<input>` under `styles.css` alone follows the same pointer axis.
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
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const POINTERS = ['fine', 'coarse'] as const

let appDocument = ''
let stylesDocument = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

function tailwind(input: string, output: string): string {
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync([cli, '--input', input, '--output', output], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (css.exitCode !== 0)
    throw new Error(`mobile-inputs: tailwind failed:\n${css.stderr.toString()}`)
  return readFileSync(output, 'utf8')
}

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'mobile-inputs-'))
  const appCss = tailwind(join(FIXTURE_DIR, 'mobile-inputs.css'), join(scratch, 'app.css'))
  const stylesCss = tailwind(join(FIXTURE_DIR, 'mobile-styles.css'), join(scratch, 'styles.css'))
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'mobile-inputs-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`mobile-inputs: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const head = (css: string): string =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<style>${css}</style></head>`
  appDocument = serveDocument(
    `${head(appCss)}<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  stylesDocument = serveDocument(
    `${head(stylesCss)}<body><div id="root"></div>` +
      `<script>window.basaltMountFixture = () => {}</script>` +
      `<input id="bare-input" aria-label="Bare" /><textarea id="bare-textarea" aria-label="Bare"></textarea>` +
      `<select id="bare-select" aria-label="Bare"><option>One</option></select>` +
      `<input id="bare-inline" aria-label="Inline" style="font-size: 12px" /></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

const SELECTORS = {
  Input: '[data-testid="m-input"]',
  'Input sm': '[data-testid="m-input-sm"]',
  Textarea: '[data-testid="m-textarea"]',
  'Select trigger': '[data-testid="m-select"]',
  Combobox: '[data-testid="m-combobox"] input, input[data-testid="m-combobox"]',
  'DatePicker field': '[data-slot="date-picker"]',
} as const

type Metrics = { fontSize: number; height: number; probe: number; ctl: number }

const metrics = (page: LayoutPage, selector: string): Promise<Metrics> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) throw new Error(`mobile-inputs: no ${sel}`)
    const box = (el.closest<HTMLElement>('[data-slot]') ?? el).getBoundingClientRect()
    const root = getComputedStyle(document.documentElement)
    return {
      fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
      height: box.height,
      probe: Number.parseFloat(
        getComputedStyle(document.querySelector<HTMLElement>('[data-testid="probe-text-sm"]')!)
          .fontSize,
      ),
      ctl:
        Number.parseFloat(root.getPropertyValue('--basalt-ctl-h')) *
        Number.parseFloat(root.fontSize),
    }
  }, selector)

layout('tailwind.css: input text and control height by pointer', () => {
  for (const pointer of POINTERS) {
    describe(`${pointer} pointer at ${PHONE.width}`, () => {
      for (const [name, selector] of Object.entries(SELECTORS)) {
        test(`${name}`, async () => {
          const page = await openFixture(EMPTY_SPEC, PHONE, appDocument, 'reduce', pointer)
          await page.raw.waitForSelector('[data-testid="m-input"]')
          const m = await metrics(page, selector)
          if (pointer === 'coarse') {
            expect(m.fontSize).toBe(16)
            expect(m.height).toBeGreaterThanOrEqual(44)
            expect(m.ctl).toBe(44)
          } else {
            expect(m.fontSize).toBeLessThan(16)
            expect(m.ctl).toBeLessThan(44)
            if (name === 'Textarea') expect(m.height).toBeGreaterThanOrEqual(m.ctl)
            else if (name !== 'Input sm') expect(m.height).toBeCloseTo(m.ctl, 0)
          }
        })
      }
      test('the control size on a fine pointer is the text-sm size', async () => {
        const page = await openFixture(EMPTY_SPEC, PHONE, appDocument, 'reduce', pointer)
        await page.raw.waitForSelector('[data-testid="m-input"]')
        const m = await metrics(page, SELECTORS.Input)
        expect(m.fontSize).toBe(pointer === 'coarse' ? 16 : m.probe)
      })
    })
  }
})

layout('styles.css: the same rule on bare elements', () => {
  const sizeOf = (page: LayoutPage, id: string): Promise<number> =>
    page.raw.evaluate(
      (sel) => Number.parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize),
      `#${id}`,
    )

  test('a coarse pointer computes 16 px, an inline style cannot lower it', async () => {
    const page = await openFixture(EMPTY_SPEC, PHONE, stylesDocument, 'reduce', 'coarse')
    for (const id of ['bare-input', 'bare-textarea', 'bare-select', 'bare-inline']) {
      expect(await sizeOf(page, id), id).toBe(16)
    }
  })

  test('a fine pointer keeps the browser size: no floor', async () => {
    const page = await openFixture(EMPTY_SPEC, PHONE, stylesDocument, 'reduce', 'fine')
    expect(await sizeOf(page, 'bare-input')).toBeLessThan(16)
    expect(await sizeOf(page, 'bare-inline')).toBe(12)
  })
})
