/**
 * Wave 46 (SPEC § 6.13): the form row's geometry in real Chrome.
 * - Beside (container ≥ 600): the label's first line is centred on the field it names.
 * - Above (container < 600): the label is a plain line directly over the field, at both viewports,
 *   because the swap keys on the row's own width, not the viewport's.
 * - Every field a `FormRow` hosts (TextInput, NumberInput, PasswordInput, Textarea) is 32 px high
 *   with no `size` prop; an explicit `size="md"` wins and stays taller.
 * - Section rhythm: 12 between rows, 24 between sections, and the section legend is `md` 500.
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
  formsW46: true,
}

const rowBox = (width: number) => `[data-testid="form-row-${width}"]`

layout('Wave 46 FormRow geometry', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('1440: beside, the label centres on the field', async () => {
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

  test('1440 fine pointer: fields are 32 px high with no size prop; size="md" wins', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()
    // Border-box height of the field's own box: a PasswordInput's is the wrapper around the input.
    const h = async (id: string) =>
      (await p.raw.evaluate(`(() => {
        const input = document.querySelector('#${id}')
        const box = input.closest('.mantine-PasswordInput-input') ?? input
        return Math.round(parseFloat(getComputedStyle(box).height))
      })()`)) as number
    expect(await h('w46-name')).toBe(32)
    expect(await h('w46-weight')).toBe(32)
    expect(await h('w46-pass')).toBe(32)
    expect(await h('w46-md')).toBeGreaterThan(32)
    // An auto-height Textarea at one row is its line plus padding: never under the tier.
    expect(await h('w46-notes')).toBeGreaterThanOrEqual(32)
  })

  test('1440: 12 between rows, 24 between sections, legend md 500', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()
    const r = (await p.raw.evaluate(`(() => {
      const root = document.querySelector('[data-testid="w46-form"]')
      const groups = [...root.querySelectorAll('fieldset[data-section]')]
      const rowsOf = (g) => [...g.querySelectorAll(':scope > div > div')].map((r) => r.getBoundingClientRect())
      const [a, b] = groups
      const ra = rowsOf(a)
      const rb = rowsOf(b)
      const legend = getComputedStyle(a.querySelector('legend'))
      return {
        rowGap: Math.round(ra[1].top - ra[0].bottom),
        rowGapB: Math.round(rb[1].top - rb[0].bottom),
        sectionGap: Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom),
        legendWeight: legend.fontWeight,
        legendSize: legend.fontSize,
      }
    })()`)) as {
      rowGap: number
      rowGapB: number
      sectionGap: number
      legendWeight: string
      legendSize: string
    }
    expect(r.rowGap).toBe(12)
    expect(r.rowGapB).toBe(12)
    expect(r.sectionGap).toBe(24)
    expect(r.legendWeight).toBe('500')
  })

  test('coarse pointer: fields hold the 44 px hit floor', async () => {
    const p = await openFixture(SPEC, PHONE)
    await p.settle()
    const h = async (id: string) =>
      Math.round((await p.box(id, `[data-testid="${id}"]`)).box.height)
    expect(await h('w46-name')).toBe(44)
    expect(await h('w46-weight')).toBe(44)
  })

  test('1440: one row rule — FormRow and SettingsRow share the label column and the control cap', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()
    // The grid is the control cell's parent: FormRow's `fieldset`, SettingsRow's control div.
    const measure = async (inputId: string, cell: string) =>
      (await p.raw.evaluate(`(() => {
        const input = document.querySelector('#${inputId}')
        const grid = input.closest('${cell}').parentElement
        const i = input.getBoundingClientRect()
        const g = grid.getBoundingClientRect()
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
        return {
          width: Math.round(i.width),
          offset: Math.round(i.left - g.left),
          cap: Math.round(20 * rem),
          labelColumn: Math.round(15 * rem),
          gap: Math.round(parseFloat(getComputedStyle(grid).columnGap)),
        }
      })()`)) as { width: number; offset: number; cap: number; labelColumn: number; gap: number }
    const form = await measure('w46-name', 'fieldset')
    const settings = await measure('w46-sname', '[class*="control"]')
    for (const m of [form, settings]) {
      expect(m.width).toBe(m.cap)
      expect(m.offset).toBe(m.labelColumn + m.gap)
    }
    expect(settings.offset).toBe(form.offset)
  })

  test('1440: a described row keeps the row-to-row distance; the description tucks into the gap', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()
    const r = (await p.raw.evaluate(`(() => {
      const first = document.querySelector('#w46-name').closest('fieldset').parentElement.parentElement
      const second = document.querySelector('#w46-weight').closest('fieldset').parentElement.parentElement
      const hint = first.querySelector('[id$="-hint"]').getBoundingClientRect()
      const a = first.getBoundingClientRect()
      const b = second.getBoundingClientRect()
      return { rowGap: Math.round(b.top - a.bottom), hintToNext: Math.round(b.top - hint.bottom) }
    })()`)) as { rowGap: number; hintToNext: number }
    // Row boxes stay 12 apart (the same as two plain rows); the description sits 4 px into that gap.
    expect(r.rowGap).toBe(12)
    expect(r.hintToNext).toBe(8)
  })

  test('370 px container: the control sits stack-xs (4 px) below the description, not against it', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()
    const gap = (await p.raw.evaluate(`(() => {
      const root = document.querySelector('[data-testid="w46-stacked"]')
      const hint = root.querySelector('[id$="-hint"]').getBoundingClientRect()
      const input = root.querySelector('input').getBoundingClientRect()
      return Math.round(input.top - hint.bottom)
    })()`)) as number
    expect(gap).toBe(4)
  })
})
