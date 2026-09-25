/**
 * `useBreakpoint` — happy-dom ships a real `matchMedia` against a 1024px (64em) default viewport
 * (`page-aside.test.tsx`'s own header note), which sits between `md` (62em) and `lg` (75em) on
 * Mantine's default breakpoint scale. `sm` is 48em, so 1024px clears it.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useBreakpoint } from './use-breakpoint'

function Probe({ name, edge }: { name: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; edge?: 'min' | 'max' }) {
  const matches = useBreakpoint(name, edge)
  return <span data-testid="result">{String(matches)}</span>
}

function renderProbe(name: 'xs' | 'sm' | 'md' | 'lg' | 'xl', edge?: 'min' | 'max'): string {
  render(
    <MantineProvider>
      <Probe name={name} {...(edge !== undefined && { edge })} />
    </MantineProvider>,
  )
  return screen.getByTestId('result').textContent ?? ''
}

describe('useBreakpoint — default min edge', () => {
  test('the 1024px default viewport is at least sm (48em)', () => {
    expect(renderProbe('sm')).toBe('true')
  })

  test('the 1024px default viewport is NOT at least lg (75em)', () => {
    expect(renderProbe('lg')).toBe('false')
  })
})

describe('useBreakpoint — max edge', () => {
  test('max sm is false at 1024px — the viewport is not narrower than sm', () => {
    expect(renderProbe('sm', 'max')).toBe('false')
  })

  test('max xl is true at 1024px — the viewport IS narrower than xl (88em)', () => {
    expect(renderProbe('xl', 'max')).toBe('true')
  })
})
