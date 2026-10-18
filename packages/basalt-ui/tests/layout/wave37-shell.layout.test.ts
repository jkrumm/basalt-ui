/**
 * Wave 37's shell half, measured in a real browser (UPSTREAM § w23-r1 / Wave 26): the page-summary
 * facts line never opens a wrapped line with `·`, the page `SyncButton` keeps a short age at 390 on
 * one line, the phone `Select` inset is on a step, a filter pill holds a long option name, and an
 * untitled `Section` is its tabs row alone.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { DESKTOP_1440, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite)

const specOf = (w37: NonNullable<FixtureSpec['w37']>): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w37,
})

layout('PageSummary facts at 390', () => {
  test('the facts wrap, and the fact that opens a line has its dot outside the clip', async () => {
    const page = await openFixture(specOf({ summary: true }), PHONE)
    const m = await page.raw.evaluate(() => {
      const list = document.querySelector<HTMLElement>('[data-page-summary-facts]')
      if (!list) throw new Error('LAYOUT: no facts list')
      const left = list.getBoundingClientRect().left
      const facts = [...list.querySelectorAll<HTMLElement>('[data-page-summary-fact]')]
      const gap = parseFloat(getComputedStyle(list).columnGap)
      return {
        overflowX: getComputedStyle(list).overflowX,
        gap,
        rows: facts.map((f) => {
          const r = f.getBoundingClientRect()
          const dot = getComputedStyle(f, '::before')
          return {
            top: Math.round(r.top),
            left: r.left - left,
            dotInset: parseFloat(dot.insetInlineStart),
          }
        }),
      }
    })
    const tops = new Set(m.rows.map((r) => r.top))
    expect(tops.size, 'the facts wrap onto at least two lines at 390').toBeGreaterThan(1)
    expect(m.overflowX).toBe('clip')
    // The dot is drawn half a gap LEFT of its fact: for a fact flush with the list's edge that is
    // outside the clip (invisible); for every other fact it is inside the preceding gap (visible).
    for (const r of m.rows) {
      expect(r.dotInset).toBeCloseTo(-m.gap / 2, 1)
      const leading = r.left < 1
      const dotX = r.left + r.dotInset
      if (leading) expect(dotX, 'a line-leading dot is clipped').toBeLessThan(0)
      else expect(dotX, 'a mid-line dot sits in the gap').toBeGreaterThanOrEqual(0)
    }
    // Every line has exactly one line-leading fact.
    const leadingPerLine = [...tops].map(
      (t) => m.rows.filter((r) => r.top === t && r.left < 1).length,
    )
    expect(leadingPerLine.every((n) => n === 1)).toBe(true)
  })
})

layout('SyncButton age below sm', () => {
  test('390: icon plus a short age, on one line, wider than the square', async () => {
    const page = await openFixture(specOf({ sync: true }), PHONE)
    const m = await page.raw.evaluate(() => {
      const btn = document.querySelector<HTMLElement>('[data-testid="w37-sync"] button')
      const age = btn?.querySelector<HTMLElement>('[data-sync-age="compact"]')
      if (!btn || !age) throw new Error('LAYOUT: no sync button / compact age')
      const long = btn.querySelector<HTMLElement>('[class*="age_"]:not([data-sync-age])')
      const b = btn.getBoundingClientRect()
      const a = age.getBoundingClientRect()
      return {
        text: age.textContent,
        btnW: b.width,
        btnH: b.height,
        ageH: a.height,
        ageDisplay: getComputedStyle(age).display,
        longDisplay: long ? getComputedStyle(long).display : 'none',
      }
    })
    expect(m.text).toBe('2 m')
    expect(m.ageDisplay).not.toBe('none')
    expect(m.longDisplay).toBe('none')
    expect(m.btnW).toBeGreaterThan(m.btnH + 4)
    expect(m.ageH, 'the age is one line').toBeLessThan(24)
  })

  test('1440: only the long age shows', async () => {
    const page = await openFixture(specOf({ sync: true }), DESKTOP_1440)
    const d = await page.raw.evaluate(() => {
      const age = document.querySelector<HTMLElement>('[data-sync-age="compact"]')
      return age ? getComputedStyle(age).display : 'missing'
    })
    expect(d).toBe('none')
  })
})

layout('phone Select inset at 390', () => {
  test('the left inset is the ctl step, not 10.67 px', async () => {
    const page = await openFixture(specOf({ phoneSelect: true }), PHONE)
    const m = await page.raw.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="w37-phone-select"] .mantine-Select-input',
      )
      if (!input) throw new Error('LAYOUT: no phone Select input')
      const probe = document.createElement('div')
      probe.style.paddingLeft = 'var(--button-padding-x-ctl)'
      document.body.append(probe)
      const step = parseFloat(getComputedStyle(probe).paddingLeft)
      probe.remove()
      return { inset: parseFloat(getComputedStyle(input).paddingInlineStart), step }
    })
    expect(m.step).toBeGreaterThan(0)
    expect(m.inset).toBeCloseTo(m.step, 1)
    expect(Math.abs(m.inset - 10.67)).toBeGreaterThan(0.3)
  })
})

layout('filter pill width', () => {
  test('1440: a long option name is held past the old 15rem cap', async () => {
    const page = await openFixture(specOf({ pill: true }), DESKTOP_1440)
    const m = await page.raw.evaluate(() => {
      const pill = document.querySelector<HTMLElement>('[data-testid="w37-pill"] button')
      if (!pill) throw new Error('LAYOUT: no pill')
      return {
        w: pill.getBoundingClientRect().width,
        rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      }
    })
    expect(m.w).toBeGreaterThan(15 * m.rem)
    expect(m.w).toBeLessThanOrEqual(24 * m.rem + 1)
  })
})

layout('untitled Section', () => {
  test('390: the header is the tabs row alone, no heading box', async () => {
    const page = await openFixture(specOf({ untitled: true }), PHONE)
    const m = await page.raw.evaluate(() => {
      const root = document.querySelector<HTMLElement>(
        '[data-testid="w37-untitled"] [role="group"]',
      )
      if (!root) throw new Error('LAYOUT: no untitled section group')
      return {
        headings: root.querySelectorAll('h2, h3').length,
        firstChildH: (root.firstElementChild as HTMLElement).getBoundingClientRect().height,
      }
    })
    expect(m.headings).toBe(0)
    // The tabs' own height (the 44 px coarse-pointer tier at 390) and nothing above or below it.
    expect(m.firstChildH).toBeLessThanOrEqual(48)
  })
})
