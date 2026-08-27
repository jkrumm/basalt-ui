/**
 * `field.*` — the field vocabulary `createSearchStore` takes, re-exported at the surface a consumer
 * imports it from (`basalt-ui/router-tanstack`, beside the store factory).
 *
 * The builders and their codecs LIVE in `../state` on purpose: a field is declarative data with no
 * router in it, and `createLocalStore` — the router-free lane, published on `basalt-ui/state` —
 * has to build the same fields without pulling in `@tanstack/react-router`. One definition, two
 * surfaces, no second description of the same param.
 *
 * Full field reference: the JSDoc on `field` itself, and `docs/CONTROLS-SPEC.md` §4.
 */
export { field } from '../state'
export type {
  AnyField,
  BooleanField,
  EnumField,
  FieldFallback,
  FieldHandle,
  FieldLane,
  FieldOption,
  FieldSetOptions,
  FieldValue,
  MultiField,
  NumberField,
  RangeField,
  RangeParams,
  RangePresets,
  RangeWindow,
  RangeWindows,
  RangeValue,
  ResolvedLane,
  SearchValues,
  StoredValues,
  StringField,
} from '../state'
