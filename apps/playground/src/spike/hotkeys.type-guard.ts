// Spike (W1 ledger): basalt's locally mirrored peer types (commands/projectors.ts:33,
// commands/useCommandHotkeys.ts:35-50) checked against the REAL 0.10.0 and 0.13.0 declarations.
import type {
  getHotkeyManager as getV10,
  Hotkey as HotkeyV10,
  UseHotkeyDefinition as DefV10,
} from '@tanstack/react-hotkeys'
import type {
  getHotkeyManager as getV13,
  Hotkey as HotkeyV13,
  UseHotkeyDefinition as DefV13,
} from '@tanstack/react-hotkeys-v13'

// ── mirrored verbatim from basalt-ui 1.41 ──
type HotkeyBinding = { hotkey: string; callback: (event: KeyboardEvent, context?: unknown) => void }
type HotkeyHandle = { unregister: () => void; callback: (event: KeyboardEvent) => void }
type HotkeyManagerType = {
  register: (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options?: { preventDefault?: boolean },
  ) => HotkeyHandle
}
type PeerModule = { getHotkeyManager: () => HotkeyManagerType }

// 1. `toHotkeyBindings()` output must be passable to `useHotkeys()` (the documented opt-in path).
//    FAILS on BOTH versions: `hotkey: string` is not a `RegisterableHotkey`. The JSDoc claim at
//    projectors.ts:36-38 is false today; nothing caught it because nothing compiles the pair.
// @ts-expect-error — string ⊄ RegisterableHotkey (0.10.0)
export const bindingV10 = (b: HotkeyBinding): DefV10 => b
// @ts-expect-error — string ⊄ RegisterableHotkey (0.13.0)
export const bindingV13 = (b: HotkeyBinding): DefV13 => b

// 2. `useCommandHotkeys` casts the dynamic import to PeerModule — the real module must satisfy it.
//    FAILS on BOTH versions for the same reason; `as unknown as PeerModule` (useCommandHotkeys.ts:74) hides it.
// @ts-expect-error — register(hotkey: RegisterableHotkey) rejects string (0.10.0)
export const peerV10 = (m: { getHotkeyManager: typeof getV10 }): PeerModule => m
// @ts-expect-error — register(hotkey: RegisterableHotkey) rejects string (0.13.0)
export const peerV13 = (m: { getHotkeyManager: typeof getV13 }): PeerModule => m

// 3. 0.10 → 0.13 is a WIDENING for the string form: every 0.10 `Hotkey` is a 0.13 `Hotkey`.
export const widen = (h: HotkeyV10): HotkeyV13 => h

// 4. Typing `CommandDef.shortcut` as the peer's `Hotkey` makes a wrong shortcut a compile error.
export const argoShortcuts = [
  'Mod+B',
  'Mod+/',
  'Mod+K',
  'Mod+Shift+P',
] as const satisfies readonly HotkeyV13[]
// @ts-expect-error — modifier typo
export const typo: HotkeyV13 = 'Cmd+B'
// @ts-expect-error — modifier order outside the canonical form
export const order: HotkeyV13 = 'Shift+Mod+P'
