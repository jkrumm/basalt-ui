/**
 * headings: the slug, anchor and foreign-id contract. `createHeadingComponents` builds one
 * renderer per level against a shared `SlugTracker`; each test builds its OWN tracker so a
 * collision counter never leaks across cases.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ComponentType, JSX } from 'react'
import type { Element } from 'hast'
import type { Components, ExtraProps } from 'react-markdown'
import { SlugTracker } from '../core/slug'
import { createHeadingComponents } from './headings'

afterEach(cleanup)

type HeadingProps = JSX.IntrinsicElements['h2'] & ExtraProps

/** Narrows `Components['h2']` to the function component the factory builds, with a runtime check. */
function h2Of(components: Partial<Components>): ComponentType<HeadingProps> {
  const H2 = components.h2
  if (typeof H2 !== 'function') throw new Error('expected createHeadingComponents to build h2')
  return H2
}

describe('headings', () => {
  test('an ordinary heading is slugged, gets an id and a link to itself named by its text', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    render(<H2>Introduction</H2>)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.id).toBe('introduction')
    const link = heading.querySelector('a[data-heading-anchor]')
    expect(link?.getAttribute('href')).toBe('#introduction')
    expect(link?.getAttribute('aria-labelledby')).toBe('introduction')
  })

  test('every level builds, h1 to h6', () => {
    const components = createHeadingComponents(new SlugTracker())
    expect(
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every(
        (k) => typeof components[k as 'h1'] === 'function',
      ),
    ).toBe(true)
  })

  test('a repeated heading text gets -1, -2 suffixes from the shared tracker', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    render(
      <>
        <H2>Setup</H2>
        <H2>Setup</H2>
        <H2>Setup</H2>
      </>,
    )
    expect(screen.getAllByRole('heading').map((h) => h.id)).toEqual(['setup', 'setup-1', 'setup-2'])
  })

  test('the slug reads nested element text', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    render(
      <H2>
        Use <code>bun</code> now
      </H2>,
    )
    expect(screen.getByRole('heading').id).toBe('use-bun-now')
  })

  test('a heading arriving with an id keeps it instead of the slugged one', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    render(<H2 id="footnote-label">Footnotes</H2>)
    expect(screen.getByRole('heading', { level: 2, name: 'Footnotes' }).id).toBe('footnote-label')
  })

  test('a heading arriving with an id gets no anchor and registers no slug', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    render(
      <>
        <H2 id="footnote-label">Footnotes</H2>
        <H2>Footnotes</H2>
      </>,
    )
    const [foreign, own] = screen.getAllByRole('heading')
    expect(foreign?.querySelector('a')).toBeNull()
    expect(own?.id).toBe('footnotes')
  })

  test('a heading arriving with a class keeps it', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    render(<H2 className="sr-only">Footnotes</H2>)
    expect(screen.getByRole('heading').className).toContain('sr-only')
  })

  test('the hast node never reaches the DOM', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    const node: Element = { type: 'element', tagName: 'h2', properties: {}, children: [] }
    render(<H2 node={node}>Title</H2>)
    expect(screen.getByRole('heading').hasAttribute('node')).toBe(false)
  })
})
