/**
 * Expression cycle 12 kit fixes, the rule group (`v3-expr-12-kit-fixes` 8): at 390 a reference rule
 * never strikes a zone caption, and a bar value keeps off the rules. Fixture:
 * `fixture/kit-expr12-rules-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('rules')
})
afterAll(() => doc?.cleanup())

type Rect = { l: number; t: number; r: number; b: number }
type Part = { kind: 'caption' | 'label' | 'rule'; text: string; rect: Rect }

async function parts(viewport: Viewport): Promise<Part[]> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x12-rules"] svg.ts-chart')
  await page.settle()
  return page.raw.evaluate(() => {
    const svg = document.querySelector('[data-testid="x12-rules"] svg.ts-chart')!
    const rect = (e: Element, inkOnly = false) => {
      const r = e.getBoundingClientRect()
      // The ink of a digit or a capital: the text box's ascent above and descent below are air.
      return inkOnly
        ? { l: r.left, t: r.top + 3, r: r.right, b: r.bottom - 4 }
        : { l: r.left, t: r.top, r: r.right, b: r.bottom }
    }
    const out: Part[] = []
    for (const t of svg.querySelectorAll('text')) {
      const key = t.getAttribute('data-ts-key') ?? ''
      const kind = /^(ref|xref|xzone)-\d+-label/.test(key)
        ? 'caption'
        : /^(text-|bar-values)/.test(key)
          ? 'label'
          : null
      if (kind) out.push({ kind, text: t.textContent ?? '', rect: rect(t, true) })
    }
    for (const l of svg.querySelectorAll('line')) {
      const key = l.getAttribute('data-ts-key') ?? ''
      if (/^ref-\d+:/.test(key)) out.push({ kind: 'rule', text: key, rect: rect(l) })
    }
    return out
  }) as Promise<Part[]>
}

const meet = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

layout('a reference rule keeps off the zone captions and the bar values', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`no zone caption or bar value meets a rule at ${viewport.width}`, async () => {
      const found = await parts(viewport)
      const rules = found.filter((p) => p.kind === 'rule')
      expect(rules.length, 'the rules are drawn').toBe(3)
      const zones = found.filter((p) => p.kind === 'caption' && !/\d$/.test(p.text))
      expect(zones.length, 'a zone caption is drawn').toBeGreaterThan(0)
      const struck = [...zones, ...found.filter((p) => p.kind === 'label')].flatMap((p) =>
        rules.filter((r) => meet(p.rect, r.rect)).map((r) => `${p.text} meets ${r.text}`),
      )
      expect(struck).toEqual([])
    })
  }
})
