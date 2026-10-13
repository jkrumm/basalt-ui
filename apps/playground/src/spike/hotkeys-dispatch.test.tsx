// Spike (W1 ledger): the keyboard leg of the Hotkeys row. basalt's `useCommandHotkeys` path
// (`getHotkeyManager().register(shortcut, cb, { preventDefault: false })`, `when()` gated at press
// time, `preventDefault()` only when the command runs, `unregister()` on unmount) driven by real
// keydown events on `document`, against 0.10.0 (incumbent) and 0.13.0 (candidate).
import {
  detectPlatform as platformV10,
  getHotkeyManager as managerV10,
} from '@tanstack/react-hotkeys'
import {
  detectPlatform as platformV13,
  getHotkeyManager as managerV13,
} from '@tanstack/react-hotkeys-v13'
import { expect, test } from 'bun:test'

type Register = (
  hotkey: 'Mod+B',
  callback: (event: KeyboardEvent) => void,
  options: { preventDefault: boolean },
) => { unregister: () => void }

const press = (mac: boolean): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: 'b',
    code: 'KeyB',
    bubbles: true,
    cancelable: true,
    ...(mac ? { metaKey: true } : { ctrlKey: true }),
  })
  document.dispatchEvent(event)
  return event
}

for (const [name, register, platform] of [
  ['0.10.0', (...a: Parameters<Register>) => managerV10().register(...a), platformV10],
  ['0.13.0', (...a: Parameters<Register>) => managerV13().register(...a), platformV13],
] as const) {
  test(`${name}: Mod+B runs the command, honours when(), unregisters`, () => {
    const mac = platform() === 'mac'
    let enabled = true
    let runs = 0
    const handle = register(
      'Mod+B',
      (event) => {
        if (!enabled) return
        event.preventDefault()
        runs += 1
      },
      { preventDefault: false },
    )
    expect(press(mac).defaultPrevented).toBe(true)
    expect(runs).toBe(1)
    enabled = false
    expect(press(mac).defaultPrevented).toBe(false)
    expect(runs).toBe(1)
    enabled = true
    handle.unregister()
    press(mac)
    expect(runs).toBe(1)
  })
}
