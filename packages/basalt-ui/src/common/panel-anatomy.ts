/**
 * The one panel anatomy `Peek`, `Dock`, `PageAside` and a right `Sheet` draw: a header at the bar
 * height (lead, title, tag, then the controls and close), a body that scrolls and an optional footer
 * band. Class strings only, so the `ui` and the `page` layer read one source. Internal.
 */

/**
 * The header row: 48px, and under a shell at least the page bar band's height (`--page-bar-h`), so
 * a side panel's hairline meets the band's; the title's lead inset, the controls' tighter end inset.
 */
export const PANEL_HEADER =
  'flex h-12 min-h-(--page-bar-h) shrink-0 items-center gap-1 border-b border-border ps-4 pe-2 outline-none'

/** The record's heading in the header. */
export const PANEL_TITLE =
  'm-0 min-w-0 flex-1 truncate font-head text-sm font-semibold text-foreground'

/** The short mono tag before the title (`#12`). */
export const PANEL_TAG = 'shrink-0 font-mono text-xs text-muted-foreground'

/** The leading glyph or avatar's box, before the title. */
export const PANEL_LEAD = 'me-1 flex shrink-0 items-center text-muted-foreground'

/** The scrolling body. */
export const PANEL_BODY = 'min-h-0 flex-1 overscroll-contain p-4'

/** The footer band a form's actions sit in. */
export const PANEL_FOOTER =
  'flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3'

/** The hairline between the record's actions and the presentation menu and close. */
export const PANEL_DIVIDER = 'mx-1 h-4 w-px shrink-0 bg-border'

/** The widest a side panel goes under a shell: never closer than 3rem to the rail. */
export const PANEL_MAX = 'calc(100vw - var(--shell-rail-w, 0px) - 3rem)'
