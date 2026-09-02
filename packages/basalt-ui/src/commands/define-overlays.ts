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
import { useEffect } from 'react'
import { missingLayer } from '../common/errors'
import type { Slot } from '../register'
import { isDev } from '../utils/is-dev'

// ── Lazy @mantine/modals resolution ───────────────────────────────────────────
// @mantine/modals is an OPTIONAL peer — never imported at module evaluation time, so importing
// this module (and the ./commands barrel that re-exports it) does not require the peer. Resolves
// to undefined when the peer is absent — overlays.open/close then degrade to a no-op.

type ModalsModule = typeof import('@mantine/modals')
type ModalsSingleton = ModalsModule['modals']

let modalsPromise: Promise<ModalsSingleton | undefined> | undefined

function loadModals(): Promise<ModalsSingleton | undefined> {
  modalsPromise ??= import('@mantine/modals').then((m) => m.modals).catch(() => undefined)
  return modalsPromise
}

// ── Modals-layer availability ─────────────────────────────────────────────────

/**
 * How many `ModalsProvider`s are live right now — a COUNTER, not a flag, for the same reason
 * `notifications/mount-guard.ts` counts: two overlapping mounts are normal (a route swap mounts the
 * next `BasaltOverlays` before unmounting the previous one), and a last-write-wins boolean reports
 * the teardown of the OLD one as "no layer" while the new one is serving.
 *
 * It is the availability test `overlays.confirm` runs, because `@mantine/modals`' imperative API is
 * a window event bus: with nothing subscribed the dialog never appears and the promise never
 * settles. The previous version read `BasaltOverlays`' own `modals` flag instead, which refused the
 * call whenever a mounted shell passed `modals={false}` — even though the consumer had mounted their
 * own `<ModalsProvider>`, which is the very remedy the error message names.
 */
let mountedModalsProviders = 0

/**
 * Declare that a `@mantine/modals` `<ModalsProvider>` is mounted and serving, and get back the
 * function that retracts it. `BasaltOverlays` calls this for its own provider; a consumer mounting
 * the provider THEMSELVES (with `<BasaltOverlays modals={false} />`, or with no `BasaltOverlays` at
 * all) calls it too, or `overlays.confirm` cannot tell their provider from no provider and rejects.
 *
 * There is no way to detect the provider from outside React — its context is only readable through
 * `useModals()`, and `confirm` is an imperative call with no component to read it from. So the
 * registration is explicit.
 *
 * @example
 * useEffect(() => registerModalsProvider(), [])
 * // …beside your own <ModalsProvider> mount.
 */
export function registerModalsProvider(): () => void {
  mountedModalsProviders++
  let released = false
  return () => {
    // Idempotent: an effect cleanup React runs twice (StrictMode remount) must not drive the count
    // below the number of providers actually on screen.
    if (released) return
    released = true
    mountedModalsProviders--
  }
}

/**
 * Internal — `BasaltOverlays` registers its OWN lazy `ModalsProvider` here, and only when it
 * actually renders one. Deliberately NOT on the `./commands` barrel (internal wiring only, same as
 * `notifications/mount-guard`); the consumer-facing half is {@link registerModalsProvider}.
 */
export function useModalsLayer(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    return registerModalsProvider()
  }, [enabled])
}

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

// ── confirm ───────────────────────────────────────────────────────────────────

/** Options for {@link overlays.confirm} — a two-button dialog that resolves to the answer. */
export type ConfirmOptions = {
  /** Dialog title — the question itself ("Delete photo.jpg?"), not a category. */
  title: ReactNode
  /** Optional body under the title. A plain string is fine; a ReactNode renders as-is. */
  body?: ReactNode
  /** Confirm button label. Default: 'Confirm'. */
  confirmLabel?: string
  /** Cancel button label. Default: 'Cancel'. */
  cancelLabel?: string
  /** Paint the confirm button in the destructive tone (the theme's derived `red` family). */
  danger?: boolean
  /** Runs once, before the promise resolves `true`. */
  onConfirm: () => void
  /** Runs once on cancel, escape, click-outside or the close button — every non-confirm exit. */
  onCancel?: () => void
}

/** Options for {@link overlays.confirmDelete} — the delete idiom over {@link ConfirmOptions}. */
export type ConfirmDeleteOptions = {
  /**
   * The singular noun for what is being deleted — `'item'`, `'photo'`, `'API key'`. Pluralised by
   * appending `s` when `count` is not 1; a noun that does not pluralise that way calls
   * {@link overlays.confirm} directly with its own title.
   */
  subject: string
  /** How many. Default: 1. */
  count?: number
  /** Runs once, before the promise resolves `true`. */
  onConfirm: () => void
}

/**
 * Open a confirm dialog and resolve to the user's answer — `true` on confirm, `false` on every
 * other exit (cancel, escape, click-outside, the close button). `onConfirm`/`onCancel` fire exactly
 * once each at most, before the promise settles.
 *
 * Rejects with a named `[basalt]` error when the modals layer cannot serve the dialog — the
 * `@mantine/modals` peer is absent, or no `ModalsProvider` is registered as live (see
 * {@link registerModalsProvider}). Both would otherwise leave the promise pending forever: the
 * imperative API is a window event bus with nothing subscribed.
 *
 * @example
 * if (await overlays.confirm({ title: 'Discard draft?', onConfirm: () => reset() })) navigate('/')
 *
 * @example
 * await overlays.confirm({
 *   title: 'Revoke access?',
 *   body: 'The key stops working immediately.',
 *   confirmLabel: 'Revoke',
 *   danger: true,
 *   onConfirm: () => revoke(),
 * })
 */
async function confirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    body,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel,
  } = options

  const modals = await loadModals()
  if (modals === undefined) {
    throw new Error(
      missingLayer(
        'overlays.confirm',
        '@mantine/modals',
        'install the @mantine/modals peer and mount <BasaltOverlays>',
      ),
    )
  }
  if (mountedModalsProviders === 0) {
    throw new Error(
      missingLayer(
        'overlays.confirm',
        'a mounted <ModalsProvider>',
        'drop `modals={false}` from <BasaltOverlays>, or mount <ModalsProvider> yourself and call ' +
          'registerModalsProvider() from an effect for as long as it is up',
      ),
    )
  }

  return new Promise<boolean>((resolve) => {
    // Mantine fires onCancel AND onClose on the cancel button, and onClose alone on escape /
    // click-outside / the X — so the answer is settled once here and every later edge is a no-op.
    let settled = false
    const settle = (confirmed: boolean): void => {
      if (settled) return
      settled = true
      if (confirmed) onConfirm()
      else onCancel?.()
      resolve(confirmed)
    }

    modals.openConfirmModal({
      title,
      ...(body !== undefined && { children: body }),
      labels: { confirm: confirmLabel, cancel: cancelLabel },
      // The destructive tone is the theme's `red` family (derived from the palette, bound to the
      // --vx-* status tokens by cssVariablesResolver) — never a raw color.
      ...(danger && { confirmProps: { color: 'red' } }),
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    })
  })
}

/**
 * The delete confirmation every app writes — `confirm` with the destructive tone, the `Delete`
 * label and a counted title already filled in.
 *
 * @example
 * overlays.confirmDelete({ subject: 'item', count: 3, onConfirm: () => removeSelected() })
 * // → "Delete 3 items?"
 */
function confirmDelete(options: ConfirmDeleteOptions): Promise<boolean> {
  const { subject, count = 1, onConfirm } = options
  const what = count === 1 ? subject : `${count} ${subject}s`
  return confirm({
    title: `Delete ${what}?`,
    body: 'This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm,
  })
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
 * `open` needs a REGISTERED overlay; `confirm`/`confirmDelete` need none — they are the two-button
 * dialog every app was hand-writing as a registry entry.
 *
 * @example
 * overlays.open('confirm:delete', { name: 'photo.jpg' })
 * await overlays.confirm({ title: 'Discard draft?', danger: true, onConfirm: () => reset() })
 * overlays.confirmDelete({ subject: 'item', count: 3, onConfirm: () => removeSelected() })
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
      if (isDev())
        console.warn(`[basalt] overlays.open: no overlay registered for "${String(key)}"`)
      return
    }
    void loadModals().then((modals) =>
      modals?.open({
        title: spec.title,
        children: spec.render(props),
      }),
    )
  },

  /**
   * Open a confirm dialog and resolve to the answer — see {@link confirm}.
   *
   * @example
   * const ok = await overlays.confirm({ title: 'Discard draft?', onConfirm: () => reset() })
   */
  confirm,

  /**
   * The one-line delete idiom over {@link confirm} — see {@link confirmDelete}.
   *
   * @example
   * overlays.confirmDelete({ subject: 'item', count: 3, onConfirm: () => removeSelected() })
   */
  confirmDelete,

  /**
   * Close all open overlays (delegates to modals.closeAll()).
   *
   * @example
   * overlays.close()
   */
  close(): void {
    void loadModals().then((modals) => modals?.closeAll())
  },
}
