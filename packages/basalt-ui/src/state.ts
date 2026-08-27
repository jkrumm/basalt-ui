/**
 * `basalt-ui/state` — the headless state surface: no Mantine, no router, no JSX.
 *
 * Two halves, one barrel:
 *
 * - `./state/persisted` — `createPersistedState` / `readPersistedValue`, the versioned localStorage
 *   primitive every other basalt module persists through.
 * - `./state/fields` — the store field vocabulary (`field.*`, `FieldHandle`, the lanes) and
 *   `createLocalStore`, the router-free store. `createSearchStore` (`basalt-ui/router-tanstack`)
 *   is the router-coupled factory over the same fields.
 *
 * The split is a file boundary, not a surface boundary: this barrel is what `package.json`'s
 * `./state` export resolves to, and its named exports are pinned by `scripts/export-surface.json`.
 */

export {
  createPersistedState,
  type PersistedStateOptions,
  readPersistedValue,
} from './state/persisted'

export {
  field,
  createLocalStore,
  type LocalStore,
  // The field vocabulary
  type FieldLane,
  type ResolvedLane,
  type ResolveLane,
  type RangeValue,
  type RangeParams,
  type RangePresets,
  type RangeWindow,
  type RangeWindows,
  type FieldFallback,
  type FieldSetOptions,
  type EnumField,
  type MultiField,
  type RangeField,
  type NumberField,
  type BooleanField,
  type StringField,
  type AnyField,
  type FieldValue,
  type FieldOption,
  type FieldHandle,
  type SearchValues,
  type StoredValues,
  // @internal — the seam `createSearchStore` is built on, not a consumer API.
  type FieldCodec,
  type StoreEntry,
  type StoreCoreOptions,
  type StoreCore,
  type FieldUse,
  type FieldWrite,
  resolveFieldCodec,
  createStoreCore,
} from './state/fields'
