/** A rendered `Badge` under the basalt theme: neutral by default, an explicit `color` still wins. */
import { MantineProvider, Badge } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { baseTheme } from './index'

const badge = (color?: string): string => {
  const { getByText, unmount } = render(
    <MantineProvider theme={baseTheme}>
      <Badge {...(color !== undefined && { color })}>chip</Badge>
    </MantineProvider>,
  )
  const style = getByText('chip').closest('.mantine-Badge-root')?.getAttribute('style') ?? ''
  unmount()
  return style
}

describe('Badge colour', () => {
  test('with no colour it is the neutral surface with an ink word and no dot, never the accent', () => {
    const style = badge()
    expect(style).toContain('--badge-bg: var(--vx-surface-subtle)')
    expect(style).toContain('--badge-color: var(--vx-ink)')
    expect(style).not.toContain('--badge-dot')
    expect(style).not.toContain('blue')
  })

  test('a named colour is a status dot on the neutral surface, not a tinted slab', () => {
    const style = badge('green')
    expect(style).toContain('--badge-bg: var(--vx-surface-subtle)')
    expect(style).toContain('--badge-color: var(--vx-ink)')
    expect(style).toContain('--badge-dot: var(--mantine-color-green-filled)')
  })

  test.each([
    ['#e03131', '#e03131'],
    ['red.6', 'var(--mantine-color-red-6)'],
    ['var(--my-status)', 'var(--my-status)'],
  ])('a non-theme colour %s gives the dot that colour', (color, dot) => {
    expect(badge(color)).toContain(`--badge-dot: ${dot}`)
  })

  test('filled keeps its colour fill: the accent count', () => {
    const { getByText, unmount } = render(
      <MantineProvider theme={baseTheme}>
        <Badge variant="filled" color="blue">
          chip
        </Badge>
      </MantineProvider>,
    )
    const style = getByText('chip').closest('.mantine-Badge-root')?.getAttribute('style') ?? ''
    unmount()
    expect(style).not.toContain('--badge-dot')
    expect(style).not.toContain('--badge-bg: var(--vx-surface-subtle)')
  })
})
