// J.2 apps/playground/src/register-augments-all.type-guard.ts
// A REAL augmentation resolved through the package name: the `notifications` slot, the one slot
// basalt reads today (`notify`'s kinds). The series slot is gone: a chart `key` is the data's id.
import type { notify } from 'basalt-ui'

declare module 'basalt-ui' {
  interface BasaltRegister {
    notifications: { deploy: true }
  }
}

type Kind = Parameters<typeof notify>[0]
export const registered: Kind = 'deploy'
export const shipped: Kind = 'error'
// @ts-expect-error a kind nobody registered is not a notify kind: the slot widens exactly
export const typo: Kind = 'deplyo'
// PROVES: an augmented slot adds its exact literal keys and nothing else.
