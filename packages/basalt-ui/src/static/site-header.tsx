import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { Glyph } from './glyphs'
import type { SiteLink, Slot } from './types'

export type SiteHeaderProps = {
  /** The brand mark, usually a link home with a logo and a name (in Astro, a `slot="brand"` child). */
  brand?: Slot
  /** The primary links; the one with `current` carries `aria-current="page"`. */
  links: readonly SiteLink[]
  /** The navigation landmark's accessible name ("Main"). */
  navLabel: string
  /** The menu button's accessible name on a narrow header ("Menu"). */
  menuLabel: string
  /** Trailing controls: a theme switch, a repository link. Shown in the bar and in the menu. */
  actions?: Slot
  /** The menu's element id; unique per page. Default `basalt-site-menu`. */
  menuId?: string
  className?: string
}

function NavList({
  links,
  stacked,
}: {
  links: readonly SiteLink[]
  stacked: boolean
}): ReactElement {
  return (
    <ul className={cn('flex', stacked ? 'flex-col gap-0.5' : 'items-center gap-1')}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            aria-current={link.current === true ? 'page' : undefined}
            className={cn(
              'focus-ring block rounded-ctrl px-2.5 py-1.5 text-sm text-muted-foreground no-underline hover:bg-accent hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:font-medium',
              stacked && 'px-3 py-2 text-base',
            )}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * The site's top bar: brand, primary links and trailing actions. The bar is its own container: from
 * the `wide` size the links sit inline, below it one button opens them in a native popover (the top
 * layer, light dismiss and Escape come from the platform; no script). Every label is a prop.
 *
 * @useWhen a content site (articles, docs, a landing page) needs its top navigation
 * @neverWhen the page lives inside `AppShell` (the shell owns the header)
 *
 * @example
 * <SiteHeader
 *   brand={<a href="/">Basalt</a>}
 *   links={[{ href: '/docs', label: 'Docs', current: true }]}
 *   navLabel="Main"
 *   menuLabel="Menu"
 *   actions={<ThemeSwitch label="Colour scheme" labels={schemeLabels} />}
 * />
 */
export function SiteHeader({
  brand,
  links,
  navLabel,
  menuLabel,
  actions,
  menuId = 'basalt-site-menu',
  className,
}: SiteHeaderProps): ReactElement {
  return (
    <header
      data-slot="site-header"
      className={cn(
        '@container sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-[80rem] items-center gap-4 px-4 @regular:px-6">
        <div className="flex shrink-0 items-center gap-2 font-head text-md font-semibold text-foreground [&_a]:no-underline [&_a]:text-inherit">
          {brand}
        </div>
        <nav aria-label={navLabel} className="hidden flex-1 @wide:block">
          <NavList links={links} stacked={false} />
        </nav>
        <div className="ms-auto hidden items-center gap-2 @wide:flex">{actions}</div>
        <button
          type="button"
          popoverTarget={menuId}
          aria-label={menuLabel}
          className="focus-ring ms-auto inline-flex size-9 items-center justify-center rounded-ctrl text-muted-foreground hover:bg-accent hover:text-foreground @wide:hidden"
        >
          <Glyph name="menu" className="size-5" />
        </button>
      </div>
      <div
        id={menuId}
        popover="auto"
        data-slot="site-menu"
        className="inset-x-0 top-14 bottom-auto m-0 max-h-[calc(100dvh-3.5rem)] w-full overflow-y-auto border-b border-border bg-background p-3 text-foreground shadow-raised"
      >
        <nav aria-label={navLabel}>
          <NavList links={links} stacked />
        </nav>
        {actions !== undefined && (
          <div className="mt-3 flex items-center gap-2 border-t border-border px-3 pt-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
