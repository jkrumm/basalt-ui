import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Facts } from './facts'

afterEach(cleanup)

const ROWS = [
  { label: 'Version', value: '1.4.0' },
  { label: 'Outcome', value: <b>Succeeded</b> },
  { label: 'Duration', value: '42 s' },
]

describe('Facts', () => {
  test('renders a dl with one term and one description per row, in order', () => {
    const { container } = render(<Facts rows={ROWS} />)
    const list = container.querySelector('dl')
    expect(list).not.toBeNull()
    expect([...list!.querySelectorAll('dt')].map((el) => el.textContent)).toEqual([
      'Version',
      'Outcome',
      'Duration',
    ])
    expect([...list!.querySelectorAll('dd')].map((el) => el.textContent)).toEqual([
      '1.4.0',
      'Succeeded',
      '42 s',
    ])
  })

  test('a value may be a node', () => {
    const { container } = render(<Facts rows={ROWS} />)
    expect(container.querySelector('dd b')?.textContent).toBe('Succeeded')
  })

  test('no rows renders an empty list', () => {
    const { container } = render(<Facts rows={[]} />)
    expect(container.querySelector('dl')?.children).toHaveLength(0)
  })

  test('the columns key on the container: one column, two from the regular tier, no viewport query', () => {
    const { container } = render(<Facts rows={ROWS} />)
    expect(container.querySelector('[data-slot="facts"]')?.className).toContain('@container')
    const grid = container.querySelector('dl')!.className
    expect(grid).toContain('grid-cols-[auto_minmax(0,1fr)]')
    expect(grid).toContain('@regular:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]')
    expect(grid).not.toMatch(/(^|\s)(sm|md|lg|xl):/)
  })
})
