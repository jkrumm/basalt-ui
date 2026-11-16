/**
 * The default detail host of a table (docs/v3/concepts/data-table.md section 6): a sheet that shows
 * the entry a row activation hands it. A caller's own `DetailHost` wins, then the enclosing
 * `Page`'s (its `PageAside`, no wiring); without either, the body of the table brings this sheet, so a row tap always lands somewhere and a column a
 * tier hides is reachable.
 */
import { useContext, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { DetailEntry, DetailHost } from '../../core/ports'
import { DetailHostContext } from '../../page/page'
import { Sheet, SheetContent } from '../../ui/sheet'
import type { TableModel } from '../use-data-table'

/**
 * Registers the host on the model (the caller's, else the page's, else the sheet below) and returns the sheet to
 * render beside the rows. A closed sheet draws nothing, so this is safe inside a `<tbody>`.
 */
export function useDetailHost<T>(
  model: TableModel<T>,
  detail: DetailHost | undefined,
): ReactElement {
  const page = useContext(DetailHostContext)
  const [entry, setEntry] = useState<DetailEntry | null>(null)
  const own: DetailHost = {
    isOpen: entry !== null,
    show: setEntry,
    hide: () => setEntry(null),
  }
  const close = (): void => {
    setEntry(null)
    model.closeDetail()
  }
  const host = detail ?? page ?? own
  const kind = detail !== undefined ? 'caller' : page !== null ? 'page' : 'own'
  const wasOpen = useRef(false)
  const seenKind = useRef(kind)
  useEffect(() => {
    model.setHost(host, kind)
    // The host that took over has not shown the entry yet: what the last one showed is not its close.
    if (seenKind.current !== kind) {
      seenKind.current = kind
      wasOpen.current = false
    }
    // A host closes on its own terms (the page's aside, a caller's panel), so the row it showed is
    // no longer the open one. Only a host seen open can close: one that has not shown the entry yet
    // (a deep link's first commit, a host that just took over) is not a close.
    if (host.isOpen) wasOpen.current = true
    else if (wasOpen.current) {
      wasOpen.current = false
      model.closeDetail(true)
    }
  })
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent title={entry?.title ?? ''}>
        {entry?.body({ height: 'fill', phase: 'ready' })}
      </SheetContent>
    </Sheet>
  )
}
