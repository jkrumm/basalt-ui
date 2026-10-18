/**
 * Wave 38: argo's Strength-page `Section` shells render three type sizes, at 1440 and 390. The
 * count is `basalt-ui shot`'s craft-2 count (`src/cli/shot/measure.ts`): every distinct font size
 * of a visible element with a direct text node inside the component (SVG `<text>` included).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Viewport } from './harness'
import { DESKTOP_1440, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite)

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w38Strength: true,
}

type Sizes = { sizes: number[]; byText: Record<string, string[]> }

async function measure(viewport: Viewport, id: string): Promise<Sizes> {
  const page = await openFixture(SPEC, viewport)
  return page.raw.evaluate((testId) => {
    const root = document.querySelector(`[data-testid="${testId}"]`)
    if (!root) throw new Error(`FAILED: ${testId} did not render`)
    const byText: Record<string, string[]> = {}
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const own = Array.from(el.childNodes).filter(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      )
      if (own.length === 0) continue
      const key = String(parseFloat(s.fontSize))
      ;(byText[key] ??= []).push((own[0]?.textContent ?? '').trim().slice(0, 24))
    }
    return {
      sizes: Object.keys(byText)
        .map(Number)
        .toSorted((a, b) => a - b),
      byText,
    }
  }, id)
}

layout('argo Strength Section shell: three type sizes', () => {
  for (const id of ['w38-strength-plain', 'w38-strength-diagnostics']) {
    for (const viewport of [DESKTOP_1440, PHONE]) {
      test(`${id} at ${viewport.width}px`, async () => {
        const { sizes, byText } = await measure(viewport, id)
        expect(sizes).toEqual([11, 13, 15])
        if (id.endsWith('diagnostics')) expect(byText['11']).toContain('90 days')
      })
    }
  }
})
