import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Num, numParts } from './num'

afterEach(cleanup)

const text = (value: number | null | undefined): string => {
  const { container } = render(<Num value={value} />)
  return container.textContent ?? ''
}

describe('num module', () => {
  test('carries its data-slot', () => {
    const { container } = render(<Num value={1} />)
    expect(container.querySelector('[data-slot]')?.getAttribute('data-slot')).toBe(numParts[0])
  })

  test('absent and non-finite values print a muted dash', () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
      expect(text(value)).toBe('—')
      cleanup()
    }
    const { container } = render(<Num value={null} tone="bad" />)
    const el = container.querySelector<HTMLElement>('[data-slot="num"]')!
    expect(el.className).toContain('text-muted-foreground')
    expect(el.className).not.toContain('text-bad')
    expect(el.hasAttribute('data-absent')).toBe(true)
  })

  test('a finite value prints in the page locale with tabular numerals', () => {
    const { container } = render(<Num value={1234.5} />)
    const el = container.querySelector<HTMLElement>('[data-slot="num"]')!
    expect(el.textContent).toBe('1,234.5')
    expect(el.className).toContain('tabular-nums')
    expect(el.hasAttribute('data-absent')).toBe(false)
  })

  test('zero is a figure, not an absence', () => {
    expect(text(0)).toBe('0')
  })

  test('format options reach Intl and tone colours a finite value', () => {
    const { container } = render(<Num value={0.25} format={{ style: 'percent' }} tone="good" />)
    const el = container.querySelector<HTMLElement>('[data-slot="num"]')!
    expect(el.textContent).toBe('25%')
    expect(el.className).toContain('text-good')
  })

  test('server render keeps the slot and the dash', () => {
    expect(renderToString(<Num value={null} />)).toContain('—')
    expect(renderToString(<Num value={3} />)).toContain('data-slot="num"')
  })
})
