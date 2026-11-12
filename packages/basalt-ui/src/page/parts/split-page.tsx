import { createContext } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { ScrollArea } from '../../ui/scroll-area'
import type { SplitPageProps } from '../contract'

/**
 * `true` inside a `SplitPage` list pane: an `InnerNav` there stays a vertical list at every width,
 * because the list is the narrow screen's whole first page. Standalone it folds to a link strip.
 * Internal.
 */
export const SplitListContext = createContext(false)

/**
 * A master and a detail on one page. From the `wide` container tier the list is a sticky column
 * beside the detail; below it one pane shows, the list while `selected` is false and the detail
 * once it is true. Both render props always mount and CSS alone hides the other pane, so there is
 * no viewport read and no second tree. The list column scrolls on its own (`ScrollArea`); the
 * detail grows with the page, so the page's own scrollport (the shell's main region) stays the one
 * that scrolls the detail.
 *
 * `selected` is the pane field's `isSet`: a pane navigation (a push) flips it, so Back walks from
 * the detail to the list. The tiers are container queries: put it inside a `Page`, or any
 * `@container`.
 *
 * @useWhen a page is a list of things plus the pane for the chosen one (settings sections, a record browser)
 * @neverWhen the detail is a transient inspector over a table (use `PageAside`) or the choices are views of one dataset (use `ViewTabs`)
 *
 * @example
 * <SplitPage
 *   selected={store.field.section.isSet}
 *   list={() => <InnerNav label="Settings" state={store.field.section} groups={GROUPS} />}
 *   detail={() => <SettingsPane section={section} />}
 * />
 */
export function SplitPage({ selected, list, detail }: SplitPageProps): ReactElement {
  return (
    <div
      data-slot="split-page"
      data-selected={selected ? '' : undefined}
      className="grid min-w-0 grid-cols-1 gap-4 @wide:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] @wide:items-start"
    >
      <div
        data-slot="split-page-list"
        className={cn(
          'min-w-0 @wide:sticky @wide:top-(--page-sticky-top)',
          selected && 'hidden @wide:block',
        )}
      >
        <ScrollArea className="@wide:max-h-[calc(100dvh-var(--page-sticky-top))]">
          <SplitListContext value={true}>{list()}</SplitListContext>
        </ScrollArea>
      </div>
      <div
        data-slot="split-page-detail"
        className={cn('min-w-0', !selected && 'hidden @wide:block')}
      >
        {detail()}
      </div>
    </div>
  )
}
