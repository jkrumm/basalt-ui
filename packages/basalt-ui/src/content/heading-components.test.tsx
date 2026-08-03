/**
 * heading-components — the slug/anchor/foreign-id contract (docs/CONTENT-SPEC.md §2 decision 6 /
 * §7). `createHeadingComponents` builds one renderer per level against a shared `SlugTracker`; each
 * test below builds its OWN tracker so a slug-collision counter never leaks across cases.
 *
 * `createHeadingComponents` is not part of the public surface (not re-exported by `./index`), same
 * test idiom as `composeRehypePlugins` in `./markdown.test.tsx` — imported straight from the module.
 */
import type { ComponentType, JSX } from 'react'
import type { Components, ExtraProps } from 'react-markdown'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { createHeadingComponents } from './heading-components'
import { SlugTracker } from './slug'

function renderHeading(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

type HeadingProps = JSX.IntrinsicElements['h2'] & ExtraProps

/** Narrows `Components['h2']` (`ComponentType | keyof JSX.IntrinsicElements | undefined`) down to
 * the function component `createHeadingComponents` actually builds — no cast, a runtime check. */
function h2Of(components: Partial<Components>): ComponentType<HeadingProps> {
  const H2 = components.h2
  if (typeof H2 !== 'function') throw new Error('expected createHeadingComponents to build h2')
  return H2
}

describe('heading-components', () => {
  test('an ordinary heading is slugged, gets an id, and gets the anchor affordance', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    renderHeading(<H2>Introduction</H2>)

    const heading = screen.getByRole('heading', { level: 2, name: 'Introduction' })
    expect(heading.id).toBe('introduction')
    expect(screen.getByLabelText('Copy link to section')).toBeDefined()
  })

  test('a heading arriving with an id keeps that id instead of the slugged one', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    renderHeading(<H2 id="footnote-label">Footnotes</H2>)

    // The slugger would produce 'footnotes' — the incoming id must win outright.
    const heading = screen.getByRole('heading', { level: 2, name: 'Footnotes' })
    expect(heading.id).toBe('footnote-label')
  })

  test('a heading arriving with a class keeps it', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    renderHeading(<H2 className="sr-only">Footnotes</H2>)

    const heading = screen.getByRole('heading', { level: 2, name: 'Footnotes' })
    expect(heading.className).toBe('sr-only')
  })

  test('a heading that keeps its own id is not given the anchor affordance', () => {
    const H2 = h2Of(createHeadingComponents(new SlugTracker()))
    renderHeading(<H2 id="footnote-label">Footnotes</H2>)

    screen.getByRole('heading', { level: 2, name: 'Footnotes' })
    expect(screen.queryByLabelText('Copy link to section')).toBeNull()
  })
})
