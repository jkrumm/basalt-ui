/**
 * Wave 38: argo's `Section` subtitle sits at 12 (`xs`) and the reading backlog shell holds three
 * sizes, at 1440 and 390. The count is `basalt-ui shot`'s craft-2 count (`src/cli/shot/measure.ts`): every distinct font size
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
  w38Subtitle: true,
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

layout('argo Section subtitle and summary sizes', () => {
  for (const viewport of [DESKTOP_1440, PHONE]) {
    test(`subtitle and count are 12, title 15, body 13 at ${viewport.width}px`, async () => {
      const { sizes, byText } = await measure(viewport, 'w38-subtitle-head')
      expect(sizes).toEqual([12, 13, 15])
      // Under 480px the subtitle folds into the info glyph, so only the count is left at 12.
      if (viewport === DESKTOP_1440) expect(byText['12']).toContain('Trailing 30 days')
    })

    test(`an unclassed summary Text and an actions caption are 11 at ${viewport.width}px`, async () => {
      const { sizes, byText } = await measure(viewport, 'w38-subtitle-bare')
      expect(sizes).toEqual([11, 13, 15])
      expect(byText['11']).toEqual(expect.arrayContaining(['48,204 requests', 'p95 210 ms']))
    })

    test(`reading backlog holds 12/13/15 at ${viewport.width}px`, async () => {
      const { sizes, byText } = await measure(viewport, 'w38-subtitle-backlog')
      expect(sizes).toEqual([12, 13, 15])
      expect(byText['13']).toContain('12 books · 3,400 pages')
    })
  }
})
