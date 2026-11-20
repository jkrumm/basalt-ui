import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { SiteLinkGroup, Slot } from './types'

export type SiteFooterProps = {
  /** The brand block: a logo, a name, one line on what the site is. */
  brand?: Slot
  /** Link columns, each with its own title. */
  groups?: readonly SiteLinkGroup[]
  /** The fine print under the columns: copyright, legal links. */
  children?: Slot
  /** The landmark's accessible name when a page has more than one `contentinfo`. */
  label?: string
  className?: string
}

/**
 * The site footer: a brand block, link columns and a fine-print row. Columns wrap by their own
 * width, so the footer needs no breakpoint. Every heading and label is a prop.
 *
 * @useWhen a content site needs its closing navigation and fine print
 * @neverWhen the page lives inside `AppShell`
 *
 * @example
 * <SiteFooter brand={<Brand />} groups={[{ title: 'Docs', links: [{ href: '/docs', label: 'Start' }] }]}>
 *   © 2026 Basalt
 * </SiteFooter>
 */
export function SiteFooter({
  brand,
  groups = [],
  children,
  label,
  className,
}: SiteFooterProps): ReactElement {
  return (
    <footer
      data-slot="site-footer"
      aria-label={label}
      className={cn('border-t border-border bg-inset text-sm text-muted-foreground', className)}
    >
      <div className="mx-auto flex max-w-[80rem] flex-col gap-10 px-4 py-12 @regular:px-6">
        {(brand !== undefined || groups.length > 0) && (
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            {brand !== undefined && <div className="flex max-w-xs flex-col gap-2">{brand}</div>}
            {groups.map((group) => (
              <div key={group.title} className="flex min-w-36 flex-col gap-3">
                <h2 className="font-mono text-micro tracking-wider text-faint uppercase">
                  {group.title}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        aria-current={link.current === true ? 'page' : undefined}
                        className="focus-ring rounded-sm text-muted-foreground no-underline hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {children !== undefined && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-xs">
            {children}
          </div>
        )}
      </div>
    </footer>
  )
}
