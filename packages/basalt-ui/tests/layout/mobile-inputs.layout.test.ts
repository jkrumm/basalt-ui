/**
 * One rule for fields and buttons, in real Chrome: a phone computes the density's own text size and
 * control height, the same as a desktop at 1800 (Issue 3298). The 16 px iOS floor and the 44 px control
 * are gone; touch reach is a 44 px `::after` hit area around a Button, a Select trigger and a
 * DatePicker. A bare text field cannot own a pseudo-element, so its hit target is its own box. The
 * rule comes from the sheets an app loads: `tailwind.css` (utilities and tokens) and `styles.css`,
 * which both import `css/touch.css`.
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
  Button: '[data-testid="m-button"]',
  'Button sm': '[data-testid="m-button-sm"]',
} as const

/** Controls that own a `::after`: their hit target is the box united with it. A bare field has none. */
const WITH_HIT_AREA = new Set(['Select trigger', 'DatePicker field', 'Button', 'Button sm'])

type Metrics = { fontSize: number; height: number; hitHeight: number; hitWidth: number }

const metrics = (page: LayoutPage, selector: string): Promise<Metrics> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) throw new Error(`mobile-inputs: no ${sel}`)
    const host = el.closest<HTMLElement>('[data-slot]') ?? el
    const box = host.getBoundingClientRect()
    const after = getComputedStyle(host, '::after')
    const aw = after.content === 'none' ? 0 : Number.parseFloat(after.width) || 0
    const ah = after.content === 'none' ? 0 : Number.parseFloat(after.height) || 0
    return {
      fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
      height: box.height,
      hitHeight: Math.max(box.height, ah),
      hitWidth: Math.max(box.width, aw),
    }
  }, selector)

const FINE_DESKTOP = { name: 'desktop 1800', width: 1800, height: 1200 }

layout('tailwind.css: a phone keeps the desktop size of every field and button', () => {
  for (const [name, selector] of Object.entries(SELECTORS)) {
    test(`${name}: font size and height at ${PHONE.width} (coarse) equal those at 1800 (fine)`, async () => {
      const desktop = await openFixture(EMPTY_SPEC, FINE_DESKTOP, appDocument, 'reduce', 'fine')
      await desktop.raw.waitForSelector('[data-testid="m-input"]')
      const fine = await metrics(desktop, selector)
      const phone = await openFixture(EMPTY_SPEC, PHONE, appDocument, 'reduce', 'coarse')
      await phone.raw.waitForSelector('[data-testid="m-input"]')
      const coarse = await metrics(phone, selector)
      expect(coarse.fontSize).toBe(fine.fontSize)
      expect(coarse.fontSize).toBeLessThan(16)
      expect(coarse.height).toBeCloseTo(fine.height, 0)
    })
  }

  for (const name of WITH_HIT_AREA) {
    test(`${name}: a 44 x 44 hit target at ${PHONE.width}`, async () => {
      const page = await openFixture(EMPTY_SPEC, PHONE, appDocument, 'reduce', 'coarse')
      await page.raw.waitForSelector('[data-testid="m-input"]')
      const m = await metrics(page, SELECTORS[name as keyof typeof SELECTORS])
      expect(m.hitHeight).toBeGreaterThanOrEqual(44 - 0.5)
      expect(m.hitWidth).toBeGreaterThanOrEqual(44 - 0.5)
    })
  }

  test('the control height token is the density height on both pointers', async () => {
    for (const pointer of ['fine', 'coarse'] as const) {
      const page = await openFixture(EMPTY_SPEC, PHONE, appDocument, 'reduce', pointer)
      await page.raw.waitForSelector('[data-testid="m-input"]')
      const ctl = await page.raw.evaluate(() => {
        const root = getComputedStyle(document.documentElement)
        return {
          ctl:
            Number.parseFloat(root.getPropertyValue('--basalt-ctl-h')) *
            Number.parseFloat(root.fontSize),
          hit: root.getPropertyValue('--basalt-hit').trim(),
        }
      })
      expect(ctl.ctl, pointer).toBe(28)
      expect(ctl.hit, pointer).toBe(pointer === 'coarse' ? '2.75rem' : '1.5rem')
    }
  })
})

layout('styles.css: no floor on bare elements', () => {
  const sizeOf = (page: LayoutPage, id: string): Promise<number> =>
    page.raw.evaluate(
      (sel) => Number.parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize),
      `#${id}`,
    )

  for (const pointer of POINTERS) {
    test(`${pointer}: an inline 12 px style stays 12 px and a bare input keeps the browser size`, async () => {
      const page = await openFixture(EMPTY_SPEC, PHONE, stylesDocument, 'reduce', pointer)
      expect(await sizeOf(page, 'bare-inline')).toBe(12)
      expect(await sizeOf(page, 'bare-input')).toBeLessThan(16)
    })
  }
})
