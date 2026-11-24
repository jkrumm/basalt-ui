import { createElement, useState } from 'react'
import type { ReactElement } from 'react'
import { useOverlay } from './overlay-presenter'
import type { OverlayName } from './overlay-presenter'
import type { ListSheetProps } from './list-sheet'
import { Sheet, SheetContent } from './sheet'

/** The text a sheet is named with: the label, or the text of the element the id names. */
function nameText(name: OverlayName | undefined): string {
  if (name === undefined) return ''
  if ('aria-label' in name) return name['aria-label']
  return document.getElementById(name['aria-labelledby'])?.textContent ?? ''
}

/**
 * The body of `ListSheet`, the one module that imports `Sheet` for the list overlays. `ListSheet` loads it
 * lazily, and it is written without JSX like it.
 */
export function ListSheetBody({
  name,
  height,
  portal,
  children,
}: ListSheetProps): ReactElement | null {
  const overlay = useOverlay()
  const [host, setHost] = useState<HTMLElement | null>(null)
  if (overlay === null) return null
  const inner =
    portal === undefined
      ? children
      : createElement(
          'div',
          { ref: setHost, className: 'flex min-h-0 flex-1 flex-col' },
          host === null ? null : createElement(portal, { container: host }, children),
        )
  const content = {
    plain: true,
    title: nameText(name ?? overlay.name),
    'data-present': 'sheet',
    ...(height === 'tall' && { className: 'h-[min(34rem,80dvh)]' }),
  }
  return createElement(
    Sheet,
    { open: overlay.open, onOpenChange: overlay.setOpen, placement: 'bottom' },
    createElement(SheetContent, content, inner),
  )
}
