/**
 * `basalt-ui/state` — the headless state surface: no Mantine, no router, no JSX.
 *
 * - `createPersistedState` — the versioned localStorage primitive every basalt module persists through.
 * - `field.*`, `FieldHandle`, `EnumField`, `RangeWindow` and `createLocalStore` — the store field
 *   vocabulary and the router-free store. The router-coupled `createSearchStore` moves here in a
 *   later wave; internal consumers import the wider field types from `./state/fields`.
 */

export { createPersistedState } from './state/persisted'

export {
  field,
  createLocalStore,
  type EnumField,
  type FieldHandle,
  type RangeWindow,
} from './state/fields'
