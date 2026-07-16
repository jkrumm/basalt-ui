/**
 * Slugged + anchored heading renderers shared by `./markdown` and `./mdx` (docs/CONTENT-SPEC.md
 * §2 decision 6 / §7). Both react-markdown and MDX runtimes hand the heading component the SAME
 * shape (`children`, optionally a hast `node`), so one implementation covers both.
 *
 * Ids come from `SlugTracker` — pass a document-scoped instance for correct cross-heading dedup,
 * or a fresh per-block instance in `Markdown`'s `streaming` mode (see that module's JSDoc for the
 * accepted collision tradeoff there).
 *
 * Not part of the public surface.
 */
import type { JSX, ReactNode } from 'react'
import { isValidElement } from 'react'
import type { Components, ExtraProps } from 'react-markdown'
import type { SlugTracker } from './slug'
import classes from './prose.module.css'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
type HeadingProps = JSX.IntrinsicElements['h1'] & ExtraProps

const HEADING_TAGS: Record<HeadingLevel, HeadingTag> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
}

function headingText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(headingText).join('')
  if (isValidElement(node)) return headingText((node.props as { children?: ReactNode }).children)
  return ''
}

function createHeadingRenderer(level: HeadingLevel, tracker: SlugTracker) {
  const Tag = HEADING_TAGS[level]
  return function HeadingRenderer({ children }: HeadingProps) {
    const id = tracker.slug(headingText(children))
    return (
      <Tag id={id}>
        {children}
        <a
          className={classes.headingAnchor}
          href={`#${id}`}
          aria-label="Link to section"
          data-heading-anchor
        >
          #
        </a>
      </Tag>
    )
  }
}

/** Builds slugged + anchored `h1`..`h6` renderers against one `SlugTracker` instance. */
export function createHeadingComponents(tracker: SlugTracker): Partial<Components> {
  return {
    h1: createHeadingRenderer(1, tracker),
    h2: createHeadingRenderer(2, tracker),
    h3: createHeadingRenderer(3, tracker),
    h4: createHeadingRenderer(4, tracker),
    h5: createHeadingRenderer(5, tracker),
    h6: createHeadingRenderer(6, tracker),
  }
}
