import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { Glyph } from './glyphs'
import type { SiteMenuEntry, SiteMenuSection, SiteNavItem, SiteNavMenu, Slot } from './types'

export type SiteHeaderProps = {
  /** The brand mark, usually a link home with a logo and a name (in Astro, a `slot="brand"` child). */
  brand?: Slot
  /**
   * The primary items in order: a link, or a menu (`{ label, menu }`) that opens a panel of link rows
   * and tiles under it. The link with `current` carries `aria-current="page"`.
   */
  links: readonly SiteNavItem[]
  /** The navigation landmark's accessible name ("Main"). */
  navLabel: string
  /** The menu button's accessible name on a narrow header ("Menu"). */
  menuLabel: string
  /** Trailing controls: a theme switch, a repository link. Shown in the bar and in the menu. */
  actions?: Slot
  /** The id prefix of the sheet and the panels; unique per page. Default `basalt-site-menu`. */
  menuId?: string
  className?: string
}

const isMenu = (item: SiteNavItem): item is SiteNavMenu => 'menu' in item

const hasCurrent = (menu: SiteNavMenu): boolean =>
  menu.menu.some((section) => section.entries.some((entry) => entry.current === true))

const LINK =
  'focus-ring block rounded-ctrl px-2.5 py-1.5 text-sm text-muted-foreground no-underline hover:bg-accent hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:font-medium'

/**
 * A menu trigger and its panel. The panel is a native popover anchored under the trigger: a click, Enter
 * or Space opens it everywhere, Chrome's interest invoker (`interestfor`) opens it on hover and on focus
 * with a short delay, and the head script stands in for hover where that is missing. Escape, a click
 * outside and leaving close it. A panel that opens as another closes leaves toward it.
 */
const TRIGGER = cn(
  'focus-ring inline-flex cursor-pointer items-center gap-1 rounded-ctrl px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
  'has-[+:popover-open]:bg-accent has-[+:popover-open]:text-foreground data-current:font-medium data-current:text-foreground',
  // Intent delay: 120 ms before a panel opens, none while another one is open, 200 ms before it closes.
  '[interest-delay:120ms_200ms] [ul:has(:popover-open)_&]:[interest-delay-start:0s]',
)

const PANEL = cn(
  // The platform's popover box, reset: a card under the trigger, in the top layer.
  'm-0 w-max max-w-[calc(100vw-2rem)] overflow-auto rounded-card border border-border bg-popover p-3 text-foreground shadow-overlay',
  // Without anchor positioning: centred under the header bar.
  'inset-auto top-15 left-1/2 -translate-x-1/2',
  // With it: under the trigger, flipped to its right edge when the panel would leave the screen.
  'supports-[anchor-name:--a]:left-[anchor(left)] supports-[anchor-name:--a]:top-[calc(anchor(bottom)+0.5rem)] supports-[anchor-name:--a]:translate-x-0',
  'supports-[anchor-name:--a]:[position-try-fallbacks:flip-inline]',
  // Enter and exit in the top layer: the closed state is the exit; a panel leaves toward the one that opens.
  'opacity-0 -translate-y-1 transition-[opacity,translate,display,overlay] duration-fast ease-enter transition-discrete',
  'open:opacity-100 open:translate-y-0 starting:open:opacity-0 starting:open:-translate-y-1',
  '[li:has(~li_:popover-open)_&:not(:popover-open)]:-translate-x-3 [li:has(:popover-open)~li_&:not(:popover-open)]:translate-x-3',
  'motion-reduce:translate-x-0 motion-reduce:translate-y-0',
)

function Tile({ entry }: { entry: SiteMenuEntry }): ReactElement {
  const { image } = entry
  return (
    <a
      href={entry.href}
      aria-current={entry.current === true ? 'page' : undefined}
      className="focus-ring group/entry flex flex-col gap-2 rounded-inset p-2 text-foreground no-underline hover:bg-accent"
    >
      {image !== undefined && (
        <img
          src={image.src}
          alt={image.alt ?? ''}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full rounded-inset bg-inset object-cover"
        />
      )}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{entry.label}</span>
        {entry.description !== undefined && (
          <span className="text-xs text-muted-foreground">{entry.description}</span>
        )}
      </span>
    </a>
  )
}

function Row({ entry, thumb }: { entry: SiteMenuEntry; thumb: boolean }): ReactElement {
  const { image } = entry
  return (
    <a
      href={entry.href}
      aria-current={entry.current === true ? 'page' : undefined}
      className="focus-ring flex items-center gap-3 rounded-inset px-2.5 py-2 text-foreground no-underline hover:bg-accent"
    >
      {thumb && image !== undefined && (
        <img
          src={image.src}
          alt={image.alt ?? ''}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className="size-10 shrink-0 rounded-inset bg-inset object-cover"
        />
      )}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{entry.label}</span>
        {entry.description !== undefined && (
          <span className="text-xs text-muted-foreground">{entry.description}</span>
        )}
      </span>
    </a>
  )
}

function Section({
  section,
  id,
  sheet,
  fallbackLabel,
}: {
  section: SiteMenuSection
  id: string
  sheet: boolean
  /** The id of the menu's own label, which names a list whose section has no title. */
  fallbackLabel?: string
}): ReactElement {
  const tiles = !sheet && section.entries.some((entry) => entry.image !== undefined)
  return (
    <div className="flex min-w-48 flex-col gap-1">
      {section.title !== undefined && (
        <p id={id} className="px-2.5 text-xs font-medium text-muted-foreground">
          {section.title}
        </p>
      )}
      <ul
        aria-labelledby={section.title === undefined ? fallbackLabel : id}
        className={cn('grid gap-1', tiles && 'grid-flow-col auto-cols-[11rem]')}
      >
        {section.entries.map((entry) => (
          <li key={entry.href}>
            {tiles ? <Tile entry={entry} /> : <Row entry={entry} thumb={sheet} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DesktopItem({ item, id }: { item: SiteNavItem; id: string }): ReactElement {
  if (!isMenu(item)) {
    return (
      <li>
        <a
          href={item.href}
          data-basalt-top=""
          aria-current={item.current === true ? 'page' : undefined}
          className={LINK}
        >
          {item.label}
        </a>
      </li>
    )
  }
  // `interestfor` is not in React's attribute types yet; it renders as the lowercase attribute.
  const interest = { interestfor: id }
  return (
    <li>
      <button
        type="button"
        popoverTarget={id}
        popoverTargetAction="show"
        data-basalt-top=""
        data-current={hasCurrent(item) ? '' : undefined}
        // The anchor is named per item: the implicit anchor of a popover invoker is not reliable for `interestfor`.
        style={{ anchorName: `--${id}` }}
        className={TRIGGER}
        {...interest}
      >
        {item.label}
        <Glyph
          name="chevron"
          className="size-3.5 shrink-0 rotate-90 transition-transform duration-fast ease-standard [button:has(+:popover-open)_&]:-rotate-90 motion-reduce:transition-none"
        />
      </button>
      <div
        id={id}
        popover="auto"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a named group of links; fieldset is for form controls
        role="group"
        aria-label={item.label}
        data-slot="site-menu-panel"
        style={{ positionAnchor: `--${id}` }}
        className={PANEL}
      >
        <div className="flex gap-4">
          {item.menu.map((section, index) => (
            <Section
              key={section.title ?? index}
              section={section}
              id={`${id}-s${index}`}
              sheet={false}
            />
          ))}
        </div>
      </div>
    </li>
  )
}

function Sheet({ items, menuId }: { items: readonly SiteNavItem[]; menuId: string }): ReactElement {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item, index) => {
        if (!isMenu(item)) {
          return (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={item.current === true ? 'page' : undefined}
                className={cn(LINK, 'px-3 py-2 text-base')}
              >
                {item.label}
              </a>
            </li>
          )
        }
        const id = `${menuId}-m${index}`
        return (
          <li key={item.label} className="flex flex-col gap-1 pt-2">
            <p id={id} className="px-3 text-xs font-medium text-muted-foreground uppercase">
              {item.label}
            </p>
            <div className="flex flex-col gap-2">
              {item.menu.map((section, at) => (
                <Section
                  key={section.title ?? at}
                  section={section}
                  id={`${id}-s${at}`}
                  sheet
                  fallbackLabel={id}
                />
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The site's top bar: brand, primary items and trailing actions. An item is a link or a menu: a menu
 * opens a panel of link rows and tiles (picture, title, one line) under it, on hover and focus (with a
 * short delay), click and Enter; Escape, a click outside or leaving closes it, and the arrow keys move
 * between the items. The panels are native popovers placed by CSS anchor positioning, so a static
 * page needs no component script; the head script only fills in hover and the arrow keys. The bar is
 * its own container: from the `wide` size the items sit inline, below it one button opens them in a
 * full-height sheet where each menu is a titled section. Every string is a prop.
 *
 * @useWhen a content site (articles, docs, a landing page) needs its top navigation, with or without menus
 * @neverWhen the page lives inside `AppShell` (the shell owns the header)
 *
 * @example
 * <SiteHeader
 *   brand={<a href="/">Basalt</a>}
 *   links={[
 *     { href: '/docs', label: 'Docs', current: true },
 *     {
 *       label: 'Product',
 *       menu: [
 *         {
 *           entries: [
 *             { href: '/charts', label: 'Charts', description: 'Marks that read at a glance', image: { src: '/charts.svg' } },
 *             { href: '/tables', label: 'Tables', description: 'Dense, sortable, keyboard first' },
 *           ],
 *         },
 *       ],
 *     },
 *   ]}
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
  const hasMenu = links.some(isMenu)
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
        <nav aria-label={navLabel} data-basalt-nav="" className="hidden flex-1 @wide:block">
          <ul className="flex items-center gap-1">
            {links.map((item, index) => (
              <DesktopItem key={item.label} item={item} id={`${menuId}-p${index}`} />
            ))}
          </ul>
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
        className={cn(
          'inset-x-0 top-14 bottom-auto m-0 w-full overflow-y-auto border-b border-border bg-background p-3 text-foreground shadow-raised',
          hasMenu ? 'h-[calc(100dvh-3.5rem)]' : 'max-h-[calc(100dvh-3.5rem)]',
        )}
      >
        <nav aria-label={navLabel}>
          <Sheet items={links} menuId={menuId} />
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
