/**
 * Print: the frame steps aside so the page prints in full (concept section 2, row Print).
 *
 * The screen frame is a `100dvh` grid whose `Main` is the one scrollport, and a paged medium prints
 * only what that box shows: a table of 80 rows came out as 24. In print the frame is a plain block,
 * `Main` unclips and the chrome (rail, header, tab bar, aside) is off. The class strings live here
 * so the print rules are one reviewable list; the grid and the parts spread them in.
 */
import { useEffect } from 'react'

/** The root: a block that grows with its content. */
export const PRINT_FRAME = 'print:block print:h-auto print:overflow-visible'

/** `Main`: unclipped, so every row of a long table reaches the printer. */
export const PRINT_MAIN = 'print:block print:h-auto print:overflow-visible'

/** Every region that is chrome and not content. */
export const PRINT_OFF = 'print:hidden'

/**
 * Prints in the light scheme. The tokens switch on `:root[data-theme]`, which no class on a
 * descendant can undo, so the attribute is swapped for the print and put back after it.
 */
export function usePrintScheme(): void {
  useEffect(() => {
    const root = document.documentElement
    let before: string | null = null
    const enter = (): void => {
      before = root.getAttribute('data-theme')
      if (before !== null) root.setAttribute('data-theme', 'light')
    }
    const leave = (): void => {
      if (before !== null) root.setAttribute('data-theme', before)
      before = null
    }
    window.addEventListener('beforeprint', enter)
    window.addEventListener('afterprint', leave)
    return () => {
      window.removeEventListener('beforeprint', enter)
      window.removeEventListener('afterprint', leave)
      leave()
    }
  }, [])
}
