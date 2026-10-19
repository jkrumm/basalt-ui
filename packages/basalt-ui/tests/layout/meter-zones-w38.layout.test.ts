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

  test('at 390 the names never touch, and the holding zone stays', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const { full, short } = await names(p)
    expect(full).toContain('Optimal')
    // "Caution" / "Caut." need 25px beside "Optimal" and "Danger"; the 164px track leaves 22.
    expect(full.length + short.length).toBeGreaterThanOrEqual(3)
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
})
