/**
 * Wave 50: a `Section`'s scope line (its `subtitle`) stays visible text at 390. It used to fold into
 * an info glyph below a 480px card — a hover-only tooltip that covered the first row and never left
 * on touch. It now wraps under the title.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  cards: { widths: [], foldNote: [390] },
  w43Subtitle: true,
}

/** Sub-pixel slack on a measured edge, px. */
const EDGE_EPS = 0.5

layout('Wave 50 Section scope line at 390', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('the scope text is a visible, non-tooltip box that does not overlap the title', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="w43-sub-section"]')
      const title = root?.querySelector('h2')
      const scope = [...(root?.querySelectorAll('span') ?? [])].find((el) =>
        el.textContent?.startsWith('Dashed line'),
      )
      if (!root || !title || !scope) throw new Error('LAYOUT: missing section parts')
      const t = title.getBoundingClientRect()
      const s = scope.getBoundingClientRect()
      return {
        title: { bottom: t.bottom },
        scope: { top: s.top, width: s.width, height: s.height },
        display: getComputedStyle(scope).display,
        inTooltip: scope.closest('[role="tooltip"]') !== null,
        // The fold glyph stays in the DOM (the short-card fold still uses it) but must draw no box.
        glyphs: [...root.querySelectorAll('button[aria-label^="More information"]')].filter(
          (el) => el.getBoundingClientRect().height > 0,
        ).length,
      }
    })
    expect(m.display).not.toBe('none')
    expect(m.scope.width).toBeGreaterThan(0)
    expect(m.scope.height).toBeGreaterThan(0)
    expect(m.inTooltip).toBe(false)
    expect(m.scope.top).toBeGreaterThanOrEqual(m.title.bottom - EDGE_EPS)
    expect(m.glyphs).toBe(0)
  })
})
