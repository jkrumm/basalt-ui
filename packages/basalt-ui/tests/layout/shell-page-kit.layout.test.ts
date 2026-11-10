/**
 * Wave 37's shell half, measured in a real browser (UPSTREAM § w23-r1 / Wave 26): the page-summary
 * facts line never opens a wrapped line with `·`, the page `SyncButton` keeps a short age at 390 on
 * one line, the phone `Select` inset is on a step, a filter pill holds a long option name, and an
 * untitled `Section` is its tabs row alone.
 */
import { describeShell, acquireShellTarget } from './shell-target'
import { afterAll, expect } from 'bun:test'
import { S } from './shell-slots'
import type { FixtureSpec } from './fixture/spec'
import { DESKTOP_1440, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const specOf = (w37: NonNullable<FixtureSpec['w37']>): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w37,
})

describeShell(
  ready,
  'PageSummary facts at 390',
  ['page-summary-facts', 'page-summary-fact'],
  (test) => {
    test('the facts wrap, and the fact that opens a line has its dot outside the clip', async () => {
      const page = await openFixture(specOf({ summary: true }), PHONE)
      const m = await page.raw.evaluate(
        ({ factsSel, factSel }) => {
          const list = document.querySelector<HTMLElement>(factsSel)
          if (!list) throw new Error('LAYOUT: no facts list')
          const left = list.getBoundingClientRect().left
          const facts = [...list.querySelectorAll<HTMLElement>(factSel)]
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
        },
        { factsSel: S('page-summary-facts'), factSel: S('page-summary-fact') },
      )
      const tops = new Set(m.rows.map((r) => r.top))
      expect(tops.size, 'the facts wrap onto at least two lines at 390').toBeGreaterThan(1)
      expect(m.overflowX).toBe('clip')
      // The dot's box is the gap BEFORE its fact: for a fact flush with the list's edge that box is
      // outside the clip (invisible); for every other fact it is the preceding gap (visible).
      for (const r of m.rows) {
        expect(r.dotInset).toBeCloseTo(-m.gap, 1)
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
  },
)

describeShell(ready, 'SyncButton age below sm', ['sync-age-compact', 'sync-age-long'], (test) => {
  test('390: icon plus a short age, on one line, wider than the square', async () => {
    const page = await openFixture(specOf({ sync: true }), PHONE)
    const m = await page.raw.evaluate(
      ({ compactSel, longSel }) => {
        const btn = document.querySelector<HTMLElement>('[data-testid="w37-sync"] button')
        const age = btn?.querySelector<HTMLElement>(compactSel)
        if (!btn || !age) throw new Error('LAYOUT: no sync button / compact age')
        const long = btn.querySelector<HTMLElement>(longSel)
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
      },
      { compactSel: S('sync-age-compact'), longSel: S('sync-age-long') },
    )
    expect(m.text).toMatch(/^2\D/)
    expect(m.ageDisplay).not.toBe('none')
    expect(m.longDisplay).toBe('none')
    expect(m.btnW).toBeGreaterThan(m.btnH + 4)
    expect(m.ageH, 'the age is one line').toBeLessThan(24)
  })

  test('1440: only the long age shows', async () => {
    const page = await openFixture(specOf({ sync: true }), DESKTOP_1440)
    const d = await page.raw.evaluate((selector) => {
      const age = document.querySelector<HTMLElement>(selector)
      return age ? getComputedStyle(age).display : 'missing'
    }, S('sync-age-compact'))
    expect(d).toBe('none')
  })
})

describeShell(ready, 'phone Select inset at 390', ['select-input'], (test) => {
  test('the left inset is the ctl step, not 10.67 px', async () => {
    const page = await openFixture(specOf({ phoneSelect: true }), PHONE)
    const m = await page.raw.evaluate(
      (selector) => {
        const input = document.querySelector<HTMLInputElement>(selector)
        if (!input) throw new Error('LAYOUT: no phone Select input')
        const probe = document.createElement('div')
        probe.style.paddingLeft = 'var(--button-padding-x-ctl)'
        document.body.append(probe)
        const step = parseFloat(getComputedStyle(probe).paddingLeft)
        probe.remove()
        return { inset: parseFloat(getComputedStyle(input).paddingInlineStart), step }
      },
      `[data-testid="w37-phone-select"] ${S('select-input')}`,
    )
    expect(m.step).toBeGreaterThan(0)
    expect(m.inset).toBeCloseTo(m.step, 1)
    expect(Math.abs(m.inset - 10.67)).toBeGreaterThan(0.3)
  })
})

describeShell(ready, 'filter pill width', [], (test) => {
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

describeShell(ready, 'untitled Section', [], (test) => {
  test('390: the header is the tabs row alone, no heading box', async () => {
    const page = await openFixture(specOf({ untitled: true }), PHONE)
    const m = await page.raw.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="w37-untitled"] > div')
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
