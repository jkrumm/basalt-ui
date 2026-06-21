/**
 * defineNotifications — const-generic factory for typed notification kind registries.
 * Mirrors the defineSeries pattern from ./tokens (const-generic, identity passthrough).
 *
 * Consumer augments BasaltRegister.notifications with the spec map type, then uses the typed
 * `emit` helper which resolves the registered kind at compile-time. An unknown kind is a tsc error.
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
 * emit('upload:success', { name: 'photo.jpg' })  // ✓ typed
 * emit('nonexistent', {})                         // ✗ tsc error
 */
import type { ReactNode } from 'react'
import type { Slot } from '../register'
import { notify } from './notify'
import type { NotifyOptions, NotificationIntent } from './notify'

export type { NotificationIntent }

// ── NotificationSpecMap ───────────────────────────────────────────────────────

/** A single notification kind spec — intent + optional payload→message renderer. */
export type NotificationSpec = {
  intent?: NotificationIntent
  toMessage?: (payload: unknown) => ReactNode
}

/** The map of kind → spec that a consumer registers. */
export type NotificationSpecMap = Record<string, NotificationSpec>

// ── Slot extraction (mirror of SeriesKey pattern in register.ts) ──────────────

/** The consumer's registered notification spec map, or `{}` when un-augmented. */
type Notifications = Slot<'notifications', NotificationSpecMap>

/**
 * The legal notification kind keys.
 * Extract<…, string> drops symbol/number members that `keyof` always includes.
 * Un-augmented: `never`. Augmented: the exact string literal union.
 */
export type NotificationKind = Extract<keyof Notifications, string>

// ── defineNotification (singular) ────────────────────────────────────────────

/**
 * Type a single notification spec without registering it.
 * Identity passthrough — preserves the exact literal shape for local type-checking.
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
export function defineNotification<const T extends NotificationSpec>(spec: T): T {
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
 * Emit a registered notification kind. The kind must be a key of the consumer's registered
 * `BasaltRegister.notifications` map — any other string is a tsc error.
 *
 * Resolves the spec's intent + toMessage, then calls notify(). Extra opts override spec defaults.
 *
 * Un-augmented (Notifications = {}): NotificationKind = never → `emit` is effectively uncallable.
 * Augmented: only the registered keys are accepted.
 *
 * @example
 * emit('upload:success', { name: 'photo.jpg' })
 * emit('upload:error', null, { title: 'Storage full' })
 */
export function emit(
  kind: NotificationKind,
  payload?: unknown,
  opts?: Omit<NotifyOptions, 'intent' | 'message'>,
): string {
  // The kind's compile-time validity comes from the BasaltRegister slot; the runtime spec
  // (intent/toMessage) comes from the registry stashed by defineNotifications.
  const spec: NotificationSpec | undefined = activeRegistry[kind]
  const intent = spec?.intent ?? 'info'
  const message = spec?.toMessage !== undefined ? spec.toMessage(payload) : kind

  return notify({ ...opts, intent, message })
}
