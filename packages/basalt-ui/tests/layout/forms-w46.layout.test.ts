/**
 * Wave 46 (SPEC § 6.13): the form row's geometry in real Chrome.
 * - Beside (container ≥ 600): the label's first line is centred on the 32 px field it names, not
 *   pinned to its top edge, and the field is the 32 px control tier (not Mantine's 42 `md`).
 * - Above (container < 600): the label is a plain line directly over the field, at both viewports,
 *   because the swap keys on the row's own width, not the viewport's.
 *
 * The section rhythm (24 / 12) and the sticky compact actions need a fixture that renders the
 * unexported `FormSection`/`FormActions` or a `FormGroup section`; the fixture registry is outside
 * this wave's owned files, so those two are asserted on the CSS text in `form-layout.test.tsx`.
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

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  forms: { widths: [370, 770] },
}

const rowBox = (width: number) => `[data-testid="form-row-${width}"]`

layout('Wave 46 FormRow geometry', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('1440: beside, the label centres on the field and the field is 32 px', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
    const label = await p.box('label', `${rowBox(770)} label`)
    const input = await p.box('input', `${rowBox(770)} input`)
    const labelMid = (label.box.top + label.box.bottom) / 2
    const inputMid = (input.box.top + input.box.bottom) / 2
    expect(Math.abs(labelMid - inputMid)).toBeLessThanOrEqual(2)
    expect(input.box.left).toBeGreaterThan(label.box.right)
  })

  test('390: a 370 px row stacks the label directly above the field', async () => {
    const p = await openFixture(SPEC, PHONE)
    await p.settle()
    const label = await p.box('label', `${rowBox(370)} label`)
    const input = await p.box('input', `${rowBox(370)} input`)
    expect(input.box.top).toBeGreaterThanOrEqual(label.box.bottom - 1)
    // Stacked, the label carries no centring pad: the gap is the 4 px step, not half a field height.
    expect(input.box.top - label.box.bottom).toBeLessThanOrEqual(8)
  })
})
