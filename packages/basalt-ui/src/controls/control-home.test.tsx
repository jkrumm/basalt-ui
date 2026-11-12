/**
 * `ControlHome` and `filterSlot`: the home decides the presentation, a folded pill draws the row
 * form, `Reset all` belongs to a `row` home, and `filterSlot.custom` is a counted escape that keeps
 * the override cue.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ControlHome as HomeName, ControlPresentation } from './contract'
import { ControlHome, FoldedControls, HOME_PRESENTATION, presentationOf } from './control-home'
import { memoryHandle, widgetHandle } from './control-view.handles'
import { countEscapes, filterSlot } from './filter-slot'
import { spec } from './spec'

afterEach(cleanup)

const RANGES = [
  { value: '24h', label: 'Last 24 h' },
  { value: '7d', label: 'Last 7 days' },
]

const homes = Object.keys(HOME_PRESENTATION) as HomeName[]

const enumSpec = (key: string) =>
  spec(memoryHandle(key, 'a', { kind: 'enum', options: RANGES.map((o) => ({ ...o })) }), key)

describe('home to presentation', () => {
  const expected: Record<ControlPresentation, HomeName[]> = {
    pill: ['page-bar', 'section-header', 'view-mode'],
    inline: ['card-header', 'tool'],
    row: ['form-row', 'aside', 'sheet', 'side-panel', 'overlay'],
  }
  for (const [presentation, list] of Object.entries(expected)) {
    for (const home of list) {
      test(`${home} draws ${presentation}`, () => {
        expect(presentationOf(home)).toBe(presentation as ControlPresentation)
        const { container } = render(
          <ControlHome home={home}>{filterSlot([enumSpec(`k.${home}`)]).render()}</ControlHome>,
        )
        const view = container.querySelector<HTMLElement>('[data-slot="control-view"]')!
        expect(view.dataset['presentation']).toBe(presentation)
      })
    }
  }

  test('every home is covered', () => {
    expect(homes.toSorted()).toEqual(Object.values(expected).flat().toSorted())
  })

  test('frames carry the slot of their presentation', () => {
    const slot = (home: HomeName) =>
      render(<ControlHome home={home}>{filterSlot([enumSpec('s')]).render()}</ControlHome>)
        .container.querySelector('[data-home]')
        ?.getAttribute('data-slot')
    expect(slot('page-bar')).toBe('filter-pill')
    expect(slot('aside')).toBe('filter-row')
    expect(slot('card-header')).toBe('filter-inline')
    expect(slot('view-mode')).toBe('toolbar')
    expect(slot('tool')).toBe('toolbar')
  })

  test('with no home a control is a pill', () => {
    const { container } = render(<>{filterSlot([enumSpec('s')]).render()}</>)
    expect(
      container.querySelector<HTMLElement>('[data-slot="control-view"]')?.dataset['presentation'],
    ).toBe('pill')
  })

  test('an empty home draws nothing', () => {
    const { container } = render(
      <ControlHome home="page-bar">{filterSlot([]).render()}</ControlHome>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('a folded pill', () => {
  test('draws the row form, and a pill home inside keeps it', () => {
    const { container } = render(
      <FoldedControls>
        <ControlHome home="page-bar">{filterSlot([enumSpec('f')]).render()}</ControlHome>
      </FoldedControls>,
    )
    expect(container.querySelectorAll('[data-presentation="pill"]').length).toBe(0)
    expect(container.querySelector('[data-presentation="row"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="filter-row"]')).not.toBeNull()
  })
})

describe('Reset all', () => {
  const two = () => {
    const a = memoryHandle('r.a', 'a', { kind: 'enum', options: RANGES.map((o) => ({ ...o })) })
    const b = memoryHandle('r.b', 'a', { kind: 'enum', options: RANGES.map((o) => ({ ...o })) })
    return { a, b, slot: filterSlot([spec(a, 'A'), spec(b, 'B')]) }
  }

  test('a row home offers it only once something changed, and it clears what changed', () => {
    const { a, b, slot } = two()
    const { queryByRole, getByRole } = render(
      <ControlHome home="aside">{slot.render()}</ControlHome>,
    )
    expect(queryByRole('button', { name: 'Reset all' })).toBeNull()
    // `put` moves the stored value from outside, as a link would.
    act(() => {
      a.put('7d')
      b.put('7d')
    })
    const button = getByRole('button', { name: 'Reset all' })
    fireEvent.click(button)
    expect(a.clears.count).toBe(1)
    expect(b.clears.count).toBe(1)
  })

  test('a pill home never draws it', () => {
    const { a, slot } = two()
    const { queryByRole } = render(<ControlHome home="page-bar">{slot.render()}</ControlHome>)
    act(() => {
      a.put('7d')
    })
    expect(queryByRole('button', { name: 'Reset all' })).toBeNull()
  })
})

describe('filterSlot', () => {
  test('count is the number of specs, and the slot is the contract shape', () => {
    const slot = filterSlot([enumSpec('c1'), enumSpec('c2')])
    expect(slot.kind).toBe('controls-slot')
    expect(slot.count).toBe(2)
  })
})

describe('filterSlot.custom', () => {
  const widget = (override?: string) =>
    widgetHandle<string>('w.custom', '24h', {
      kind: 'enum',
      options: RANGES,
      ...(override !== undefined && { override }),
    })

  test('draws only the input; the slot keeps the label, the cue and the reset', () => {
    const handle = widget('7d')
    const slot = filterSlot.custom(handle, 'Range', ({ value, set, label }) => (
      <button
        type="button"
        data-testid="mine"
        aria-label={label}
        onClick={() => {
          set('24h')
        }}
      >
        {value}
      </button>
    ))
    const { container, getByTestId, getByRole } = render(
      <ControlHome home="card-header">{slot.render()}</ControlHome>,
    )
    expect(getByTestId('mine').textContent).toBe('7d')
    expect(container.querySelector('[data-slot="override-badge"]')?.textContent).toBe('Local')
    fireEvent.click(getByRole('button', { name: 'Reset Range to global' }))
    expect(handle.clears.count).toBe(1)
    expect(container.querySelector('[data-slot="override-badge"]')).toBeNull()
  })

  test('is counted as an escape; filterSlot is not', () => {
    const custom = filterSlot.custom(widget(), 'Range', () => null)
    expect(custom.escape).toBe('filterSlot.custom')
    expect(countEscapes([custom, filterSlot([enumSpec('e')]), custom])).toBe(2)
    expect(custom.count).toBe(1)
  })
})
