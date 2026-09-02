/**
 * defineNotifications — const-generic factory for typed notification kind registries.
 * Mirrors the defineSeries pattern from ./tokens (const-generic, identity passthrough).
 *
 * Consumer augments BasaltRegister.notifications with the spec map type, then uses the typed
 * `emit` helper which resolves the registered kind at compile-time. An unknown kind is a tsc error.
 *
 * A kind's payload type is INFERRED, the same way `defineOverlays` infers an overlay's props from
 * `render` — annotate `toMessage` (or `action.run`) with the payload shape and `emit` picks it up:
 * `emit('saved', { id })` then requires that shape and a wrong one is a tsc error. A kind that never
 * annotates either function keeps today's `payload?: unknown` — additive, no existing call breaks.
 *
 * @example
 * // notifications.ts (app-side)
 * import { defineNotifications } from 'basalt-ui/notifications'
 * export const NOTIFICATIONS = defineNotifications({
 *   'upload:success': { intent: 'success', toMessage: (p: { name: string }) => `Uploaded ${p.name}` },
 *   'upload:error':   { intent: 'error',   toMessage: (_: unknown) => 'Upload failed' },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { notifications: typeof NOTIFICATIONS }
 * }
 *
 * // usage.ts
 * import { emit } from 'basalt-ui/notifications'
 * emit('upload:success', { name: 'photo.jpg' })  // ✓ typed, and the payload shape is checked
 * emit('upload:success', 'nope')                  // ✗ tsc error — wrong payload shape
 * emit('nonexistent', {})                         // ✗ tsc error — unregistered kind
 */
import type { ReactNode } from 'react'
import type { Slot } from '../register'
import { notify } from './notify'
import type { NotifyOptions, NotificationIntent } from './notify'
import type { NotificationActionRef } from './store'

export type { NotificationIntent }

// ── NotificationAction ────────────────────────────────────────────────────────

/**
 * The action a notification kind carries: a button label + a handler. The handler lives in the
 * registry (code, app-scoped) — only a serializable `{ kind, payload }` ref is persisted — so an
 * actionable notification keeps working after a reload. The handler can do anything (navigate, open
 * a modal, retry a request); it receives the same payload that was passed to `emit`.
 *
 * The payload type P is the consumer's own payload — same generic shape as `Overlay<P>` in
 * ./define-overlays, inferred from `run`'s parameter, not a separate declared field.
 */
export type NotificationAction<P = unknown> = {
  label: string
  run: (payload: P) => void
}

// ── NotificationSpecMap ───────────────────────────────────────────────────────

/**
 * A single notification kind spec — intent + optional payload→message renderer + optional action.
 *
 * The payload type P is INFERRED from `toMessage`/`action.run`'s parameter, the same mechanism
 * `defineOverlays`' `Overlay<P>` uses for `render`. Default `unknown` — a kind that annotates
 * neither function keeps taking any payload, unchanged.
 */
export type NotificationSpec<P = unknown> = {
  intent?: NotificationIntent
  toMessage?: (payload: P) => ReactNode
  action?: NotificationAction<P>
}

/** The map of kind → spec that a consumer registers. */
// oxlint-disable-next-line typescript/no-explicit-any -- load-bearing contravariant spec map, mirrors OverlayMap
export type NotificationSpecMap = Record<string, NotificationSpec<any>>

// ── Slot extraction (mirror of SeriesKey pattern in register.ts) ──────────────

/** The consumer's registered notification spec map, or `{}` when un-augmented. */
type Notifications = Slot<'notifications', NotificationSpecMap>

/**
 * The legal notification kind keys.
 * Extract<…, string> drops symbol/number members that `keyof` always includes.
 * Un-augmented: `never`. Augmented: the exact string literal union.
 */
export type NotificationKind = Extract<keyof Notifications, string>

/**
 * Extract the inferred payload type for a registered notification kind — mirrors `OverlayProps` in
 * ./define-overlays (same `infer` over the generic spec type, not a separate declared field).
 *
 * Resolves to `unknown` for a kind whose spec never annotates `toMessage`/`action.run` with a
 * payload shape — that is the additive fallback, not a failure to infer.
 */
type NotificationPayload<K extends NotificationKind> = Notifications extends {
  [_K in K]: NotificationSpec<infer V>
}
  ? V
  : unknown

// ── defineNotification (singular) ────────────────────────────────────────────

/**
 * Type a single notification spec without registering it. Identity passthrough — the payload type
 * `P` is INFERRED from `toMessage`/`action.run`'s parameter, exactly as it is inside
 * `defineNotifications`, so a spec typed here and a spec written inline behave identically.
 *
 * **It is `NotificationSpec<P>`, NOT `<const T extends NotificationSpec>(spec: T): T`** — the
 * const-generic shape every other `defineX` factory takes. Under `strictFunctionTypes` that
 * constraint rejects the example below outright: `T` must extend `NotificationSpec<unknown>`, and a
 * `toMessage: (p: { name: string }) => …` is not assignable to `(payload: unknown) => …`
 * (parameters are contravariant). The factory's own documented usage did not compile. Inferring `P`
 * instead is what makes an annotated payload the point of this file rather than a type error.
 * `.type-guard.test.ts` pins both halves.
 *
 * **WARNING:** this does NOT register the spec in the runtime registry and does NOT
 * augment BasaltRegister. Use `defineNotifications` (plural) to register a full spec
 * map and enable `emit()`. Use this only when you need to type an isolated spec constant
 * before merging it into a larger map.
 *
 * @example
 * const uploadSuccess = defineNotification({
 *   intent: 'success',
 *   toMessage: (p: { name: string }) => `Uploaded ${p.name}`,
 * })
 * // Merge into the full registry before passing to defineNotifications:
 * const NOTIFICATIONS = defineNotifications({ 'upload:success': uploadSuccess })
 */
export function defineNotification<P = unknown>(spec: NotificationSpec<P>): NotificationSpec<P> {
  return spec
}

// ── defineNotifications ───────────────────────────────────────────────────────

/**
 * Define a typed notification spec map. Const-generic identity passthrough — preserves the exact
 * literal keys so `emit('nonexistent-kind', …)` is a tsc error after augmenting BasaltRegister.
 *
 * @example
 * const NOTIFICATIONS = defineNotifications({
 *   'save:success': { intent: 'success', toMessage: () => 'Changes saved' },
 *   'save:error':   { intent: 'error',   toMessage: () => 'Failed to save' },
 * })
 */
/**
 * Module-level runtime registry. The BasaltRegister type-slot gives the compile-time kind union,
 * but the augmentation is erased at runtime — so defineNotifications also stashes the runtime spec
 * map here for emit() to resolve intent/toMessage. Call defineNotifications once (the app's single
 * notifications registry); the last call wins.
 */
let activeRegistry: NotificationSpecMap = {}

export function defineNotifications<const T extends NotificationSpecMap>(spec: T): T {
  activeRegistry = spec
  return spec
}

// ── emit ──────────────────────────────────────────────────────────────────────

/**
 * The rest-args tuple for `emit`'s payload + opts. A kind whose spec declared a payload shape
 * (`NotificationPayload<K>` is narrower than `unknown`) requires that shape as a real argument; a
 * kind that never declared one keeps `payload?: unknown` — the pre-existing, backward-compatible
 * shape.
 */
type EmitArgs<K extends NotificationKind> = [unknown] extends [NotificationPayload<K>]
  ? [payload?: unknown, opts?: Omit<NotifyOptions, 'intent' | 'message'>]
  : [payload: NotificationPayload<K>, opts?: Omit<NotifyOptions, 'intent' | 'message'>]

/**
 * Emit a registered notification kind. The kind must be a key of the consumer's registered
 * `BasaltRegister.notifications` map — any other string is a tsc error.
 *
 * Resolves the spec's intent + toMessage, then calls notify(). Extra opts override spec defaults.
 *
 * Un-augmented (Notifications = {}): NotificationKind = never → `emit` is effectively uncallable.
 * Augmented: only the registered keys are accepted, and a kind whose spec annotated
 * `toMessage`/`action.run` with a payload shape requires that shape — see {@link NotificationPayload}.
 *
 * @example
 * emit('upload:success', { name: 'photo.jpg' })
 * emit('upload:error', null, { title: 'Storage full' })
 */
export function emit<K extends NotificationKind>(kind: K, ...args: EmitArgs<K>): string {
  const [payload, opts] = args
  // The kind's compile-time validity comes from the BasaltRegister slot; the runtime spec
  // (intent/toMessage/action) comes from the registry stashed by defineNotifications.
  const spec: NotificationSpec | undefined = activeRegistry[kind]
  const intent = spec?.intent ?? 'info'
  const message = spec?.toMessage !== undefined ? spec.toMessage(payload) : kind
  // When the kind defines an action, persist a serializable ref so the center can resolve it later.
  const action: NotificationActionRef | undefined =
    spec?.action !== undefined ? { kind, payload } : undefined

  return notify({ ...opts, intent, message, ...(action !== undefined && { action }) })
}

// ── resolveAction ───────────────────────────────────────────────────────────

/**
 * Resolve a persisted action ref against the active registry — returns the button label and a
 * bound handler, or undefined if the kind is unregistered (e.g. the registry changed since the
 * item was stored). Used by the notification center to render an item's action.
 */
export function resolveAction(
  ref: NotificationActionRef,
): { label: string; run: () => void } | undefined {
  const action = activeRegistry[ref.kind]?.action
  if (action === undefined) return undefined
  return { label: action.label, run: () => action.run(ref.payload) }
}
