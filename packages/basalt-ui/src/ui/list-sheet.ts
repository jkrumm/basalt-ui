import { Suspense, createElement, lazy } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import type { OverlayName } from './overlay-presenter'

export type ListSheetProps = {
  /** Overrides the root's name. */
  name?: OverlayName | undefined
  height?: 'content' | 'tall'
  /**
   * The Base UI part's own portal, for a part whose positioner insists on one (`Combobox`,
   * `Menu`, `Popover`): it renders into the sheet, not the page.
   */
  portal?: ComponentType<{ container: HTMLElement; children?: ReactNode }>
  children: ReactNode
}

/** The sheet and the drawer under it load on the first phone open, so a desktop app never pays for them. */
const SheetBody = lazy(() => import('./overlay-sheet').then((m) => ({ default: m.ListSheetBody })))

/**
 * A plain bottom sheet around a list part (`Select`, `Menu`, `Combobox`): it opens and closes with
 * the root's open state and holds the Base UI positioner and popup, so keyboard and screen-reader
 * behaviour stay the part's own. `height: 'tall'` fixes a searchable list's height so the sheet
 * does not jump as the matches change. Written without JSX so `ui/` keeps one component module per
 * primitive; the body is `overlay-sheet`, loaded on demand.
 */
export function ListSheet(props: ListSheetProps): ReactElement {
  return createElement(Suspense, { fallback: null }, createElement(SheetBody, props))
}
