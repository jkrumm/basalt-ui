/** Wave 37 theme chrome: the symmetric Button section inset and the Badge dot scope (browser checks: tests/layout). */
import { Button, MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { baseTheme } from './index'

const controlsCss = readFileSync(resolve(import.meta.dirname, 'controls.module.css'), 'utf8')

const rootStyle = (size?: string): string => {
  const { getByText, unmount } = render(
    <MantineProvider theme={baseTheme}>
      <Button leftSection="i" {...(size !== undefined && { size })}>
        go
      </Button>
    </MantineProvider>,
  )
  const style = getByText('go').closest('.mantine-Button-root')?.getAttribute('style') ?? ''
  unmount()
  return style
}

const decl = (style: string, name: string): string =>
  style.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim() ?? ''

describe('Button section inset', () => {
  test.each([undefined, 'xs', 'sm', 'md', 'lg', 'xl', 'compact-sm'])(
    'size %p: the icon side equals the text side',
    (size) => {
      const style = rootStyle(size)
      expect(decl(style, '--button-section-padding-x')).toBe(decl(style, '--button-padding-x'))
      expect(decl(style, '--button-section-padding-x')).not.toBe('')
    },
  )

  test('ctl: the icon side equals the ctl text inset', () => {
    expect(decl(rootStyle('ctl'), '--button-section-padding-x')).toBe('var(--button-padding-x-ctl)')
  })
})

describe('the Badge dot rule', () => {
  test('is scoped to the light variant, so variant="dot" keeps its own ::before', () => {
    const rules = [...controlsCss.matchAll(/([^{}]*\.badgeRoot[^{}]*)\{/g)].map((m) => m[1] ?? '')
    expect(rules.length).toBeGreaterThan(0)
    for (const selector of rules) expect(selector).toContain("[data-variant='light']")
  })
})
