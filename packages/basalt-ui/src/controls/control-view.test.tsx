/**
 * `ControlView`: the override cue is text and a reset that restores the global, in every
 * presentation; one renderer per kind, with its `as` hints.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ControlPresentationContext, ControlView } from './control-view'
import type { ControlPresentation } from './contract'
import { memoryHandle, widgetHandle } from './control-view.handles'
import { spec } from './spec'

afterEach(cleanup)

const RANGES = [
  { value: '24h', label: 'Last 24 h' },
  { value: '7d', label: 'Last 7 days' },
]

const show = (node: React.ReactElement, presentation?: ControlPresentation) =>
  render(
    presentation === undefined ? (
      node
    ) : (
      <ControlPresentationContext value={presentation}>{node}</ControlPresentationContext>
    ),
  )

describe('the override cue', () => {
  for (const presentation of ['pill', 'row', 'inline'] as const) {
    test(`${presentation}: an override shows Local and the inherited value as text`, () => {
      const handle = widgetHandle('w.latency.range', '24h', {
        kind: 'enum',
        options: RANGES,
        override: '7d',
      })
      const { container } = show(<ControlView spec={spec(handle, 'Range')} />, presentation)
      const view = container.querySelector<HTMLElement>('[data-slot="control-view"]')!
      expect(view.dataset['source']).toBe('override')
      const badge = container.querySelector<HTMLElement>('[data-slot="override-badge"]')!
      expect(badge.textContent).toBe('Local')
      expect(badge.title).toBe('Overrides global: Last 24 h')
      expect(container.querySelector('[data-slot="override-reset"]')).not.toBeNull()
    })
  }

  test('row prints the sentence and the Use global button', () => {
    const handle = widgetHandle('w.latency.range', '24h', {
      kind: 'enum',
      options: RANGES,
      override: '7d',
    })
    const { container, getByRole } = show(<ControlView spec={spec(handle, 'Range')} />, 'row')
    expect(container.querySelector('[data-slot="override-note"]')?.textContent).toBe(
      'Overrides global: Last 24 h',
    )
    expect(getByRole('button', { name: 'Use global' }).textContent).toBe('Use global')
  })

  test('inline and pill name the reset for its control', () => {
    const handle = widgetHandle('w.latency.range', '24h', {
      kind: 'enum',
      options: RANGES,
      override: '7d',
    })
    const { getByRole } = show(<ControlView spec={spec(handle, 'Range')} />, 'inline')
    expect(getByRole('button', { name: 'Reset Range to global' })).toBeTruthy()
  })

  test('Reset restores the global and the cue goes away', () => {
    const handle = widgetHandle('w.latency.range', '24h', {
      kind: 'enum',
      options: RANGES,
      override: '7d',
    })
    const { container, getByRole } = show(<ControlView spec={spec(handle, 'Range')} />, 'inline')
    expect(container.textContent).toContain('Last 7 days')
    fireEvent.click(getByRole('button', { name: 'Reset Range to global' }))
    expect(handle.clears.count).toBe(1)
    expect(handle.isDefault).toBe(true)
    expect(container.querySelector('[data-slot="override-badge"]')).toBeNull()
    expect(container.querySelector('[data-slot="override-reset"]')).toBeNull()
    expect(container.textContent).toContain('Last 24 h')
    expect(
      container.querySelector<HTMLElement>('[data-slot="control-view"]')!.dataset['source'],
    ).toBe('inherited')
  })

  test('a widget that follows the global shows no cue; moving the global moves it', () => {
    const handle = widgetHandle('w.latency.range', '24h', { kind: 'enum', options: RANGES })
    const { container } = show(<ControlView spec={spec(handle, 'Range')} />, 'inline')
    expect(container.querySelector('[data-slot="override-badge"]')).toBeNull()
    act(() => {
      handle.setGlobal('7d')
    })
    expect(container.textContent).toContain('Last 7 days')
  })

  test('a plain field has source own and no cue', () => {
    const handle = memoryHandle('range', '24h', { kind: 'enum', options: RANGES })
    const { container } = show(<ControlView spec={spec(handle, 'Range')} />)
    const view = container.querySelector<HTMLElement>('[data-slot="control-view"]')!
    expect(view.dataset['source']).toBe('own')
    expect(view.dataset['presentation']).toBe('pill')
    expect(container.querySelector('[data-slot="override-badge"]')).toBeNull()
  })
})

describe('one renderer per kind', () => {
  test('enum: a select by default, a segmented control with as', () => {
    const handle = memoryHandle('range', '24h', { kind: 'enum', options: RANGES })
    const a = show(<ControlView spec={spec(handle, 'Range')} />)
    expect(a.container.querySelector('[data-slot="select"]')).not.toBeNull()
    a.unmount()
    const b = show(<ControlView spec={spec(handle, 'Range', { as: 'segmented' })} />)
    expect(b.container.querySelector('[data-slot="segmented"]')).not.toBeNull()
    fireEvent.click(b.getByRole('button', { name: 'Last 7 days' }))
    expect(handle.writes).toEqual(['7d'])
  })

  test('enum facets print their counts', () => {
    const handle = memoryHandle('range', '24h', { kind: 'enum', options: RANGES })
    const { container } = show(
      <ControlView
        spec={spec(handle, 'Range', {
          as: 'segmented',
          facets: [
            { value: '24h', count: 12 },
            { value: '7d', count: 3 },
          ],
        })}
      />,
    )
    expect(container.textContent).toContain('Last 24 h (12)')
  })

  test('multi: a combobox by default, segmented with as', () => {
    const handle = memoryHandle<readonly string[]>('regions', [], {
      kind: 'multi',
      options: [
        { value: 'eu', label: 'EU' },
        { value: 'us', label: 'US' },
      ] as never,
    })
    const a = show(<ControlView spec={spec(handle, 'Regions')} />)
    expect(a.container.querySelector('[data-slot="combobox"]')).not.toBeNull()
    a.unmount()
    const b = show(<ControlView spec={spec(handle, 'Regions', { as: 'segmented' })} />)
    fireEvent.click(b.getByRole('button', { name: 'EU' }))
    expect(handle.writes).toEqual([['eu']])
  })

  test('multi: Escape closes the list and the popover and never writes', async () => {
    const handle = memoryHandle<readonly string[]>('regions', [], {
      kind: 'multi',
      options: [
        { value: 'eu', label: 'EU' },
        { value: 'us', label: 'US' },
      ] as never,
    })
    const { container, getByRole, queryByRole } = show(
      <ControlView spec={spec(handle, 'Regions')} />,
    )
    const input = getByRole('combobox')
    await act(async () => {
      input.focus()
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    await act(async () => {
      fireEvent.click(getByRole('option', { name: 'EU' }))
    })
    expect(handle.writes).toEqual([['eu']])
    // First Escape closes the list; the second is the one that reached the store.
    for (let press = 0; press < 2; press += 1) {
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Escape' })
      })
    }
    expect(queryByRole('listbox')).toBeNull()
    expect(handle.writes).toEqual([['eu']])
    expect(container.querySelector('[data-slot="combobox-chip"]')?.textContent).toBe('EU')
  })

  test('boolean: a switch by default, a checkbox with as', () => {
    const handle = memoryHandle('live', false, { kind: 'boolean' })
    const a = show(<ControlView spec={spec(handle, 'Live')} />)
    fireEvent.click(a.getByRole('switch', { name: 'Live' }))
    expect(handle.writes).toEqual([true])
    a.unmount()
    const b = show(<ControlView spec={spec(handle, 'Live', { as: 'checkbox' })} />)
    expect(b.getByRole('checkbox', { name: 'Live' })).toBeTruthy()
  })

  test('number: a slider with as and bounds, a number field without them', () => {
    const bounded = memoryHandle('n', 5, { kind: 'number', bounds: { min: 0, max: 10 } })
    const a = show(<ControlView spec={spec(bounded, 'Count', { as: 'slider' })} />)
    expect(a.container.querySelector('[data-slot="slider"]')).not.toBeNull()
    a.unmount()
    const open = memoryHandle('n', 5, { kind: 'number' })
    const b = show(<ControlView spec={spec(open, 'Count', { as: 'slider' })} />)
    expect(b.container.querySelector('[data-slot="number-field"]')).not.toBeNull()
  })

  test('string: search type with as', () => {
    const handle = memoryHandle('q', '', { kind: 'string' })
    const { getByLabelText } = show(<ControlView spec={spec(handle, 'Find', { as: 'search' })} />)
    expect((getByLabelText('Find') as HTMLInputElement).type).toBe('search')
  })

  test('range: presets in a select, the day inputs only for custom', () => {
    const handle = memoryHandle(
      'range',
      { preset: '7d' } as { preset: string; from?: string; to?: string },
      {
        kind: 'range',
        options: [
          { value: '7d', label: '7 days' },
          { value: 'custom', label: 'Custom' },
        ] as never,
      },
    )
    const a = show(<ControlView spec={spec(handle, 'Range')} />)
    expect(a.container.querySelector('[data-slot="range-days"]')).toBeNull()
    a.unmount()
    act(() => {
      handle.put({ preset: 'custom', from: '2026-01-01', to: '2026-01-31' })
    })
    const b = show(<ControlView spec={spec(handle, 'Range')} />)
    const from = b.getByLabelText('Range: from') as HTMLInputElement
    expect(from.value).toBe('2026-01-01')
    fireEvent.change(b.getByLabelText('Range: to'), { target: { value: '2026-02-01' } })
    expect(handle.writes).toEqual([{ preset: 'custom', from: '2026-01-01', to: '2026-02-01' }])
    fireEvent.change(b.getByLabelText('Range: to'), { target: { value: '2025-12-01' } })
    expect(handle.writes, 'an inverted range is not written').toHaveLength(1)
  })
})

describe('a range changed from outside while mounted', () => {
  test('replaces the picked custom and its days with the stored value', () => {
    const handle = memoryHandle(
      'range',
      { preset: 'custom', from: '2026-01-01', to: '2026-01-31' } as {
        preset: string
        from?: string
        to?: string
      },
      {
        kind: 'range',
        options: [
          { value: '7d', label: '7 days' },
          { value: 'custom', label: 'Custom' },
        ] as never,
      },
    )
    const { container, getByLabelText } = show(<ControlView spec={spec(handle, 'Range')} />)
    expect((getByLabelText('Range: from') as HTMLInputElement).value).toBe('2026-01-01')
    act(() => {
      handle.put({ preset: '7d' })
    })
    expect(container.querySelector('[data-slot="range-days"]')).toBeNull()
    act(() => {
      handle.put({ preset: 'custom', from: '2026-03-01', to: '2026-03-31' })
    })
    expect((getByLabelText('Range: from') as HTMLInputElement).value).toBe('2026-03-01')
    expect((getByLabelText('Range: to') as HTMLInputElement).value).toBe('2026-03-31')
  })
})
