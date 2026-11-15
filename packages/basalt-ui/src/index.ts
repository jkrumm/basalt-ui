/**
 * basalt-ui root barrel — the theme and the state seams. The Mantine-free token/chart layer is published under `basalt-ui/tokens` and
 * `basalt-ui/charts`, NOT re-exported here, so a tokens/charts-only consumer never pulls in
 * `@mantine/*`. One import path per symbol: `docs/V2-SPEC.md` § 1; the per-symbol verdicts are
 * `docs/waves/v2-surface.md`.
 */

export { scrollParentOf, useCoarsePointer, type Tone } from './common'
export { createBasaltTheme } from './theme'
export { ThemeToggle } from './theme/theme-toggle'
export { StatusDot, type StatusDotProps } from './theme/status-dot'
export { StatusVerdict, type StatusVerdictProps } from './theme/status-verdict'
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
export type { ControlHandle, Phase, QueryStateLike, StorageLike } from './core/ports'
export type { Empty, FrameState } from './core/phase'
export { createChannel } from './core/channel'
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
export type { BasaltMessages, CalendarDate, Format, Msg } from './core/format'

// The one augmentable seam: `declare module 'basalt-ui' { interface BasaltRegister { … } }` only
// merges when the entry exports the interface. `v2-surface.md` marks it `delete` (no consumer
// *names* it), but every typed registry (commands, overlays, notifications, series) resolves
// through it — augmentation is not an import, so the consumer count missed it.
export type { BasaltRegister, SeriesKey } from './register'
