/**
 * `Section id` anchors clear the sticky `PageBar` — with and without a shell.
 *
 * Without a shell the document scrolls and `PageBar` is sticky at its top, so an anchored heading
 * lands under the bar unless `Section`'s scroll-margin adds the bar's published height
 * (`--basalt-page-bar-h`). Inside `BasaltShell` the bars sit outside the scrollport and the offset
 * stays the clearance token alone. happy-dom answers neither: the scroll-into-view geometry is the
 * browser's.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite)

const specOf = (shell: boolean): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  anchor: { shell },
})

/**
 * COLD LOAD at `/#anchor-2`: no scrollIntoView from the test. Returns the heading's distance below
 * the bar (shell-less) or below the scrollport's top (shell), plus the resolved clearance token.
 */
async function coldLoadGap(
  shell: boolean,
): Promise<{ gap: number; edge: number; clearance: number }> {
  const page = await openFixture(specOf(shell), PHONE, '/#anchor-2')
  return page.raw.evaluate(async (inShell) => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    const target = document.getElementById('anchor-2')
    // Shell: the scrollport's own top edge (the bars are outside it). No shell: the sticky bar.
    const el = document.querySelector(
      inShell ? '[data-basalt-scrollport]' : '[data-basalt-page-bar]',
    )
    if (!target || !el) throw new Error('FAILED: #anchor-2 or the bar / scrollport did not render')
    const rect = el.getBoundingClientRect()
    const edge = inShell ? rect.top : rect.bottom
    const probe = document.createElement('div')
    probe.style.marginTop = 'var(--vx-space-sticky-header-clearance)'
    document.body.append(probe)
    const clearance = parseFloat(getComputedStyle(probe).marginTop)
    probe.remove()
    return { gap: target.getBoundingClientRect().top - edge, edge, clearance }
  }, shell)
}

layout('Section anchor vs the sticky PageBar', () => {
  test('shell-less cold load: the anchored Section sits within [0, clearance + 4] below the bar', async () => {
    const { gap, edge, clearance } = await coldLoadGap(false)
    expect(edge).toBeGreaterThan(0)
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(clearance + 4)
  })

  test('in a shell: the anchored Section sits within [0, clearance + 4] below the scrollport top', async () => {
    const { gap, clearance } = await coldLoadGap(true)
    // The band is outside the scrollport — an offset that counted it would add the bar's height.
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(clearance + 4)
  })
})
