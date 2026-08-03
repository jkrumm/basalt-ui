/**
 * Slugged + anchored heading renderers shared by `./markdown` and `./mdx` (docs/CONTENT-SPEC.md
 * §2 decision 6 / §7). Both react-markdown and MDX runtimes hand the heading component the SAME
 * shape (`children`, optionally a hast `node`), so one implementation covers both.
 *
 * Ids come from `SlugTracker` — pass a document-scoped instance for correct cross-heading dedup,
 * or a fresh per-block instance in `Markdown`'s `streaming` mode (see that module's JSDoc for the
 * accepted collision tradeoff there). That is the default path, for an ordinary prose heading with
 * no id of its own.
 *
 * FOREIGN IDS: a heading can already arrive with an `id` — remark-gfm's footnotes section heading
 * is one (`<h2 id="footnote-label" class="sr-only">Footnotes</h2>`, referenced by the surrounding
 * `<section>`'s `aria-labelledby`), and a consumer's own `rehypePlugins` injecting a heading is
 * another. The rule is general, not a footnote special case: an id this renderer did NOT assign is
 * something else's address for that heading, and slugging over it breaks whatever points at it. So
 * an incoming `id` wins outright — no re-slug, no dedup registration against `tracker` (the heading
 * isn't part of this document's slug namespace), and no `HeadingAnchor` (the affordance's premise is
 * "copy a link to the id THIS renderer just minted"; a foreign id's meaning is basalt's to respect,
 * not to advertise). Every other incoming prop (`className` included) is forwarded either way — the
 * one thing always stripped is the hast `node` handle, which must never reach the DOM.
 *
 * Not part of the public surface.
 */
import type { JSX, ReactNode } from 'react'
import { isValidElement } from 'react'
import type { Components, ExtraProps } from 'react-markdown'
import type { SlugTracker } from './slug'
import { HeadingAnchor } from './heading-anchor'

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
  // `node` is react-markdown's hast handle (`ExtraProps`) — read by neither branch, and must not
  // reach the DOM, so it's stripped the same way `LinkRenderer` strips it in `./markdown`.
  return function HeadingRenderer({ id, children, node: _node, ...rest }: HeadingProps) {
    if (id !== undefined) {
      return (
        <Tag id={id} {...rest}>
          {children}
        </Tag>
      )
    }
    const slug = tracker.slug(headingText(children))
    return (
      <Tag id={slug} {...rest}>
        {children}
        <HeadingAnchor id={slug} />
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
