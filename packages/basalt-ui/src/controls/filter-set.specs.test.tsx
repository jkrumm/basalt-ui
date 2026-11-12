/**
 * `FilterSet({ specs })` (docs/v3/issues/g1/v3-ctl-5-filterset.json), the invariants it carries over
 * from 2.x: a pill prints the VALUE even at its default, an off-catalogue value still renders, a
 * multi equal to the full set behaves as empty, the census (`Filters (n)`) reads the handles, and
 * `Reset all` unsets them. Layout (the fold, the sheet, no wrap) is `tests/layout/controls-filter-set`.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ControlHome } from './control-home'
import { memoryHandle } from './control-view.handles'
import { catalogueOf, isActive, withCurrentValue } from './filter-set-census'
import { fitCount } from './filter-set-fold'
import { FilterSet } from './filter-set'
import { spec } from './spec'

afterEach(cleanup)

const REGIONS = [
  { value: 'eu', label: 'Europe' },
  { value: 'us', label: 'United States' },
  { value: 'ap', label: 'Asia Pacific' },
]

const env = (initial = 'prod') =>
  spec(
    memoryHandle(`env.${initial}`, initial, {
      kind: 'enum',
      options: [
        { value: 'prod', label: 'Production' },
        { value: 'staging', label: 'Staging' },
      ],
    }),
    'Environment',
  )

const regions = () =>
  spec(
    memoryHandle<readonly string[]>('regions', [], { kind: 'multi', options: REGIONS as never }),
    'Regions',
  )

const pills = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-slot="filter-set-pill"] button')].map((b) => ({
    text: b.textContent,
    name: b.getAttribute('aria-label'),
  }))

const count = (container: HTMLElement) =>
  container.querySelector('[data-slot="filter-count"]')?.textContent

describe('FilterSet specs', () => {
  test('a pill prints the value at its default, named by the filter', () => {
    const { container } = render(<FilterSet specs={[env()]} />)
    expect(pills(container)).toEqual([{ text: 'Production', name: 'Environment: Production' }])
  })

  test('an off-catalogue value still renders', () => {
    const e = env('retired')
    const { container } = render(<FilterSet specs={[e]} />)
    expect(pills(container)[0]?.text).toBe('retired')
    expect(catalogueOf(withCurrentValue(e, 'retired')).map((o) => o.value)).toContain('retired')
  })

  test('an option marked disabled keeps its flag in the catalogue the input draws', () => {
    const archived = spec(
      memoryHandle('arch', 'prod', {
        kind: 'enum',
        options: [
          { value: 'prod', label: 'Production' },
          { value: 'old', label: 'Old', disabled: true } as never,
        ],
      }),
      'Environment',
    )
    const options = catalogueOf(withCurrentValue(archived, 'old')) as unknown as {
      disabled?: boolean
    }[]
    expect(options).toHaveLength(2)
    expect(options[1]?.disabled).toBe(true)
  })

  test('a multi that holds every option is not active, like an empty one', () => {
    const r = regions()
    expect(isActive(r, [])).toBe(false)
    expect(isActive(r, ['eu', 'us', 'ap'])).toBe(false)
    const { container } = render(<FilterSet specs={[r]} />)
    expect(pills(container)[0]?.text).toBe('Regions')
    act(() => {
      ;(r.handle as ReturnType<typeof memoryHandle<readonly string[]>>).put(['eu', 'us', 'ap'])
    })
    expect(pills(container)[0]?.text).toBe('Regions')
    expect(count(container)).toBe('Filters')
    act(() => {
      ;(r.handle as ReturnType<typeof memoryHandle<readonly string[]>>).put(['eu', 'us'])
    })
    expect(pills(container)[0]?.text).toBe('2 selected')
    expect(count(container)).toBe('Filters (1)')
  })

  test('Filters (n) counts the handles off their default, and Reset all unsets them', () => {
    const a = env('prod')
    const q = spec(memoryHandle('q', '', { kind: 'string' }), 'Search')
    const { container } = render(<FilterSet specs={[a, q]} />)
    expect(count(container)).toBe('Filters')
    act(() => {
      ;(q.handle as ReturnType<typeof memoryHandle<string>>).put('latency')
    })
    expect(count(container)).toBe('Filters (1)')
    expect(pills(container).map((p) => p.text)).toEqual(['Production', 'latency'])
    act(() => {
      ;(a.handle as ReturnType<typeof memoryHandle<string>>).put('staging')
    })
    expect(count(container)).toBe('Filters (2)')
    // The sheet owns Reset all; it mounts on open.
    fireEvent.click(container.querySelector('[data-slot="filter-count"]')!.closest('button')!)
    const reset = document.querySelector<HTMLButtonElement>('[data-slot="filter-reset"]')!
    expect(reset.disabled).toBe(false)
    act(() => {
      fireEvent.click(reset)
    })
    expect(count(container)).toBe('Filters')
    expect(pills(container).map((p) => p.text)).toEqual(['Production', 'Search'])
  })

  test('no specs draws nothing', () => {
    const { container } = render(<FilterSet specs={[]} />)
    expect(container.innerHTML).toBe('')
  })

  test('in a row home the set is the row forms stacked, with no pill', () => {
    const { container } = render(
      <ControlHome home="aside">
        <FilterSet specs={[env(), regions()]} />
      </ControlHome>,
    )
    expect(container.querySelectorAll('[data-slot="filter-set-pill"] button')).toHaveLength(0)
    const views = container.querySelectorAll('[data-slot="control-view"]')
    expect(views).toHaveLength(2)
    expect([...views].every((v) => v.getAttribute('data-presentation') === 'row')).toBe(true)
    expect(container.querySelector('[data-slot="filter-reset"]')).not.toBeNull()
  })

  test('the children form still draws the 2.x container', () => {
    const { container } = render(<FilterSet>{null}</FilterSet>)
    expect(container.querySelector('[data-slot="filter-set"]')).toBeNull()
  })
})

describe('fitCount', () => {
  test('everything fits: all stay', () => {
    expect(fitCount([100, 100, 100], 8, 316, 50)).toBe(3)
  })

  test('the fold button takes room only when something folds', () => {
    // 3 x 100 + 2 x 8 = 316 > 300, so fold: 2 pills (100+8+100) + gap 8 + fold 50 = 266 fits
    expect(fitCount([100, 100, 100], 8, 300, 50)).toBe(2)
    // 1 pill + gap + fold = 158 fits, 2 pills = 266 > 200
    expect(fitCount([100, 100, 100], 8, 200, 50)).toBe(1)
  })

  test('nothing fits: only the fold button stays', () => {
    expect(fitCount([300, 300], 8, 200, 50)).toBe(0)
  })

  test('no pills', () => {
    expect(fitCount([], 8, 200, 50)).toBe(0)
  })
})
