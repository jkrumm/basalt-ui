/**
 * `basalt-ui/state` — the headless state surface: no Mantine, no JSX. The persisted and local
 * lanes are router-free; only `createSearchStore` reaches `@tanstack/react-router` (an optional peer).
 *
 * - `createPersistedState` — the versioned localStorage primitive every basalt module persists through.
 * - `field.*`, `FieldHandle`, `EnumField`, `RangeWindow` and `createLocalStore` — the store field
 *   vocabulary and the router-free store.
 * - `externalField` — a `FieldHandle` over a value another store owns (a zustand slice).
 * - `createSearchStore` — the URL-backed store (the store half of 1.x `./router-tanstack`).
 *
 * Internal consumers import the wider field types from `./state/fields`.
 */

export { createPersistedState } from './state/persisted'

export {
  field,
  externalField,
  createLocalStore,
  type EnumField,
  type FieldHandle,
  type RangeWindow,
} from './state/fields'

export { createSearchStore } from './router-tanstack/search-store'
