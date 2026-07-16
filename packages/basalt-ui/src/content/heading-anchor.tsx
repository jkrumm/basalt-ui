/**
 * HeadingAnchor — the hover-revealed "copy a link to this section" affordance on a heading
 * (docs/CONTENT-SPEC.md §7).
 *
 * `./markdown` and `./mdx` render one automatically on every slugged heading. It is exported so
 * hand-authored `Prose` articles can render the SAME affordance on their own headings — without
 * it, a JSX article and the identical markdown would not look identical, which is the whole point
 * of routing every source through one set of primitives (CONTENT-SPEC §1).
 *
 * It is a thin wrapper over `CopyAction` — the same component `CodeBlock`'s copy button renders —
 * so "copy this thing" reads identically everywhere on the surface: subtle icon button, tooltip,
 * glyph swapping to a teal check. Only the resting glyph differs (a link, not a copy sheet).
 *
 * @example
 * import { headingSlug, HeadingAnchor, Prose } from 'basalt-ui/content'
 *
 * const id = headingSlug('Setup')
 * <Prose>
 *   <h2 id={id}>Setup<HeadingAnchor id={id} /></h2>
 * </Prose>
 */
import { CopyAction } from './copy-action'
import { LinkGlyph } from './glyphs'
import classes from './prose.module.css'

export type HeadingAnchorProps = {
  /** The heading's `id` — the fragment the copied URL points at. */
  readonly id: string
  /** Accessible name for the trigger. */
  readonly label?: string
}

export function HeadingAnchor({ id, label = 'Copy link to section' }: HeadingAnchorProps) {
  // Resolved at click time, never at render: the component is SSR-rendered (no `window`), and the
  // live search/pathname is the honest basis for the link a reader is asking to share.
  const resolveUrl = () => {
    const { origin, pathname, search } = window.location
    return `${origin}${pathname}${search}#${id}`
  }

  // The span owns placement + the hover reveal; CopyAction owns the affordance itself. It also
  // carries `data-heading-anchor`, which `TableOfContents` strips when reading a heading's label.
  return (
    <span className={classes.headingAnchor} data-heading-anchor>
      <CopyAction
        value={resolveUrl}
        label="Copy link"
        ariaLabel={label}
        tooltipPosition="top"
        glyph={<LinkGlyph />}
      />
    </span>
  )
}
