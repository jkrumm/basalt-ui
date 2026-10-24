/**
 * A card's facts render ONLY in the ready state, in every body (a chart, a `placeholderHeight="content"`
 * list, a Meter) and every state: pending shows the facts skeleton, empty and error show neither.
 */
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import { ChartCard } from '../charts/ChartCard'
import type { ChartState } from '../charts/types'

const STATES: ReadonlyArray<readonly [string, ChartState | undefined]> = [
  ['ready', undefined],
  ['pending', { pending: true }],
  ['empty', { empty: 'Nothing here.' }],
  ['error', { error: new Error('boom') }],
]

const BODIES = [
  ['chart', undefined, <div key="b">chart</div>],
  ['content list', 'content' as const, <ul key="b">list</ul>],
  ['Meter', 'content' as const, <Meter key="b" label="m" value={3} max={10} />],
] as const

describe('ChartCard facts gate', () => {
  for (const [body, placeholderHeight, children] of BODIES) {
    for (const [name, state] of STATES) {
      test(`${body} body, ${name}: facts ${name === 'ready' ? 'visible' : 'hidden'}, skeleton ${name === 'pending' ? 'shown' : 'absent'}`, () => {
        const { container } = render(
          <MantineProvider>
            <ChartCard
              title="T"
              subtitle="Basis"
              facts={{ value: 'HEADLINE' }}
              state={state}
              {...(placeholderHeight !== undefined && { placeholderHeight })}
            >
              {children}
            </ChartCard>
          </MantineProvider>,
        )
        const ready = name === 'ready'
        expect(container.querySelector('[data-basalt-fact]') !== null).toBe(ready)
        expect(container.textContent?.includes('HEADLINE')).toBe(ready)
        expect(container.textContent?.includes('Basis')).toBe(ready)
        expect(container.querySelector('[data-basalt-facts-skeleton]') !== null).toBe(
          name === 'pending',
        )
      })
    }
  }
})

describe('ChartCard pending ghost', () => {
  const ghost = (props: object): HTMLElement | null =>
    render(<ChartCard title="T" state={{ pending: true }} {...props} />).container.querySelector(
      '[data-basalt-plot-ghost]',
    )

  test('a bar ghost by default', () => {
    expect(ghost({})?.getAttribute('data-basalt-plot-ghost')).toBe('bars')
  })

  test("ghost='line' draws a line, no bars", () => {
    const el = ghost({ ghost: 'line' })
    expect(el?.getAttribute('data-basalt-plot-ghost')).toBe('line')
    expect(el?.querySelector('polyline')).not.toBeNull()
    expect(el?.querySelectorAll('span').length).toBe(0)
  })

  test('a number is the bar count', () => {
    expect(ghost({ ghost: 6 })?.querySelectorAll('span').length).toBe(6)
    expect(ghost({ ghost: 12 })?.querySelectorAll('span').length).toBe(12)
  })
})

describe('ChartCard facts gate: documented misuse', () => {
  test.each([
    [
      'loading',
      <div key="m" aria-busy="true">
        loading rows
      </div>,
    ],
    ['empty', <p key="m">No sessions logged</p>],
  ])('a content card not told via state still renders facts over a body-owned %s', (_n, body) => {
    const { container } = render(
      <ChartCard title="T" facts={{ value: 'HEADLINE' }} placeholderHeight="content">
        {body}
      </ChartCard>,
    )
    expect(container.textContent).toContain('HEADLINE')
    expect(container.querySelector('[data-basalt-facts-skeleton]')).toBeNull()
  })
})
