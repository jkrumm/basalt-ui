import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/** One entry of a section navigation: a link, or a label that holds a nested list. */
export type SiteNavNode = {
  label: string
  /** The page it opens. Without one the entry is a label over its `items`. */
  href?: string
  /** The page the reader is on: marked for assistive tech and drawn in the foreground. */
  current?: boolean
  /** Entries nested under this one. */
  items?: readonly SiteNavNode[]
}

/** A titled run of entries: a guides section, a docs chapter. */
export type SiteNavGroup = {
  /** The group's heading. Your words. */
  title?: string
  links: readonly SiteNavNode[]
}

export type SiteNavProps = {
  groups: readonly SiteNavGroup[]
  className?: string
}

function Node({ node }: { node: SiteNavNode }): ReactElement {
  const row =
    node.href === undefined ? (
      <span className="block py-1 font-medium text-foreground">{node.label}</span>
    ) : (
      <a
        href={node.href}
        {...(node.current === true && { 'aria-current': 'page' as const })}
        className={cn(
          'focus-ring -ms-px block border-s border-transparent py-1 ps-3 text-sm no-underline',
          node.current === true
            ? 'border-brand font-medium text-foreground'
            : 'text-muted-foreground hover:border-foreground hover:text-foreground',
        )}
      >
        {node.label}
      </a>
    )
  return (
    <li>
      {row}
      {node.items !== undefined && node.items.length > 0 && (
        <ul className="ms-3 flex flex-col border-s border-border">
          {node.items.map((child) => (
            <Node key={child.href ?? child.label} node={child} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * A section navigation as static HTML: titled groups of links, nested to any depth, the current page
 * marked with `aria-current`. It is the shape a content collection yields once mapped
 * (`entries.map((e) => ({ href, label: e.data.title }))`), and the `nav` of `SiteArticle`, which
 * supplies the landmark and the narrow-layout disclosure. Outside `SiteArticle` wrap it in a `<nav aria-label>`.
 *
 * @useWhen a guide or docs section outside Starlight needs a sidebar of its sibling pages
 * @neverWhen the site's docs run on Starlight (it draws its own sidebar), or the links are the site header's (use `SiteHeader`)
 *
 * @example
 * <SiteArticle title="Setup" nav={<SiteNav groups={[{ title: 'Guides', links: [{ href: '/guides/setup', label: 'Setup', current: true }] }]} />} navLabel="Guides">
 *   <Content />
 * </SiteArticle>
 */
export function SiteNav({ groups, className }: SiteNavProps): ReactElement {
  return (
    <div data-slot="site-nav" className={cn('flex flex-col gap-6', className)}>
      {groups.map((group) => (
        <div key={group.title ?? group.links[0]?.label} className="flex flex-col gap-2">
          {group.title !== undefined && (
            <p className="font-mono text-micro tracking-wider text-faint uppercase">
              {group.title}
            </p>
          )}
          <ul className="flex flex-col border-s border-border">
            {group.links.map((node) => (
              <Node key={node.href ?? node.label} node={node} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
