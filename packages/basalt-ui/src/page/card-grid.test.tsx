import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { StatCard } from '../cards/stat-card'
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

  test('the tracks auto-fit: empty tracks collapse, no column count is written anywhere', () => {
    for (const min of ['narrow', 'regular', 'wide'] as const)
      expect(cardGridVariants({ min })).toContain('repeat(auto-fit,')
  })
})

describe('CardGrid stat row', () => {
  const stats = (n: number) =>
    Array.from({ length: n }, (_, i) => <StatCard key={i} title={`S${i}`} value={i} />)
  const scroller = (): Element | null => document.querySelector('[data-slot="scroll-area"]')

  test('a grid of only stat cards sits in the scroll primitive and snaps its cards', () => {
    render(<CardGrid>{stats(4)}</CardGrid>)
    expect(scroller()).not.toBeNull()
    expect(scroller()?.className).toContain('@max-regular:snap-mandatory')
    const grid = document.querySelector('[data-slot="card-grid"]')
    expect(grid?.className).toContain('@max-regular:[&>*]:snap-start')
    expect(grid?.getAttribute('data-narrow')).toBe('scroll')
  })

  test('mixed children and `narrow="stack"` keep the plain grid', () => {
    const { unmount } = render(
      <CardGrid>
        {stats(2)}
        <i>chart</i>
      </CardGrid>,
    )
    expect(scroller()).toBeNull()
    unmount()
    render(<CardGrid narrow="stack">{stats(2)}</CardGrid>)
    expect(scroller()).toBeNull()
  })

  test('`narrow="scroll"` scrolls any cards', () => {
    render(
      <CardGrid narrow="scroll">
        <i>a</i>
      </CardGrid>,
    )
    expect(scroller()).not.toBeNull()
  })
})
