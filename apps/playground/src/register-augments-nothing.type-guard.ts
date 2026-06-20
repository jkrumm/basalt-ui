// J.1 apps/playground/src/register-augments-nothing.type-guard.ts
import type { Slot } from 'basalt-ui'
type Empty = Slot<'nonexistent', Record<string, unknown>>
export function f1(): keyof Empty {
  // @ts-expect-error keyof {} is `never` — a string key is NOT assignable, proving {} (keyof→never),
  // NOT Record<string,never> (keyof→string). Holds regardless of the global `series` augment (H.3).
  return 'anyKey'
}
// PROVES: an un-augmented slot defaults to never-keyed {}. Locks the {} vs Record<string,never> footgun.
