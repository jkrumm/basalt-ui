/**
 * Wave 38: argo's ACWR load Meter keeps every zone named — "Caution" is the full name wherever it
 * fits beside its neighbours (a name may borrow free room past its own span) and never drops to
 * nothing while its `short` fits.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w38Zones: true,
}

const names = (p: Awaited<ReturnType<typeof openFixture>>) =>
  p.raw.evaluate(() => {
    const host = document.querySelector('[data-testid="w38-acwr-strip"]')
    const shown = (el: Element) => !el.hasAttribute('data-hidden')
    return {
      full: [...(host?.querySelectorAll('[data-meter-zone-label]') ?? [])]
        .filter(shown)
        .map((e) => e.textContent),
      short: [...(host?.querySelectorAll('[data-meter-zone-short]') ?? [])]
        .filter(shown)
        .map((e) => e.textContent),
    }
  })

layout('ACWR zone names (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('at 1440 all four zones are named', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const { full, short } = await names(p)
    expect(full.length + short.length).toBe(4)
  })

  test('at 390 the exact name set shows: Caution hides (the accepted geometry limit), the holding zone stays', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    // "Caut." needs 25px beside "Optimal" and "Danger"; the 164px track leaves 22. argo gives it a short.
    expect(await names(p)).toEqual({ full: ['Low', 'Optimal', 'Danger'], short: [] })
    const boxes = await p.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="w38-acwr-strip"] [data-meter-zone-band] > span')]
        .filter((e) => !e.hasAttribute('data-hidden'))
        .map((e) => e.getBoundingClientRect())
        .toSorted((a, b) => a.left - b.left)
        .map((r) => ({ left: r.left, right: r.right })),
    )
    for (const [n, b] of boxes.entries()) {
      const prev = boxes[n - 1]
      if (prev) expect(b.left).toBeGreaterThanOrEqual(prev.right - 0.5)
    }
  })

  test('at 1440 where the full name fits, Caution is not abbreviated', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const { full, short } = await names(p)
    expect(short).toEqual([])
    expect(full).toContain('Caution')
  })

  const SHORT_CASES: [string, { full: string[]; short: string[] }][] = [
    ['w38-zshort-170', { full: ['Optimal'], short: ['Und', 'Cau', 'Dan'] }],
    ['w38-zshort-210', { full: ['Under', 'Optimal', 'Caution', 'Danger'], short: [] }],
  ]
  test.each(SHORT_CASES)(
    '%s: the short fallback runs as one register, or not at all',
    async (id, expected) => {
      const p = await openFixture(spec, DESKTOP_1440)
      await p.settle()
      const shown = await p.raw.evaluate((id) => {
        const host = document.querySelector(`[data-testid="${id}"]`)
        const pick = (sel: string) =>
          [...(host?.querySelectorAll(sel) ?? [])]
            .filter((e) => !e.hasAttribute('data-hidden'))
            .map((e) => e.textContent)
        return { full: pick('[data-meter-zone-label]'), short: pick('[data-meter-zone-short]') }
      }, id)
      expect(shown).toEqual(expected)
    },
  )
})
