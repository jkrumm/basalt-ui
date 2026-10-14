/**
 * Compile-time proof that `Command.shortcut` is the `@tanstack/react-hotkeys` `Hotkey` (V2-SPEC § 8,
 * "Hotkeys: adopt, and stop mirroring"): a wrong modifier is a `tsc` error, not a silent dead key.
 * One `@ts-expect-error` per bad line, proven by `tsc --noEmit`.
 */
import { describe, expect, test } from 'bun:test'
import type { Command } from '../commands/define-commands'

const run = (): void => {}

describe('Command.shortcut type guard', () => {
  test('canonical hotkeys are accepted', () => {
    const shortcuts = [
      { label: 'a', run, shortcut: 'Mod+B' },
      { label: 'b', run, shortcut: 'Mod+/' },
      { label: 'c', run, shortcut: 'Mod+Shift+P' },
    ] satisfies Command[]
    expect(shortcuts).toHaveLength(3)
  })

  test('typos and non-canonical order do not compile', () => {
    // @ts-expect-error `Cmd` is not a modifier — `Mod` is the platform-neutral one.
    const typo: Command = { label: 'x', run, shortcut: 'Cmd+B' }
    // @ts-expect-error modifiers must come in canonical order (`Mod+Shift+P`).
    const order: Command = { label: 'y', run, shortcut: 'Shift+Mod+P' }
    expect([typo, order]).toHaveLength(2)
  })
})
