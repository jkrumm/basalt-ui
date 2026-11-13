/**
 * `mdxComponents`: the fixed map, its url policy and its layering. The full compiled-page proof
 * (every key through a real MDX compile, axe) is the playground's `scenarios/mdx.test.ts`.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { mdxComponents } from './mdx'

afterEach(cleanup)

const C = (name: string) => mdxComponents[name] as unknown as (p: object) => ReactElement

describe('headings', () => {
  test('slug the text and link to it', () => {
    const { container } = render(<>{C('h2')({ children: 'Reading dashboards' })}</>)
    const h = container.querySelector('h2')!
    expect(h.id).toBe('reading-dashboards')
    expect(h.querySelector('a')?.getAttribute('href')).toBe('#reading-dashboards')
  })

  test('keep an id the compiler already set', () => {
    const { container } = render(<>{C('h3')({ id: 'custom', children: 'Other' })}</>)
    expect(container.querySelector('h3')?.id).toBe('custom')
  })
})

describe('a', () => {
  test.each(['//h', '/\\h', 'javascript:alert(1)', 'http://h'])('%s emits no href', (href) => {
    const { container } = render(<>{C('a')({ href, children: 'x' })}</>)
    expect(container.querySelector('a')?.hasAttribute('href')).toBe(false)
  })

  test.each(['/a', '#f', 'https://h/p', 'mailto:a@b'])('%s keeps its href', (href) => {
    const { container } = render(<>{C('a')({ href, children: 'x' })}</>)
    expect(container.querySelector('a')?.getAttribute('href')).toBe(href)
  })
})

describe('Tabs', () => {
  test('opens the first tab when no defaultValue is given', () => {
    const Tab = mdxComponents['Tab']!
    const tab = (value: string, label: string, text: string) =>
      createElement(
        Tab as ComponentType<object>,
        { key: value, value, label, children: text } as object,
      )
    const { container } = render(
      <>{C('Tabs')({ children: [tab('a', 'A', 'one'), tab('b', 'B', 'two')] })}</>,
    )
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toBe('one')
  })
})

describe('layering', () => {
  test('mdx.tsx imports nothing from content and no markdown pipeline package', () => {
    const source = readFileSync(join(import.meta.dir, 'mdx.tsx'), 'utf8')
    const specs = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)
    for (const spec of specs) {
      expect(spec).not.toMatch(
        /(^|\/)content(\/|$)|^(react-markdown|remark-gfm|rehype-|remend|@mdx-js)/,
      )
    }
  })
})
