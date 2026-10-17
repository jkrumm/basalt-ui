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

type Case = { name: string; root: string; hasDot: boolean }
const FOLD_CARD: Case = { name: 'ChartCard title', root: '[data-testid="fold-700"]', hasDot: false }
const STAT_CARD: Case = {
  name: 'StatCard caption + verdict dot',
  root: '[data-testid="info-ring-stat"]',
  hasDot: true,
}
const CASES: Case[] = [FOLD_CARD, STAT_CARD]
const triggerOf = (c: Case) => `${c.root} [data-info-trigger]`

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
    const hit = await p.box('trigger', triggerOf(FOLD_CARD))
    expect(hit.box.width).toBeGreaterThanOrEqual(24)
    expect(hit.box.height).toBeGreaterThanOrEqual(24)
  })

  for (const scheme of SCHEMES) {
    for (const c of CASES) {
      test(`in ${scheme}, the ring beside ${c.name} clears its neighbours, is not clipped and resolves to the accent`, async () => {
        const p = await open(scheme)
        await focusViaKeyboard(p, triggerOf(c))

        const m = await p.raw.evaluate(
          ({ sel, root, hasDot }) => {
            const need = <T extends Element>(found: T | null, what: string): T => {
              if (!found) throw new Error(`missing ${what} under ${root}`)
              return found
            }
            const button = need(document.querySelector<HTMLElement>(sel), 'info trigger')
            const title = need(document.querySelector(`${root} [data-widget-title]`), 'title')
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
            const dotLeft = hasDot
              ? need(
                  document.querySelector(`${root} [data-basalt-status-dot]`),
                  'status dot',
                ).getBoundingClientRect().left
              : null
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
                clippedBy.push(el.getAttribute('class') ?? el.tagName)
            }
            // A point inside the 24px box but outside the ring still belongs to the trigger.
            const outside = document.elementFromPoint(hit.left + 1, cy)
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
              dotLeft,
              clippedBy,
              hitsTrigger: outside === button,
              boxOutline: getComputedStyle(button).outlineStyle,
              ringStyle: ringStyle.outlineStyle,
              ringColor: ringStyle.outlineColor,
              accent,
            }
          },
          { sel: triggerOf(c), root: c.root, hasDot: c.hasDot },
        )

        expect(m.focused).toBe(true)
        expect(m.boxOutline).toBe('none')
        expect(m.ringStyle).toBe('solid')
        expect(m.reach).toBeGreaterThan(0)
        expect(m.ringColor).toBe(m.accent)
        expect(m.ring.left).toBeGreaterThanOrEqual(m.textRight)
        if (m.dotLeft !== null) expect(m.ring.right).toBeLessThanOrEqual(m.dotLeft)
        expect(m.clippedBy).toEqual([])
        expect(m.hitsTrigger).toBe(true)
      })
    }
  }
})
