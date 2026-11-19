import { createContext, useRef } from 'react'
import type { ReactElement, RefObject } from 'react'
import { focusLost } from '../../common/focus'
import { useIsomorphicLayoutEffect } from '../../common/isomorphic-layout-effect'
import { cn } from '../../core/cn'
import { page } from '../../core/messages/page'
import { useMessages } from '../../core/messages/use-messages'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'
import type { SplitPageProps } from '../contract'

/**
 * `true` inside a `SplitPage` list pane: an `InnerNav` there stays a vertical list at every width,
 * because the list is the narrow screen's whole first page. Standalone it folds to a link strip.
 * Internal.
 */
export const SplitListContext = createContext(false)

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const isHidden = (pane: HTMLElement): boolean => getComputedStyle(pane).display === 'none'

/** What a pane hands focus to: `target` where it is set and present, else the pane's first focusable. */
function focusIn(pane: HTMLElement, target: HTMLElement | null): void {
  const el = target ?? pane.querySelector<HTMLElement>(FOCUSABLE)
  if (el !== null) {
    el.focus({ preventScroll: true })
    return
  }
  pane.tabIndex = -1
  pane.focus({ preventScroll: true })
}

/**
 * Below `wide` a flip of `selected` hides the pane that held focus: the back link goes with the
 * detail, an `InnerNav` choice with the list, and focus falls to `<body>`. This moves it to the pane
 * the page now shows: on select the detail's heading (it takes focus without joining the tab
 * order), else its first focusable; on back the list's current item. At `wide` both panes stay
 * visible and focus stays where it is, and a first render (a deep link) never moves it.
 */
function useSplitFocus(
  selected: boolean,
  list: RefObject<HTMLDivElement | null>,
  detail: RefObject<HTMLDivElement | null>,
): void {
  const was = useRef(selected)
  useIsomorphicLayoutEffect(() => {
    if (was.current === selected) return
    was.current = selected
    const [shown, hidden] = selected
      ? [detail.current, list.current]
      : [list.current, detail.current]
    if (shown === null || hidden === null || !isHidden(hidden) || isHidden(shown)) return
    const active = document.activeElement
    if (!focusLost() && !(active instanceof Node && hidden.contains(active))) return
    if (selected) {
      const heading = shown.querySelector<HTMLElement>('h1, h2, h3')
      if (heading !== null) heading.tabIndex = -1
      focusIn(shown, heading)
      return
    }
    focusIn(shown, shown.querySelector<HTMLElement>('[aria-current]'))
  }, [selected, list, detail])
}

/**
 * A master and a detail on one page. From the `wide` container tier the list is a sticky column
 * beside the detail; below it one pane shows, the list while `selected` is false and the detail
 * once it is true. Both render props always mount and CSS alone hides the other pane, so there is
 * no viewport read and no second tree. The list column scrolls on its own (`ScrollArea`); the
 * detail grows with the page, so the page's own scrollport (the shell's main region) stays the one
 * that scrolls the detail.
 *
 * `selected` is the pane field's `useIsSet()`: choosing a pane (a push) flips it, the fallback
 * pane included, so Back walks from the detail to the list. `onBack` is the same field's `clear`:
 * below `wide` it draws a back link above the detail, for an installed app that has no browser Back. The tiers are container queries: put
 * it inside a `Page`, or any `@container`.
 *
 * @useWhen a page is a list of things plus the pane for the chosen one (settings sections, a record browser)
 * @neverWhen the detail is a transient inspector over a table (use `PageAside`) or the choices are views of one dataset (use `ViewTabs`)
 *
 * @example
 * <SplitPage
 *   selected={store.field.section.useIsSet()}
 *   onBack={store.field.section.clear}
 *   list={() => <InnerNav label="Settings" state={store.field.section} groups={GROUPS} />}
 *   detail={() => <SettingsPane section={section} />}
 * />
 */
export function SplitPage({
  selected,
  onBack,
  backLabel,
  list,
  detail,
}: SplitPageProps): ReactElement {
  const t = useMessages(page)
  const listPane = useRef<HTMLDivElement>(null)
  const detailPane = useRef<HTMLDivElement>(null)
  useSplitFocus(selected, listPane, detailPane)
  return (
    <div
      data-slot="split-page"
      data-selected={selected ? '' : undefined}
      className="grid min-w-0 grid-cols-1 gap-4 @wide:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] @wide:items-start"
    >
      <div
        ref={listPane}
        data-slot="split-page-list"
        className={cn(
          'min-w-0 @wide:sticky @wide:top-(--page-sticky-top)',
          selected && 'hidden @wide:block',
        )}
      >
        {/* The pane scrolls, so it clips: its padding is the room the 4px link rings need, taken back by the margin. The margin is no wider, so the scroller's own ring (it takes a tab stop while it overflows) still fits the 8px phone gutter. */}
        <ScrollArea className="-m-1 p-1 @wide:max-h-[calc(100dvh-var(--page-sticky-top))]">
          <SplitListContext value={true}>{list()}</SplitListContext>
        </ScrollArea>
      </div>
      <div
        ref={detailPane}
        data-slot="split-page-detail"
        className={cn(
          'min-w-0',
          !selected && 'hidden @wide:block',
          // The back link sits above the detail in one column; beside the list the pane is plain block.
          selected && onBack !== undefined && 'grid grid-cols-[minmax(0,1fr)] gap-2 @wide:block',
        )}
      >
        {selected && onBack !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            data-split-back=""
            className="justify-self-start @wide:hidden"
            onClick={onBack}
          >
            <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {backLabel ?? t('page.backToList')}
          </Button>
        )}
        {detail()}
      </div>
    </div>
  )
}
