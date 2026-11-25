import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Slot } from './types'

export type SiteTabsProps = {
  /** The tab list's accessible name ("Install with"). */
  label: string
  /** The tab names in order; each is the `label` of one `SiteTab` panel. The first is open. */
  tabs: readonly string[]
  /** The `SiteTab` panels, in the order of `tabs`. */
  children: Slot
  className?: string
}

export type SiteTabProps = {
  /** The tab this panel belongs to: one of the `tabs` of its `SiteTabs`. */
  label: string
  children: Slot
  className?: string
}

/**
 * Panels are told apart by CSS and one attribute, never by a prop: an MDX compiler hands a part its
 * children as finished HTML, so `SiteTabs` cannot read them. Where the head script has run
 * (`data-basalt-js` on the document) only the first panel shows until a tab is picked (a panel after
 * another panel hides); without it
 * every panel shows in turn under its name and the tab row is hidden.
 */
const ROOT = [
  'flex flex-col gap-3 in-[.basalt-prose]:mt-(--basalt-rhythm-2)',
  '[:root[data-basalt-js]_&_[role=tabpanel]~[role=tabpanel]]:hidden',
  '[:root[data-basalt-js]_&[data-picked]_[role=tabpanel]]:hidden',
  '[:root[data-basalt-js]_&[data-picked]_[role=tabpanel][data-on]]:block',
].join(' ')

/**
 * Tabs as platform markup: a WAI-ARIA tab list and its panels, with no React on the page.
 * `siteScript()` switches panels on click and with the arrow keys, Home and End, and links each tab
 * to its panel. Without the script every panel shows under its name. The panels are `SiteTab`s.
 *
 * @useWhen an article offers the same content in variants (package managers, languages) and the page ships no client JavaScript
 * @neverWhen the open tab must follow the URL or drive other parts (use `Tabs` from `basalt-ui/ui/tabs` in an app or an island)
 *
 * @example
 * <SiteTabs label="Install with" tabs={['bun', 'npm']}>
 *   <SiteTab label="bun">bun add basalt-ui</SiteTab>
 *   <SiteTab label="npm">npm i basalt-ui</SiteTab>
 * </SiteTabs>
 */
export function SiteTabs({ label, tabs, children, className }: SiteTabsProps): ReactElement {
  return (
    <div data-slot="tabs" data-basalt-tabs="" className={cn(ROOT, className)}>
      <div
        role="tablist"
        aria-label={label}
        className="flex shrink-0 items-center gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--basalt-hairline)] [:root:not([data-basalt-js])_&]:hidden"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            data-tab={tab}
            aria-selected={index === 0}
            tabIndex={index === 0 ? 0 : -1}
            className="relative inline-flex h-ctl shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 font-medium whitespace-nowrap text-muted-foreground select-none focus-ring transition-colors hover:text-foreground focus-visible:-outline-offset-2 aria-selected:border-brand aria-selected:text-foreground motion-reduce:transition-none"
          >
            {tab}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}

/**
 * One panel of `SiteTabs`, named by `label`. It renders on its own, so it works as an MDX tag
 * between the opening and closing `Tabs`.
 *
 * @useWhen a `SiteTabs` needs the content of one of its tabs
 * @neverWhen the content is not one of the `tabs` names of an enclosing `SiteTabs`
 *
 * @example
 * <SiteTab label="bun">bun add basalt-ui</SiteTab>
 */
export function SiteTab({ label, children, className }: SiteTabProps): ReactElement {
  return (
    <div
      role="tabpanel"
      data-label={label}
      tabIndex={0}
      className={cn(
        'min-w-0 focus-ring before:mb-1 before:block before:font-medium before:text-foreground [:root:not([data-basalt-js])_&]:before:content-[attr(data-label)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
