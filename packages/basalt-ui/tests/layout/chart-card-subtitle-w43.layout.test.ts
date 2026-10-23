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

/** argo's key line verbatim in shape (the fixture's own 14-char subtitle is too short to wrap). */
const KEY = 'Dashed line: 30 d average · dot: new PR'
const LONG_KEY = `${KEY} · shaded band: estimate range across the last twelve weeks of sessions`
const host = (id: string): string => `[data-testid="w43-sub-${id}"]`
/** Sub-pixel slack on a measured edge, px. */
const EDGE_EPS = 0.5
/** A subtitle may wrap to this many lines, then ellipsis. */
const MAX_LINES = 2

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  cards: { widths: [], foldNote: [390] },
  w43Subtitle: true,
}

type Measure = {
  card: DOMRect
  title: DOMRect
  subtitle: DOMRect
  lineHeight: number
  display: string
  glyph: number
  note: number
}

layout('Wave 43 ChartCard subtitle at 390', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /** Measures the FIRST card/title/subtitle under `root`, after setting the subtitle text when given. */
  async function measure(root: string, text?: string): Promise<Measure> {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    return p.raw.evaluate(
      ({ root, sub, glyph, note, text }) => {
        const el = document.querySelector(root)
        const subtitle = el?.querySelector<HTMLElement>(sub)
        const title = el?.querySelector('h2, h3')
        const card = el?.firstElementChild
        if (!el || !subtitle || !title || !card) throw new Error('LAYOUT: missing card part')
        if (text !== undefined) subtitle.textContent = text
        const height = (q: string): number =>
          el.querySelector<HTMLElement>(q)?.getBoundingClientRect().height ?? 0
        return {
          card: card.getBoundingClientRect().toJSON(),
          title: title.getBoundingClientRect().toJSON(),
          subtitle: subtitle.getBoundingClientRect().toJSON(),
          lineHeight: Number.parseFloat(getComputedStyle(subtitle).lineHeight),
          display: getComputedStyle(subtitle).display,
          glyph: height(glyph),
          note: height(note),
        }
      },
      {
        root,
        sub: moduleClass('subtitle'),
        glyph: moduleClass('foldGlyph'),
        note: moduleClass('foldNote'),
        text,
      },
    )
  }

  test('the key line is visible, inside the card, and below the title', async () => {
    const m = await measure(host('chart-info'), KEY)
    expect(m.display).not.toBe('none')
    expect(m.subtitle.height).toBeGreaterThan(0)
    expect(m.subtitle.width).toBeGreaterThan(0)
    expect(m.subtitle.left).toBeGreaterThanOrEqual(m.card.left - EDGE_EPS)
    expect(m.subtitle.right).toBeLessThanOrEqual(m.card.right + EDGE_EPS)
    expect(m.subtitle.top).toBeGreaterThanOrEqual(m.title.bottom - EDGE_EPS)
  })

  test('with `info` the open bubble carries no folded note beside the visible subtitle', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const root = host('chart-info')
    await p.raw.focus(`${root} button[aria-label^="More information"]`)
    await p.box('bubble', `${root} [role="tooltip"]`)
    const notes = await p.boxes(`${root} ${moduleClass('foldNote')}`)
    expect(notes).toHaveLength(1)
    expect(notes[0]?.height).toBe(0)
  })

  test('with no `info` there is no fold glyph beside the visible subtitle', async () => {
    const m = await measure(host('chart-bare'))
    expect(m.subtitle.height).toBeGreaterThan(0)
    expect(m.glyph).toBe(0)
  })

  test('a long key wraps to at most two lines instead of overflowing', async () => {
    const m = await measure(host('chart-bare'), LONG_KEY)
    expect(m.subtitle.height).toBeGreaterThan(m.lineHeight)
    expect(m.subtitle.height).toBeLessThanOrEqual(MAX_LINES * m.lineHeight + EDGE_EPS)
    expect(m.subtitle.right).toBeLessThanOrEqual(m.card.right + EDGE_EPS)
  })

  test('a SHORT narrow ChartCard still folds: subtitle hidden, glyph (no info) shown', async () => {
    const m = await measure(host('short-bare'))
    expect(m.display).toBe('none')
    expect(m.glyph).toBeGreaterThan(0)
  })

  test('a SHORT narrow ChartCard with `info` shows the folded note in its bubble', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const root = host('short-info')
    await p.raw.focus(`${root} button[aria-label^="More information"]`)
    const note = (await p.boxes(`${root} ${moduleClass('foldNote')}`))[0]
    expect(note !== undefined && note.height > 0).toBe(true)
    expect(await p.computed(`${root} ${moduleClass('subtitle')}`, 'display')).toBe('none')
  })

  test('a narrow Section keeps its scope visible (W50): subtitle shown, no fold glyph', async () => {
    const m = await measure(host('section'))
    expect(m.display).not.toBe('none')
    expect(m.subtitle.height).toBeGreaterThan(0)
    expect(m.glyph).toBe(0)
  })

  test('a Section nested in a ChartCard body shows its own subtitle too (W50)', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const root = host('nested')
    const subtitles = `${root} ${moduleClass('subtitle')}`
    const [outer, inner] = await p.raw.evaluate(
      (q) => [...document.querySelectorAll(q)].map((el) => getComputedStyle(el).display),
      subtitles,
    )
    expect(outer).not.toBe('none')
    expect(inner).not.toBe('none')
  })
})
