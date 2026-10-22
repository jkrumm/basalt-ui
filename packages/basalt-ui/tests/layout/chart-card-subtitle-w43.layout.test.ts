/**
 * Wave 43: argo's strength `Estimated 1RM` ChartCard (title, `info`, and a `subtitle` that carries
 * the line/dot key) at 390. The subtitle used to fold into the info glyph below a 480px card, so the
 * dashed lines and PR dots were unlabelled on a phone. A chart card keeps it on its own line under
 * the title at every width; only the SHORT-height fold (a card under 280px) still removes it.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  moduleClass,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const CARD = '[data-testid="fold-390"]'
/** argo's key line verbatim in shape (the fixture's own 14-char subtitle is too short to wrap). */
const KEY = 'Dashed line: 30 d average · dot: new PR'
const LONG_KEY = `${KEY} · shaded band: estimate range across the last twelve weeks of sessions`
/** Sub-pixel slack on a measured edge, px. */
const EDGE_EPS = 0.5
/** A subtitle may wrap to this many lines, then ellipsis. */
const MAX_LINES = 2

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  cards: { widths: [], foldNote: [390] },
}

type Measure = {
  card: DOMRect
  title: DOMRect
  subtitle: DOMRect
  lineHeight: number
  display: string
  glyphVisible: boolean
}

layout('Wave 43 ChartCard subtitle at 390', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  async function measure(text: string): Promise<Measure> {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    return p.raw.evaluate(
      ({ root, sub, fold, text }) => {
        const host = document.querySelector(root)
        const subtitle = host?.querySelector<HTMLElement>(sub)
        const title = host?.querySelector('h3')
        const card = host?.querySelector('[data-basalt-chart-card]')
        if (!host || !subtitle || !title || !card) throw new Error('LAYOUT: missing card part')
        subtitle.textContent = text
        const glyph = host.querySelector<HTMLElement>(fold)
        return {
          card: card.getBoundingClientRect().toJSON(),
          title: title.getBoundingClientRect().toJSON(),
          subtitle: subtitle.getBoundingClientRect().toJSON(),
          lineHeight: Number.parseFloat(getComputedStyle(subtitle).lineHeight),
          display: getComputedStyle(subtitle).display,
          glyphVisible: glyph !== null && glyph.getBoundingClientRect().height > 0,
        }
      },
      { root: CARD, sub: moduleClass('subtitle'), fold: moduleClass('foldGlyph'), text },
    )
  }

  test('the key line is visible, inside the card, and below the title', async () => {
    const m = await measure(KEY)
    expect(m.display).not.toBe('none')
    expect(m.subtitle.height).toBeGreaterThan(0)
    expect(m.subtitle.width).toBeGreaterThan(0)
    expect(m.subtitle.left).toBeGreaterThanOrEqual(m.card.left - EDGE_EPS)
    expect(m.subtitle.right).toBeLessThanOrEqual(m.card.right + EDGE_EPS)
    expect(m.subtitle.top).toBeGreaterThanOrEqual(m.title.bottom - EDGE_EPS)
    expect(m.glyphVisible).toBe(false)
  })

  test('a long key wraps to at most two lines instead of overflowing', async () => {
    const m = await measure(LONG_KEY)
    expect(m.subtitle.height).toBeGreaterThan(m.lineHeight)
    expect(m.subtitle.height).toBeLessThanOrEqual(MAX_LINES * m.lineHeight + EDGE_EPS)
    expect(m.subtitle.right).toBeLessThanOrEqual(m.card.right + EDGE_EPS)
  })
})
