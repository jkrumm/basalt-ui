/**
 * The breadcrumb strip's trail, drawn from `buildCrumbs`: the section as text, every ancestor a link,
 * the leaf last and not a link, one separator between each two. An ancestor in the nav is the nav's
 * own anchor (the router's `Link`); any other goes through the provider's `link`, a path string and
 * a `NavTarget` alike, so a click keeps the document. An ancestor is the way up, never the current
 * page: it carries no `aria-current`, and a plain click hands focus to main once the page it opens is in.
 */
import { Fragment } from 'react'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { requestMainFocus } from '../../common/focus'
import { AppLink } from '../../core/link'
import { navAnchor } from '../../router/nav/anchor'
import type { CrumbAncestor, CrumbTrail } from '../core/crumbs'

const LINK = 'focus-ring hover:text-foreground'

function handOffOnPlainClick(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  requestMainFocus()
}

function Ancestor({ crumb }: { crumb: CrumbAncestor }): ReactElement {
  if (crumb.kind === 'nav') {
    const Anchor = navAnchor(crumb.item)
    return (
      // oxlint-disable-next-line react/static-components -- `navAnchor` is cached per item object: one stable component type
      <Anchor
        data-slot="page-breadcrumb-parent"
        data-basalt-hit=""
        className={LINK}
        onClick={handOffOnPlainClick}
      >
        {crumb.label}
      </Anchor>
    )
  }
  return (
    <AppLink
      href={crumb.href}
      data-slot="page-breadcrumb-parent"
      data-basalt-hit=""
      className={LINK}
      onClick={handOffOnPlainClick}
    >
      {crumb.label}
    </AppLink>
  )
}

const Separator = (): ReactElement => (
  <span aria-hidden="true" data-slot="page-breadcrumb-separator" className="shrink-0 text-faint">
    /
  </span>
)

export function Crumbs({ trail }: { trail: CrumbTrail }): ReactNode {
  const parts: ReactElement[] = []
  if (trail.section !== undefined) {
    parts.push(
      <span key="section" data-slot="page-breadcrumb-section">
        {trail.section}
      </span>,
    )
  }
  trail.ancestors.forEach((crumb, i) => {
    parts.push(<Ancestor key={`a${i}`} crumb={crumb} />)
  })
  if (trail.leaf !== undefined) {
    parts.push(
      <span key="leaf" data-slot="page-breadcrumb-leaf">
        {trail.leaf}
      </span>,
    )
  }
  return parts.map((part, i) => (
    <Fragment key={part.key}>
      {i > 0 && <Separator />}
      {part}
    </Fragment>
  ))
}
