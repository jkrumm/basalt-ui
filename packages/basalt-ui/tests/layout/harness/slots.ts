/**
 * Selector handles that name NO component library: the `data-slot` attribute every v3 composite
 * stamps on its parts, the `data-basalt-*` handles consumers are promised, and the few structural
 * selectors (`aria-label`, `data-testid`, CSS-module locals) the suite has always keyed to.
 *
 * Nothing here imports a composite. A test grades a composite by its slot name, so the engine stays
 * able to measure a document that has no composite on it at all.
 */

/** An element by its `data-slot` — `slot('card-header')` → `[data-slot="card-header"]`. */
export function slot(name: string): string {
  return `[data-slot="${name}"]`
}

/**
 * A slot INSIDE another slot or selector, as a descendant. Slot names repeat across composites
 * (a `title` lives in a card and in a dialog), so an unscoped `slot('title')` resolves to whichever
 * comes first in document order — scope it, which is how a geometry assertion avoids going vacuous.
 */
export function slotWithin(scope: string, name: string): string {
  return `${scope} ${slot(name)}`
}

/** A slot that is a DIRECT child of `scope`, for a part that must not match its nested namesake. */
export function slotChildOf(scope: string, name: string): string {
  return `${scope} > ${slot(name)}`
}

/** A consumer-promised `data-basalt-<name>` handle — `handle('scrollport')` → `[data-basalt-scrollport]`. */
export function handle(name: string): string {
  return `[data-basalt-${name}]`
}

/** A bar slot by accessible name — `aria-label={slot.label}` on both link and surface tabs. */
export function tab(label: string): string {
  return `${BAR} [aria-label="${label}"]`
}

export const BAR = 'nav[aria-label="Primary"]'
export const BAR_SLOTS = `${BAR} > *`
/**
 * The ACTIVE PILL. It is the slot's icon span — the pill is that span's own background, which is
 * why an icon-less consumer used to get a 24x4px dash instead of an indicator. `> span` is a
 * direct child, so it never matches the nested unread dot, and the label renders as a `<p>`.
 */
export const ACTIVE_PILL = `${BAR} [data-active] > span`
/** The glyph inside the active pill — the bar normalizes it to the icon-size token. */
export const ACTIVE_PILL_ICON = `${ACTIVE_PILL} > svg`
export const CONTENT_END = '[data-testid="content-end"]'
/** The shell's main region — THE scrollport, by its own declared handle, because that attribute is
 * the thing consumers are promised. */
export const MAIN = handle('scrollport')

/**
 * A CSS-MODULE class, by the local name it is authored under.
 *
 * `Bun.build` compiles `*.module.css` to `<local>_<per-file hash>` (VERIFIED in the fixture's own
 * bundle: `.bar_Gdyk4Q`, `.menuDropdown_7QmWJg`), and the hash tracks the file's CONTENTS — it moves
 * every time the module is edited, so it can never be written down here.
 *
 * The match is ANCHORED (`^` for a sole class, `" "` for one in a list) rather than a bare
 * `[class*="bar_"]`, which also matches a `.sidebar_…` or a `.toolbar_…` that does not exist today
 * and would be found by the wrong test on the day it does.
 *
 * ALWAYS SCOPE IT to a library static class or a `data-basalt-*` handle. Local names repeat across
 * modules by design: `.lead` is declared by BOTH `shell/app-header.module.css` (the breadcrumb side
 * of the header row, floored at `min-width: 96px`) and `shell/page-bar.module.css` (row 1's own
 * lead, `min-width: 0`), and `.bar` by three modules. An unscoped match resolves to whichever
 * happens to come first in document order, which is how a geometry assertion goes quietly vacuous.
 */
export function moduleClass(local: string): string {
  return `:is([class^="${local}_"],[class*=" ${local}_"])`
}
