// J.4 apps/playground/src/asyncstate-fourth-variant.type-guard.ts
import { assertNever } from 'basalt-ui'
import type { AsyncState } from 'basalt-ui'
type Extended = AsyncState<number> | { status: 'refreshing'; data: number }
export function render(s: Extended): string {
  switch (s.status) {
    case 'idle':
      return 'idle'
    case 'loading':
      return 'loading'
    case 'success':
      return String(s.data)
    case 'error':
      return String(s.error)
    default:
      // @ts-expect-error 'refreshing' is unhandled — `s` is not `never`, assertNever rejects it
      return assertNever(s)
  }
}
// PROVES: adding a variant without a case is a tsc error via assertNever — gates the Tier-1 lint deletion.
