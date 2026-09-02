// The compile-time regression guard for `emit` / `NotificationKind` / `notifyUndo`
// (`basalt-ui/notifications`) — the third `defineX` slot alongside `commands.type-guard.ts` and
// `overlays.type-guard.ts`. The `notifications` slot is already augmented globally by
// `demo/NotificationsDemoPage.tsx` (`DEMO_NOTIFS`, kinds `'demo:upload-success'` /
// `'demo:save-error'` / `'demo:quota-warn'`); re-declaring it here would conflict, so this reads
// the real registration.
import { emit, notifyUndo } from 'basalt-ui/notifications'
import type { NotificationKind } from 'basalt-ui/notifications'

// ── 1. the registered kind ───────────────────────────────────────────────────────────────────────

export function emitUploadSuccess(): void {
  emit('demo:upload-success', { name: 'photo.jpg' })
}

// @ts-expect-error 'nope:nope' is not a registered notification kind
emit('nope:nope', {})

export const kind: NotificationKind = 'demo:save-error'
// @ts-expect-error 'nope:nope' is not a NotificationKind
export const badKind: NotificationKind = 'nope:nope'

// ── 1b. the payload NARROWS per kind ─────────────────────────────────────────────────────────────
// `DEMO_NOTIFS` (NotificationsDemoPage.tsx) annotates each kind's `toMessage`/`action.run` param, so
// `emit`'s payload argument is now inferred per kind — the same `infer` mechanism `OverlayProps`
// uses for `render` (`define-overlays.ts`), not a separate declared field.

emit('demo:upload-success', { name: 'photo.jpg' })

// @ts-expect-error 'demo:upload-success' declared { name: string }, not a bare string
emit('demo:upload-success', 'nope')

// @ts-expect-error 'demo:save-error' declared { id: number } via action.run, not { totallyWrongShape }
emit('demo:save-error', { totallyWrongShape: true })

// ── 2. notifyUndo — onUndo required ──────────────────────────────────────────────────────────────

notifyUndo({ message: 'Item deleted', onUndo: () => {} })

// @ts-expect-error `onUndo` is required on NotifyUndoOptions
notifyUndo({ message: 'Item deleted' })

// PROVES: an unregistered emit() kind is a tsc error, same slot mechanism as commands/overlays;
// a registered kind's payload now narrows to its declared shape; notifyUndo rejects a missing
// onUndo.
