import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableParts,
} from './table'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

const Sample = ({ size }: { size?: 'md' | 'compact' }) => (
  <Table size={size} aria-label="Orders">
    <TableCaption>Amounts in EUR.</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Order</TableHead>
        <TableHead numeric>Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>#4821</TableCell>
        <TableCell numeric>1,204.00</TableCell>
      </TableRow>
    </TableBody>
  </Table>
)

describe('table module', () => {
  test('renders with no provider; every part carries data-slot and tableParts lists them', () => {
    const { container } = render(<Sample />)
    expect(new Set(slots(container))).toEqual(new Set(tableParts))
    expect(container.firstElementChild?.tagName).toBe('TABLE')
  })

  test('server render keeps every slot with no provider', () => {
    const html = renderToString(<Sample />)
    for (const part of tableParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('md follows the density row height and is the default', () => {
    const { getByLabelText } = render(<Sample />)
    expect(getByLabelText('Orders').className).toContain('[--table-row-h:var(--vx-row-h)]')
    expect(getByLabelText('Orders').className).not.toContain('[--table-row-h:1.75rem]')
  })

  test('compact sets the fixed row height and keeps the coarse-pointer floor', () => {
    const { getByLabelText } = render(<Sample size="compact" />)
    const { className } = getByLabelText('Orders')
    expect(className).toContain('[--table-row-h:1.75rem]')
    expect(className).toContain('pointer-coarse:[--table-row-h:var(--vx-row-h)]')
  })

  test('the head sticks and rows carry hairlines by default', () => {
    const { container } = render(<Sample />)
    expect(container.querySelector('thead')?.className).toContain('[&_th]:sticky')
    expect(container.querySelector('th')?.className).toContain('border-b')
    expect(container.querySelector('td')?.className).toContain('border-b')
  })

  test('numeric aligns right with tabular numerals, the plain column does not', () => {
    const { getByText } = render(<Sample />)
    expect(getByText('Amount').className).toContain('tabular-nums')
    expect(getByText('1,204.00').className).toContain('text-right')
    expect(getByText('Order').className).not.toContain('tabular-nums')
    expect(getByText('#4821').className).not.toContain('tabular-nums')
  })

  test('className merges and DOM props pass through', () => {
    const { getByText } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="w-1/3" colSpan={2}>
              x
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const cell = getByText('x')
    expect(cell.className).toContain('w-1/3')
    expect(cell.className).toContain('border-b')
    expect(cell.getAttribute('colspan')).toBe('2')
  })
})
