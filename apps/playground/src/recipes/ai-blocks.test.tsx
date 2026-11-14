/**
 * The ai-blocks recipe (docs/v3/concepts/ai-mdx.md rows 11 and 13, I9): the six seed blocks pass
 * `expectCatalog` (samples validate and render in every phase; oversize and hostile-URL props are
 * refused), and the layout block draws its children through the same catalog.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { expectCatalog } from 'basalt-ui/testing'
import { catalog } from './ai-blocks'

afterEach(cleanup)

describe('ai-blocks', () => {
  test('expectCatalog(catalog) passes for all six seed blocks', () => {
    expect(catalog.blocks.map((b) => b.name)).toEqual([
      'stat',
      'chart',
      'table',
      'callout',
      'list',
      'layout',
    ])
    expectCatalog(catalog)
  })

  test('a layout spec renders each child block', () => {
    const spec = {
      block: 'layout',
      items: [
        { block: 'stat', label: 'Shipped', value: 388 },
        { block: 'callout', kind: 'info', text: 'Done.' },
      ],
    }
    const { container } = render(<catalog.Block spec={spec} phase="ready" />)
    expect(container.textContent).toContain('Shipped')
    expect(container.textContent).toContain('Done.')
  })

  test('a child with a hostile url is refused before any render', () => {
    const spec = {
      block: 'layout',
      items: [
        { block: 'stat', label: 'x', value: 1, href: '//h' },
        { block: 'stat', label: 'y', value: 2 },
      ],
    }
    const { container } = render(<catalog.Block spec={spec} phase="ready" />)
    expect(container.textContent).toContain('could not be displayed')
  })
})
