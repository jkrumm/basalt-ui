import { createContext, isValidElement, useContext } from 'react'
import type { JSX, ReactNode } from 'react'
import type { Components, ExtraProps } from 'react-markdown'
import { SlugTracker } from '../core/slug'

type Level = 1 | 2 | 3 | 4 | 5 | 6
type HeadingProps = JSX.IntrinsicElements['h1'] & ExtraProps

const TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

/**
 * The link beside a heading's text: `#id`, named by the heading itself (`aria-labelledby`), so it
 * needs no string of its own. Shown on hover and on focus, always on a touch screen. The `Toc`
 * leaves it out of the entry label through `data-heading-anchor`.
 */
function HeadingAnchor({ id }: { id: string }): JSX.Element {
  return (
    <a
      href={`#${id}`}
      aria-labelledby={id}
      data-heading-anchor=""
      className="ms-2 text-muted-foreground no-underline transition-opacity focus-ring pointer-fine:opacity-0 pointer-fine:group-hover/heading:opacity-100 pointer-fine:focus-visible:opacity-100"
    >
      <span aria-hidden="true">#</span>
    </a>
  )
}

/** The tracker of the document being rendered. `Markdown` provides a fresh one per rendered block. */
export const HeadingSlugs = createContext<SlugTracker | null>(null)

function createHeading(level: Level, own: SlugTracker | undefined) {
  const Tag = TAGS[level]
  // React may call a component twice for one node (StrictMode); the slug of a node is minted once,
  // so the repeat call cannot read as a second heading with the same text.
  const minted = new WeakMap<object, string>()
  // `node` is react-markdown's hast handle and must never reach the DOM.
  return function Heading({ id, children, node, className, ...rest }: HeadingProps) {
    const shared = useContext(HeadingSlugs)
    // An id this renderer did not mint (the footnotes heading, a rehype plugin's) is somebody
    // else's address: keep it, register no slug, add no anchor.
    if (id !== undefined) {
      return (
        <Tag id={id} {...(className !== undefined && { className })} {...rest}>
          {children}
        </Tag>
      )
    }
    const known = node === undefined ? undefined : minted.get(node)
    const slug = known ?? (own ?? shared ?? new SlugTracker()).slug(textOf(children))
    if (node !== undefined && known === undefined) minted.set(node, slug)
    // A heading with no slug text (a stream cut mid-`## `, a punctuation-only title) has nothing to
    // address: an anchor would be `<a href="#" aria-labelledby="">`, a link with no name.
    if (slug === '') {
      return (
        <Tag {...(className !== undefined && { className })} {...rest}>
          {children}
        </Tag>
      )
    }
    return (
      <Tag id={slug} className={['group/heading', className].filter(Boolean).join(' ')} {...rest}>
        {children}
        <HeadingAnchor id={slug} />
      </Tag>
    )
  }
}

/**
 * Slugged and anchored `h1` to `h6` for react-markdown's `components`. Ids come from the shared
 * slug algorithm (`SlugTracker`, github-slugger rules, `-1`, `-2` for repeats). With a tracker the
 * renderers use it; without one they read the nearest `HeadingSlugs` (`Markdown` provides one per
 * rendered block, so a streamed message dedupes within a block only) or mint a bare slug.
 *
 * @example
 * const components = createHeadingComponents(new SlugTracker())
 */
export function createHeadingComponents(tracker?: SlugTracker): Partial<Components> {
  return {
    h1: createHeading(1, tracker),
    h2: createHeading(2, tracker),
    h3: createHeading(3, tracker),
    h4: createHeading(4, tracker),
    h5: createHeading(5, tracker),
    h6: createHeading(6, tracker),
  }
}
