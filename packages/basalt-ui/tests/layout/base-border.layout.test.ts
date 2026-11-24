/**
 * The default border color (css/generate.ts `borderRules`): a border with no color utility paints
 * the hairline token under the kit stylesheet, in both schemes, as the kit's own `border-border`
 * does. A bare `divide-y` takes it too. `outline` and `ring` are left at currentColor on purpose
 * (they mark focus), and this suite holds that as well so a change to it is deliberate.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'base-border-'))
  const cssOut = join(scratch, 'base-border.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'base-border.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`base-border: tailwind failed:\n${css.stderr.toString()}`)
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>base-border</title>` +
      `<style>${readFileSync(cssOut, 'utf8')}</style></head><body>` +
      `<div id="bare" class="border-b border-solid">bare</div>` +
      `<div id="named" class="border-b border-border">named</div>` +
      `<div id="grid" class="border-b border-grid">grid</div>` +
      `<div id="divide" class="divide-y"><p id="first">a</p><p id="second">b</p></div>` +
      `<div id="ring" class="ring-1">ring</div><div id="outline" class="outline">outline</div>` +
      `<script>window.basaltMountFixture = async () => {}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

type Colors = {
  bare: string
  named: string
  grid: string
  divide: string
  hairline: string
  ink: string
  outline: string
  outlineText: string
}

async function colorsIn(scheme: 'light' | 'dark'): Promise<Colors> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce', 'fine')
  await page.raw.evaluate((s) => {
    document.documentElement.setAttribute('data-theme', s)
  }, scheme)
  await page.settle()
  return page.raw.evaluate(() => {
    const style = (id: string): CSSStyleDeclaration =>
      getComputedStyle(document.getElementById(id)!)
    const probe = document.createElement('i')
    probe.style.color = 'var(--basalt-hairline)'
    document.body.append(probe)
    const hairline = getComputedStyle(probe).color
    probe.style.color = 'var(--basalt-ink)'
    const ink = getComputedStyle(probe).color
    probe.remove()
    return {
      bare: style('bare').borderBottomColor,
      named: style('named').borderBottomColor,
      grid: style('grid').borderBottomColor,
      divide: style('second').borderTopColor,
      hairline,
      ink,
      outline: style('outline').outlineColor,
      outlineText: style('outline').color,
    }
  })
}

layout('default border color', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a bare border and a divide are the hairline in ${scheme}`, async () => {
      const c = await colorsIn(scheme)
      expect(c.hairline).not.toBe(c.ink)
      expect(c.bare).toBe(c.hairline)
      expect(c.divide).toBe(c.hairline)
      expect(c.named).toBe(c.hairline)
      expect(c.grid).not.toBe(c.ink)
    })

    test(`outline keeps currentColor in ${scheme}`, async () => {
      const c = await colorsIn(scheme)
      expect(c.outline).toBe(c.outlineText)
      expect(c.outline).not.toBe(c.hairline)
    })
  }
})
