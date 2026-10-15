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

/** Heading top minus the sticky bar's bottom, after jumping to `#anchor-2`. */
async function headingBelowBar(shell: boolean): Promise<{ gap: number; barBottom: number }> {
  const page = await openFixture(specOf(shell), PHONE, '/')
  const result = await page.raw.evaluate(async (shell) => {
    const target = document.getElementById('anchor-2')
    if (!target) throw new Error('FAILED: #anchor-2 did not render')
    target.scrollIntoView({ behavior: 'instant' })
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    // Shell: the scrollport's own top edge (the bars are outside it). No shell: the sticky bar.
    const edge = document.querySelector(
      shell ? '[data-basalt-scrollport]' : '[data-basalt-page-bar]',
    )
    if (!edge) throw new Error('FAILED: no scrollport / PageBar rendered')
    const barBottom = shell ? edge.getBoundingClientRect().top : edge.getBoundingClientRect().bottom
    return { gap: target.getBoundingClientRect().top - barBottom, barBottom }
  }, shell)
  return result
}

layout('Section anchor vs the sticky PageBar', () => {
  test('shell-less: the anchored Section starts at or below the PageBar bottom', async () => {
    const { gap, barBottom } = await headingBelowBar(false)
    expect(barBottom).toBeGreaterThan(0)
    expect(gap).toBeGreaterThanOrEqual(0)
  })

  test('in a shell: the anchored Section still lands just under the scrollport top', async () => {
    const { gap } = await headingBelowBar(true)
    // The band is outside the scrollport — an offset that counted it would add the bar's height.
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThan(120)
  })
})
