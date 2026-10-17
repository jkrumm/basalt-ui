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
  test('with no colour it takes the gray tint, never the accent', () => {
    const style = badge()
    expect(style).toContain('gray')
    expect(style).not.toContain('blue')
  })

  test('an explicit colour still wins', () => {
    expect(badge('blue')).toContain('blue')
  })
})
