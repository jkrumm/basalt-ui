/**
 * `common` — the prop, ref, message and validation primitives every basalt component shares.
 *
 * Not a published subpath: the pieces are re-exported from the root barrel (`.`) so a consumer has
 * one import, and `src/surfaces.ts` stays the SSOT for real subpaths. The module is Mantine-free by
 * rule (`.oxlintrc.json`) and by test (`boundary.test.ts`), so the Mantine-free half of the library
 * may reach it too.
 */
export { type BasaltProps, type SlotClassNames, type SlotStylesProps } from './props'
export { type Tone, type ToneWithNeutral, type Tier, cx } from './props'
export { assignRef, mergeRefs } from './refs'
export {
  BASALT_PREFIX,
  requiredProp,
  oneOf,
  deprecatedProp,
  duplicateMount,
  missingLayer,
} from './errors'
export { useValidateProps, assertRequiredProps, resetValidatedProps } from './validate'
