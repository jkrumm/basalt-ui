import type { Popover } from '@base-ui/react/popover'

/**
 * The one positioner setup every anchored popup (popover, menu, submenu, select, combobox,
 * autocomplete, preview card, info hint, model picker) and the tooltip spread onto their Base UI
 * `Positioner`, so a popup is placed the same way everywhere:
 *
 * - `collisionPadding` keeps an 8 px gutter to every window edge (the phone page gutter);
 * - `side` flips to the opposite side when its own does not fit, `align` shifts along the edge
 *   so the popup slides in instead of running off it, and `fallbackAxisSide` turns to the end of
 *   the other axis when neither side fits.
 *
 * With the padding set, Base UI writes the room that is left into `--available-width` and
 * `--available-height` on the positioner. Every popup content class reads them
 * (`max-h-(--available-height) max-w-(--available-width) overflow-x-hidden overflow-y-auto`), so a
 * popup is never wider or taller than the window leaves it and never scrolls sideways: wider
 * content has to reflow, and `popup-fit.layout.test.ts` fails on content that does not.
 *
 * @example
 * <BasePopover.Positioner {...POPUP_POSITIONER} sideOffset={4} className={POPUP_POSITIONER_CLASS} />
 */
export const POPUP_POSITIONER = {
  collisionPadding: 8,
  collisionAvoidance: { side: 'flip', align: 'shift', fallbackAxisSide: 'end' },
} as const satisfies Pick<Popover.Positioner.Props, 'collisionPadding' | 'collisionAvoidance'>

/**
 * The positioner's classes: stacked above the page, never wider than the room the window leaves
 * (a tooltip or a small popup narrows inside it instead of running off).
 */
export const POPUP_POSITIONER_CLASS = 'z-50 max-w-(--available-width) outline-none'
