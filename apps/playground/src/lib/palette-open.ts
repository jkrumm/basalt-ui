/**
 * The one request to open the shell's command palette from a page: the root layout owns the palette's
 * open state and listens here, so a page that shows how the palette presents itself needs no second
 * palette.
 */
const target = new EventTarget()

/** Asks the root layout to open the palette. */
export function openPalette(): void {
  target.dispatchEvent(new Event('open'))
}

/** The root layout's side: runs `onOpen` for each request; returns the unsubscribe. */
export function onPaletteRequest(onOpen: () => void): () => void {
  target.addEventListener('open', onOpen)
  return () => target.removeEventListener('open', onOpen)
}
