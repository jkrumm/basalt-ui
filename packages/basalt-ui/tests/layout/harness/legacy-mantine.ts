/**
 * LEGACY — every selector keyed to a Mantine static class name (`mantine-<Component>-<selector>`).
 *
 * This is the one module a Mantine rename or removal touches. It exists so the engine and the
 * `data-slot` handles stay free of Mantine while the selector-bound layout tests are re-pointed at
 * slots (shell-i1); when the last of them is, this file is deleted and nothing else changes.
 *
 * A rename fails as an explicit `LAYOUT: no element matched …` rather than as a silent pass — the
 * right failure mode, but it does mean a Mantine major touches this block.
 */
import { registerOverlaySelectors } from './engine'
import { moduleClass } from './slots'

export const SHEET = '.mantine-Drawer-content'
/**
 * SCOPED to the drawer ON PURPOSE. The desktop sidebar is still mounted (merely hidden) below the
 * `sm` breakpoint: measured, a 7-row sheet yields 7 rows scoped and **15** unscoped. An unscoped
 * row query silently measures sidebar rows and every touch-target assertion goes vacuous.
 */
export const SHEET_ROWS = `${SHEET} .mantine-NavLink-root`
export const SHEET_BODY = `${SHEET} .mantine-ScrollArea-viewport`
export const MENU = '.mantine-Menu-dropdown'

/**
 * `AppShell.Header` — the header BAND, one `appShellHeaderHeight` row at every viewport (law C14).
 * Its own inline padding is the responsive page gutter, the same pair `AppShell` gets.
 */
export const HEADER = '.mantine-AppShell-header'
/** The header's single row: `[brand zone] [breadcrumb] ···· [page bar row 1] | [globals]`. */
export const HEADER_ROW = `${HEADER} > ${moduleClass('bar')}`
/** The ELASTIC side of that row — the breadcrumb wrapper, and the only side that may ellipsize. */
export const HEADER_LEAD = `${HEADER_ROW} > ${moduleClass('lead')}`
/** `PageBar` row 1's portal target — the RIGID side. Descendant, not child: it is a child today. */
export const HEADER_PAGE_BAR = `${HEADER_ROW} ${moduleClass('pageBar')}`
/** The shell's own trailing action cluster. A DESCENDANT — `CtlSlot` sits between it and the row
 * as a `display: contents` Box, so it is a grandchild in the DOM and a flex item in layout. */
export const HEADER_GLOBAL = `${HEADER_ROW} ${moduleClass('global')}`

/** `AppShell.Navbar` — the desktop sidebar's region. Mounted (merely hidden) below `sm`. */
export const NAVBAR = '.mantine-AppShell-navbar'
/** The sidebar's nav SCROLLPORT — a Mantine `ScrollArea` viewport, not the navbar itself. */
export const NAV_VIEWPORT = `${NAVBAR} .mantine-ScrollArea-viewport`
/** Nav rows, SCOPED to that viewport so the footer's own rows never count as nav rows. */
export const NAV_ROWS = `${NAV_VIEWPORT} .mantine-NavLink-root`
/** The shell's page-bar band — the in-flow strip between the header and Main's scrollport. */
export const MAIN_BAND = `.mantine-AppShell-root > ${moduleClass('band')}`
/** `AppShell.Aside` — the right-hand region a route claims with `PageAside`. */
export const ASIDE_REGION = 'aside.mantine-AppShell-aside'

/** The header's leading zone — the brand name plus the collapse toggle, `--app-shell-navbar-offset` wide. */
export const HEADER_ZONE = `${HEADER_ROW} > ${moduleClass('zone')}`
/** The collapse toggle, whichever way it currently points. */
export const COLLAPSE_TOGGLE = `${HEADER_ZONE} button[aria-label$=" sidebar"]`

/** The sidebar's pinned footer region — settings rows plus the account row. */
export const SIDEBAR_FOOTER = `${NAVBAR} ${moduleClass('footer')}`

/** The Mantine overlays `census()` counts, on top of the engine's own `[role="dialog"]`. */
export const MANTINE_OVERLAYS = [
  '.mantine-Drawer-root',
  '.mantine-Modal-root',
  '.mantine-Menu-dropdown',
  '.mantine-Popover-dropdown',
] as const

registerOverlaySelectors(...MANTINE_OVERLAYS)
