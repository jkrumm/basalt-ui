import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Sheet, SheetContent } from '../ui/sheet'
import { overlayStoreOf } from './define-overlays'
import type {
  OverlayCall,
  OverlayEntry,
  OverlayMap,
  OverlayRegistry,
  OverlayStore,
} from './define-overlays'

export type OverlayHostProps<T extends OverlayMap> = {
  /** The registry `defineOverlays` returned. */
  overlays: OverlayRegistry<T>
  /** An overlay open from the first client render, e.g. from a deep link. A key the registry lacks is a compile error. */
  defaultOpen?: OverlayCall<T>
}

const noEntries: readonly OverlayEntry[] = []

function Overlay({
  entry,
  store,
}: {
  entry: OverlayEntry
  store: OverlayStore
}): ReactElement | null {
  const spec = store.specs[entry.key]
  if (spec === undefined) return null
  const api = { close: () => store.dismiss(entry.id) }
  const body = (spec.render as (props: unknown, api: { close: () => void }) => ReactElement)(
    entry.props,
    api,
  )
  const onOpenChange = (open: boolean): void => {
    if (!open) store.dismiss(entry.id)
  }
  const onOpenChangeComplete = (open: boolean): void => {
    if (!open) store.remove(entry.id)
  }
  if (spec.as === 'sheet') {
    return (
      <Sheet
        open={entry.open}
        onOpenChange={onOpenChange}
        onOpenChangeComplete={onOpenChangeComplete}
      >
        <SheetContent title={spec.title}>{body}</SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog
      open={entry.open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DialogContent
        title={spec.title}
        {...(spec.description !== undefined && {
          description: spec.description,
        })}
        {...(spec.size !== undefined && { size: spec.size })}
      >
        {body}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Renders the overlays a registry has open, newest on top: a `dialog` or a `sheet` by the spec's
 * `as`. Mount it once, beside the router, as an explicit child: it is the only part of the overlay
 * system that loads `ui/dialog` and `ui/sheet`. It renders nothing on the server and during
 * hydration, so a stack never mismatches.
 *
 * @useWhen an app opens overlays by key through `defineOverlays`
 * @neverWhen the app has no imperative overlays (omit it; it then ships nothing)
 *
 * @example
 * <OverlayHost overlays={OVERLAYS} />
 */
export function OverlayHost<T extends OverlayMap>({
  overlays,
  defaultOpen,
}: OverlayHostProps<T>): ReactElement {
  const store = overlayStoreOf(overlays)
  const entries = useSyncExternalStore(store.subscribe, store.snapshot, () => noEntries)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || defaultOpen === undefined) return
    seeded.current = true
    store.open(defaultOpen.key, defaultOpen.props)
  }, [store, defaultOpen])
  return (
    <>
      {entries.map((entry) => (
        <Overlay key={entry.id} entry={entry} store={store} />
      ))}
    </>
  )
}
