/**
 * define-overlays — const-generic factory for typed overlay registries.
 *
 * Consumer defines overlays with defineOverlays, augments BasaltRegister.overlays, then uses the
 * `overlays` imperative controller — unknown keys are tsc errors. The type slot gives the
 * compile-time key union; the module-level stash gives the runtime values.
 *
 * Uses @mantine/modals under the hood. ModalsProvider must be mounted (BasaltOverlays does this).
 *
 * @example
 * // overlays.ts (app-side)
 * import { defineOverlays } from 'basalt-ui/commands'
 * export const OVERLAYS = defineOverlays({
 *   'confirm:delete': {
 *     title: 'Delete item?',
 *     render: (p: { name: string }) => <Text>Delete "{p.name}"?</Text>,
 *   },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { overlays: typeof OVERLAYS }
 * }
 *
 * // usage.ts
 * import { overlays } from 'basalt-ui/commands'
 * overlays.open('confirm:delete', { name: 'photo.jpg' })  // ✓ typed
 * overlays.open('nonexistent', {})                         // ✗ tsc error
 */
import type { ReactNode } from 'react'
import { modals } from '@mantine/modals'
import type { Slot } from '../register'

// ── Overlay + OverlayMap ──────────────────────────────────────────────────────

/**
 * A single registered overlay. The per-overlay props type P is the consumer's own payload.
 *
 * @example
 * const overlay: Overlay<{ name: string }> = {
 *   title: 'Delete item?',
 *   render: ({ name }) => <Text>Delete "{name}"?</Text>,
 * }
 */
// Default is Record<string, unknown> so a bare Overlay (no type arg) doesn't silently become any
export type Overlay<P = Record<string, unknown>> = {
  /** Optional modal title (ReactNode for rich headers). */
  title?: ReactNode
  /** Render the modal body for a given payload. */
  render: (props: P) => ReactNode
}

/**
 * The map of overlay key → Overlay that a consumer registers.
 *
 * @example
 * const map: OverlayMap = {
 *   'confirm:delete': { title: 'Confirm', render: (p: { name: string }) => <span>{p.name}</span> },
 * }
 */
// oxlint-disable-next-line typescript/no-explicit-any -- load-bearing contravariant overlay map
export type OverlayMap = Record<string, Overlay<any>>

// ── Slot extraction ───────────────────────────────────────────────────────────

/** The consumer's registered overlay map, or `{}` when un-augmented. */
type Overlays = Slot<'overlays', OverlayMap>

/**
 * The legal overlay keys.
 * Extract<…, string> drops symbol/number members that `keyof` always includes.
 * Un-augmented: `never`. Augmented: the exact string literal union.
 *
 * @example
 * const key: OverlayKey = 'confirm:delete'  // ✓ after augmenting
 * const bad: OverlayKey = 'no-such-key'     // ✗ tsc error
 */
export type OverlayKey = Extract<keyof Overlays, string>

// ── Runtime stash ─────────────────────────────────────────────────────────────

/**
 * Module-level runtime registry. Type augmentation is erased at runtime — the stash is the
 * live source for overlays.open to resolve the Overlay spec. Call defineOverlays once; the
 * last call wins.
 */
let activeOverlays: OverlayMap = {}

// ── defineOverlays ────────────────────────────────────────────────────────────

/**
 * Define a typed overlay map. Const-generic identity passthrough — preserves the exact literal
 * keys so `overlays.open('nonexistent', …)` is a tsc error after augmenting BasaltRegister.
 *
 * @example
 * export const OVERLAYS = defineOverlays({
 *   'user:edit': { title: 'Edit user', render: (p: { id: string }) => <UserEditForm id={p.id} /> },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { overlays: typeof OVERLAYS }
 * }
 */
export function defineOverlays<const T extends OverlayMap>(spec: T): T {
  activeOverlays = spec
  return spec
}

// ── defineOverlay (single-overlay helper) ─────────────────────────────────────

/**
 * Convenience helper to type a single Overlay object with full inference.
 * Useful when splitting overlays across files before merging into defineOverlays.
 *
 * WARNING: defineOverlay only TYPES an overlay — it does NOT register it into the runtime stash.
 * Only defineOverlays(map) registers overlays. Calling defineOverlay alone means the overlay will
 * never be reachable via overlays.open().
 *
 * @example
 * const deleteOverlay = defineOverlay<{ name: string }>({
 *   title: 'Confirm delete',
 *   render: ({ name }) => <Text>Delete "{name}"?</Text>,
 * })
 * // Then include it in a defineOverlays({ 'confirm:delete': deleteOverlay }) call to register it.
 */
export function defineOverlay<P = Record<string, unknown>>(overlay: Overlay<P>): Overlay<P> {
  return overlay
}

// ── overlays controller ───────────────────────────────────────────────────────

/**
 * Extract the props type for a registered overlay key.
 * When Overlays is un-augmented ({}) this resolves to `never` so open() is uncallable.
 * _K is the mapped key variable; V is the inferred props type — kept distinct to avoid shadowing.
 */
type OverlayProps<K extends OverlayKey> = Overlays extends { [_K in K]: Overlay<infer V> }
  ? V
  : never

/**
 * Imperative overlay controller. Resolves the overlay spec from the runtime stash and delegates
 * to @mantine/modals. Use this for ephemeral, non-route-addressable overlays (confirm dialogs,
 * quick-edit panels). For shareable/back-button/refreshable overlays use route masks via
 * ./router-tanstack.
 *
 * @example
 * overlays.open('confirm:delete', { name: 'photo.jpg' })
 * overlays.close()
 */
export const overlays = {
  /**
   * Open a registered overlay by key. Resolves the Overlay spec from the runtime stash and calls
   * modals.open() with the rendered body. The props type is inferred from the registered overlay.
   *
   * `overlays.open('nonexistent', …)` is a tsc error when BasaltRegister.overlays is augmented.
   * Un-augmented: OverlayKey = never → effectively uncallable.
   *
   * @example
   * overlays.open('user:edit', { id: '42' })
   */
  open<K extends OverlayKey>(key: K, props: OverlayProps<K>): void {
    const spec = activeOverlays[key as string]
    if (spec === undefined) {
      if (process.env['NODE_ENV'] !== 'production')
        console.warn(`[basalt] overlays.open: no overlay registered for "${String(key)}"`)
      return
    }
    modals.open({
      title: spec.title,
      children: spec.render(props),
    })
  },

  /**
   * Close all open overlays (delegates to modals.closeAll()).
   *
   * @example
   * overlays.close()
   */
  close(): void {
    modals.closeAll()
  },
}
