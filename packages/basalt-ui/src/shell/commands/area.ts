/**
 * The `Page area` the focus is in. With nothing focused (right after a navigation) it is the area
 * of the page on screen, so an area command is not dead until the first click.
 */
export function currentArea(): string | undefined {
  const active = document.activeElement
  if (active !== null && active !== document.body) {
    return active.closest('[data-area]')?.getAttribute('data-area') ?? undefined
  }
  const page = document.querySelector('[data-slot="shell-main"] [data-slot="page"][data-area]')
  return page?.getAttribute('data-area') ?? undefined
}
