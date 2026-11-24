/**
 * The command palette as a bottom sheet, its search field at the top above the keyboard and its rows
 * scrolling under it: how the palette opens on a phone under the section bar. Loaded
 * with `lazy()` by `command-palette.tsx`, so a palette that never opens as a sheet never loads the
 * drawer under it.
 */
import type { ReactElement, ReactNode } from 'react'
import { Sheet, SheetContent } from '../../ui/sheet'

/** The palette's own strings, English until the shell's message keys land. */
const PALETTE_TEXT = { search: 'Search' } as const

export function PaletteSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}): ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} placement="bottom">
      <SheetContent
        title={PALETTE_TEXT.search}
        initialFocus={() =>
          document.querySelector<HTMLElement>('[data-slot="command-palette"] input')
        }
        className="h-[min(85dvh,640px)] max-h-[min(85dvh,640px)] pb-[max(env(safe-area-inset-bottom),var(--shell-safe-bottom,0px))]"
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}
