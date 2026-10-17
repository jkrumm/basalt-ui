/**
 * Layout invariant for the `info` glyph's keyboard focus ring: the ring hugs the 11px glyph and
 * never paints over the title text beside it, while the trigger stays a 24x24 hit target
 * (WCAG 2.5.8). The ring used to be drawn on the 24px box, which reaches 6.5px past the glyph.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const FIXTURE_PATH = '/'
const REDUCED_MOTION = 'reduce'
/** `fine` keeps touch emulation off, so the trigger is measured at its dense (non-coarse) size. */
const FINE_POINTER = 'fine'
type Scheme = 'light' | 'dark'
const SCHEMES: Scheme[] = ['light', 'dark']

type Case = { name: string; root: string; title: string; dot: boolean }
const CASES: Case[] = [
  {
    name: 'ChartCard title',
    root: '[data-testid="fold-700"]',
    title: '[data-widget-title]',
    dot: false,
  },
  {
    name: 'StatCard caption + verdict dot',
    root: '[data-testid="info-ring-stat"]',
    title: 'h3',
    dot: true,
  },
]
const triggerOf = (c: Case) => `${c.root} [data-info-trigger]`
const MATRIX = SCHEMES.flatMap((scheme) =>
  CASES.map((c) => [scheme, c.name, c] as [Scheme, string, Case]),
)

const specFor = (colorScheme: Scheme): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  cards: { widths: [], foldNote: [700] },
  infoRing: true,
})

/**
 * Focuses `selector` the way a keyboard user arrives: via Tab. A bare `focus()` after a pointer
 * interaction does not match `:focus-visible`, so the ring would never draw.
 */
async function focusViaKeyboard(p: LayoutPage, selector: string): Promise<void> {
  await p.raw.focus(selector)
  await p.raw.keyboard.press('Shift+Tab')
  await p.raw.keyboard.press('Tab')
}

async function open(scheme: Scheme): Promise<LayoutPage> {
  const p = await openFixture(
    specFor(scheme),
    DESKTOP_1440,
    FIXTURE_PATH,
    REDUCED_MOTION,
    FINE_POINTER,
  )
  await p.settle()
  return p
}

layout('info glyph focus ring', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('the trigger keeps its 24x24 hit box', async () => {
    const p = await open('light')
    const hit = await p.box('trigger', triggerOf(CASES[0]!))
    expect(hit.box.width).toBeGreaterThanOrEqual(24)
    expect(hit.box.height).toBeGreaterThanOrEqual(24)
  })

  test.each(MATRIX)(
    'in %s, the ring beside %s clears its neighbours, is not clipped and resolves to the accent',
    async (scheme, _name, c) => {
      const p = await open(scheme)
      await focusViaKeyboard(p, triggerOf(c))

      const m = await p.raw.evaluate(
        ({ sel, root, titleSel }) => {
          const button = document.querySelector<HTMLElement>(sel)
          const title = document.querySelector<HTMLElement>(`${root} ${titleSel}`)
          if (!button || !title) throw new Error('no info trigger or title')
          const ringStyle = getComputedStyle(button, '::before')
          const size = parseFloat(ringStyle.width)
          const reach = parseFloat(ringStyle.outlineWidth)
          const hit = button.getBoundingClientRect()
          const cx = hit.left + hit.width / 2
          const cy = hit.top + hit.height / 2
          const ring = {
            left: cx - size / 2 - reach,
            right: cx + size / 2 + reach,
            top: cy - size / 2 - reach,
            bottom: cy + size / 2 + reach,
          }
          const range = document.createRange()
          range.selectNodeContents(title)
          const text = range.getBoundingClientRect()
          const word = document.querySelector(`${root} [data-verdict-word]`)
          const dot = word?.parentElement?.firstElementChild?.getBoundingClientRect()
          const clippedBy: string[] = []
          for (let el = button.parentElement; el; el = el.parentElement) {
            const { overflowX, overflowY } = getComputedStyle(el)
            if (overflowX === 'visible' && overflowY === 'visible') continue
            const r = el.getBoundingClientRect()
            if (
              ring.left < r.left ||
              ring.right > r.right ||
              ring.top < r.top ||
              ring.bottom > r.bottom
            )
              clippedBy.push(String(el.className))
          }
          const probe = document.createElement('i')
          probe.style.color = 'var(--vx-accent)'
          document.body.append(probe)
          const accent = getComputedStyle(probe).color
          probe.remove()
          return {
            focused: document.activeElement === button && button.matches(':focus-visible'),
            reach,
            ring,
            textRight: text.right,
            dotLeft: dot?.left ?? null,
            clippedBy,
            boxOutline: getComputedStyle(button).outlineStyle,
            ringStyle: ringStyle.outlineStyle,
            ringColor: ringStyle.outlineColor,
            accent,
          }
        },
        { sel: triggerOf(c), root: c.root, titleSel: c.title },
      )

      expect(m.focused).toBe(true)
      expect(m.boxOutline).toBe('none')
      expect(m.ringStyle).toBe('solid')
      expect(m.reach).toBeGreaterThan(0)
      expect(m.ringColor).toBe(m.accent)
      expect(m.ring.left).toBeGreaterThanOrEqual(m.textRight)
      if (c.dot) {
        expect(m.dotLeft).not.toBeNull()
        expect(m.ring.right).toBeLessThanOrEqual(m.dotLeft ?? 0)
      }
      expect(m.clippedBy).toEqual([])
    },
  )
})
