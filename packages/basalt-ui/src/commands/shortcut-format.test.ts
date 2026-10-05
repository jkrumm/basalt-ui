import { describe, expect, test } from 'bun:test'
import { formatShortcutDisplay, parseShortcut } from './shortcut-format'

describe('formatShortcutDisplay', () => {
  test.each([
    ['Mod+S', true, '⌘S'],
    ['Shift+Mod+P', true, '⇧⌘P'],
    ['mod+backspace', true, '⌘⌫'],
    ['mod+delete', true, '⌘⌦'],
    ['arrowleft', true, '←'],
    ['arrowright', true, '→'],
    ['arrowup', true, '↑'],
    ['arrowdown', true, '↓'],
    ['escape', true, '⎋'],
    ['enter', true, '↩'],
    ['tab', true, '⇥'],
    ['space', true, '␣'],
    ['alt+ctrl+f5', true, '⌥⌃F5'],
    ['Mod+S', false, 'Ctrl+S'],
    ['mod+backspace', false, 'Ctrl+Backspace'],
    ['arrowleft', false, 'Left'],
    ['escape', false, 'Esc'],
    ['shift+alt+enter', false, 'Shift+Alt+Enter'],
    ['f5', false, 'F5'],
  ] as const)('%s (mac: %p) → %s', (shortcut, isMac, expected) => {
    expect(formatShortcutDisplay(shortcut, isMac)).toBe(expected)
  })
})

describe('parseShortcut', () => {
  test('one Kbd token per key, glyphs on mac', () => {
    expect(parseShortcut('mod+backspace', true)).toEqual(['⌘', '⌫'])
  })

  test('one Kbd token per key, Title-case words elsewhere', () => {
    expect(parseShortcut('mod+backspace', false)).toEqual(['Ctrl', 'Backspace'])
  })

  test('ctrl on mac is the control glyph, not a caret', () => {
    expect(parseShortcut('ctrl+k', true)).toEqual(['⌃', 'K'])
  })
})
