import { SLOTS as GENERATED_SLOTS } from '../ui/slots'

export type { SlotModule } from '../ui/slots'

/**
 * Every `data-slot` each `basalt-ui/ui/*` module renders, keyed by module name: the selectors a
 * test uses instead of class names. It is the table `src/ui/slots.ts` generates, re-exported by
 * value (the same object, never a copy), so a new part shows up here with no edit.
 *
 * @useWhen a test or a browser-lane assertion selects a part, or checks that a module renders the parts it declares
 * @neverWhen the selector should be a role or an accessible name (prefer `getByRole`), or the code runs in an app bundle
 *
 * @example
 * document.querySelector(`[data-slot="${SLOTS.dialog[1]}"]`) // the dialog's content part
 */
export const SLOTS: typeof GENERATED_SLOTS = GENERATED_SLOTS
