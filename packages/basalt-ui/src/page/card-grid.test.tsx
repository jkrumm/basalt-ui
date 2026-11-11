import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { CardGrid, cardGridVariants } from './card-grid'

afterEach(cleanup)

describe('CardGrid', () => {
  test('renders its children in a slot', () => {
    const { container } = render(
      <CardGrid>
        <i>a</i>
        <i>b</i>
      </CardGrid>,
    )
    const grid = container.querySelector('[data-slot="card-grid"]')
    expect(grid?.children).toHaveLength(2)
  })

  test.each([
    ['narrow', '--container-narrow'],
    ['regular', '--container-regular'],
    ['wide', '--container-wide'],
  ] as const)('min %s sizes its tracks from the %s tier', (min, token) => {
    expect(cardGridVariants({ min })).toContain(`minmax(min(100%,var(${token})),1fr)`)
  })

  test('the default min is narrow', () => {
    const html = renderToString(<CardGrid />)
    expect(html).toContain('--container-narrow')
  })

  test('a track never exceeds its container: min(100%, tier) is in every variant', () => {
    for (const min of ['narrow', 'regular', 'wide'] as const)
      expect(cardGridVariants({ min })).toContain('min(100%,')
  })

  test('the tracks auto-fill: no column count is written anywhere', () => {
    for (const min of ['narrow', 'regular', 'wide'] as const)
      expect(cardGridVariants({ min })).toContain('repeat(auto-fill,')
  })
})
