// The compile-time regression guard for `overlays` (`basalt-ui/commands`) — `OverlayMap`'s `any`
// (`define-overlays.ts:131`, `oxlint-disable`'d as load-bearing contravariance) is the one escape
// hatch left in that module; this file proves it still narrows at the call site rather than being
// theatre. The `overlays` slot is already augmented globally by
// `demo/CommandsDemoPage.tsx` (`DEMO_OVERLAYS`, key `'demo:info'`, payload `{ message: string }`) —
// re-declaring the same slot here with a different shape would conflict, so this fixture reads the
// real registration the way a consumer file elsewhere in the app would, with no import of that file
// needed (the `declare module` augmentation is ambient across the whole program).
import { overlays } from 'basalt-ui/commands'
import type { OverlayKey } from 'basalt-ui/commands'

// ── 1. the registered key + its exact payload shape ─────────────────────────────────────────────

export function openDemoInfo(): void {
  overlays.open('demo:info', { message: 'hi' })
}

// @ts-expect-error 'nope' is not a registered overlay key
overlays.open('nope', { message: 'hi' })

// @ts-expect-error `demo:info`'s payload is `{ message: string }`, not `{ wrong: number }`
overlays.open('demo:info', { wrong: 1 })

export const key: OverlayKey = 'demo:info'
// @ts-expect-error 'nope' is not an OverlayKey
export const badKey: OverlayKey = 'nope'

// ── 2. overlays.confirm — Promise<boolean>, onConfirm required ──────────────────────────────────

export async function confirmDiscard(): Promise<boolean> {
  // No cast: the return type must already be `Promise<boolean>`.
  const ok: boolean = await overlays.confirm({ title: 'Discard draft?', onConfirm: () => {} })
  return ok
}

// @ts-expect-error `onConfirm` is required on ConfirmOptions
overlays.confirm({ title: 'Discard draft?' })

// PROVES: an unregistered overlays.open() key AND a mismatched payload are both tsc errors — not
// just the key, which is the escape hatch OverlayMap's `any` actually guards against; confirm()
// resolves to boolean with no cast and rejects a missing onConfirm.
