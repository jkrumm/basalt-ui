import type { KbdProps } from './kbd'

/**
 * Hand-authored guard for `kbd` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject; `closed`
 * is dropped on eject. The module has no cva axes, so the guard pins the one prop a caller binds:
 * the key, a string.
 */

// basalt:guard requires
type Called = { children: string }

export const requires = (c: Called): Pick<KbdProps, 'children'> => c

// basalt:guard closed
// @ts-expect-error a key cap is one string, not nodes
export const nodeChild: Pick<KbdProps, 'children'> = { children: 1 }
