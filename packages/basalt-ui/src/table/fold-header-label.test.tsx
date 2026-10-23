import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { FoldHeaderLabel } from './data-table-fold'

afterEach(cleanup)

describe('FoldHeaderLabel', () => {
  test('one folded column reads "1 more column", not a plural', () => {
    const { container } = render(<FoldHeaderLabel count={1} foldedLabel="X" />)
    const hint = container.querySelector('[title]')
    expect(hint?.getAttribute('title')).toBe('1 more column: X')
    expect(hint?.nextElementSibling?.textContent).toBe('1 more column: X')
  })
})
