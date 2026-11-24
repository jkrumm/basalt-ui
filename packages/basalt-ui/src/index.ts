/**
 * basalt-ui root barrel — the state seams only. The token/chart layer is published under
 * `basalt-ui/tokens` and `basalt-ui/charts`, NOT re-exported here, so a tokens/charts-only consumer
 * pulls in no UI library. One import path per symbol: `docs/v3/ARCHITECTURE.md` § 4.
 */

export {
  persisted,
  type Persisted,
  type PersistedOptions,
  type PersistedSchema,
} from './core/persisted'
export { notify, type NotificationPayload } from './core/notify'
export {
  externalField,
  type PlainStore,
  type StateFieldOptions,
  type StateStore,
} from './core/external-field'
export type { StorageLike } from './core/ports'

// The app's root provider and the two writers of the reader's choices on `<html>`. `basalt-ui/router`
// re-exports the same `BasaltProvider` beside `routerDefaults`, the entry `init` writes.
export { BasaltProvider } from './core/provider'
export type { BasaltProviderProps, LiveBinding } from './core/provider'
export { IntlScope } from './core/provider-props'
export type { BasaltIntlProps } from './core/provider-props'
export { setScheme } from './core/scheme'
export type { Scheme } from './core/scheme'
export { setAppearance } from './core/appearance'
export type {
  Appearance,
  AppearanceChange,
  AppearanceDensity,
  AppearanceFrame,
} from './core/appearance'

// The ports every subpath's props name: a router-free part takes `string | NavTarget`, an icon, a
// field another store owns, a detail host and a drag source through these, never through `core/*`.
export type {
  Box,
  BoxSlot,
  DetailEntry,
  DetailHost,
  DragData,
  DragEdge,
  DragLike,
  FieldLike,
  IconComponent,
  LinkComponent,
  NavTarget,
  RecordSequence,
} from './core/ports'

// The frame's value types live on `basalt-ui/cards` and `ControlHandle` on `basalt-ui/router`; these five stay one minor as aliases of the
// same types (migration rows `cards-frame-types-*` and `router-control-handle`).
import type { Empty as CardsEmpty, FrameState as CardsFrameState } from './core/phase'
import type {
  ControlHandle as RouterControlHandle,
  Phase as CardsPhase,
  QueryStateLike as CardsQueryStateLike,
} from './core/ports'

/** @deprecated Import `ControlHandle` from `basalt-ui/router`; this alias is removed in the next minor. */
export type ControlHandle<T> = RouterControlHandle<T>
/** @deprecated Import `Phase` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type Phase = CardsPhase
/** @deprecated Import `QueryStateLike` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type QueryStateLike = CardsQueryStateLike
/** @deprecated Import `Empty` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type Empty = CardsEmpty
/** @deprecated Import `FrameState` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type FrameState = CardsFrameState
export type {
  Channel,
  ChannelOptions,
  ChannelState,
  Delivered,
  Envelope,
  Scheduler,
  Transport,
  Wire,
} from './core/channel'
export { useNow } from './core/use-now'
export { createFormat, useFormat } from './core/format'
export { setFormatDefaults } from './format/shared'
export type { FormatDefaults } from './format/shared'
export type { BasaltMessages, CalendarDate, Format, Msg } from './core/format'

// The one augmentable seam: `declare module 'basalt-ui' { interface BasaltRegister { … } }` only
// merges when the entry exports the interface. `v2-surface.md` marks it `delete` (no consumer
// *names* it), but every typed registry (commands, overlays, notifications) resolves through it —
// augmentation is not an import, so the consumer count missed it.
export type { BasaltRegister } from './register'
