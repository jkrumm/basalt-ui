import { describe, expect, test } from 'bun:test'
import {
  chordHotkey,
  chordId,
  chordKeys,
  parseChord,
  parseChordSequence,
  sequenceId,
  yieldsToControls,
} from './chord'

describe('parseChord', () => {
  test('two spellings of one chord share a canonical id', () => {
    expect(chordId(parseChord('Shift+Mod+P'))).toBe(chordId(parseChord('mod+shift+p')))
    expect(chordId(parseChord('Esc'))).toBe(chordId(parseChord('Escape')))
  })

  test('rejects an empty part, two keys and no key', () => {
    expect(() => parseChord('Mod++K')).toThrow('empty part')
    expect(() => parseChord('Mod+K+J')).toThrow('two keys')
    expect(() => parseChord('Mod+Shift')).toThrow('no key')
  })

  test('a sequence is chords split on a space; spaces around a plus stay inside a chord', () => {
    expect(parseChordSequence('g n').map(chordId)).toEqual(['g', 'n'])
    expect(parseChordSequence('Mod + K  Mod+S').map(chordId)).toEqual(['mod+k', 'mod+s'])
    expect(parseChordSequence('Mod+K').map(chordId)).toEqual(['mod+k'])
    expect(sequenceId(parseChordSequence('G  N'))).toBe('g n')
    expect(() => parseChordSequence('')).toThrow('empty part')
  })

  test('chordKeys keeps Mod for Kbd to draw', () => {
    expect(chordKeys(parseChord('Mod+Shift+p'))).toEqual(['Mod', 'Shift', 'P'])
    expect(chordKeys(parseChord('Mod+Enter'))).toEqual(['Mod', 'Enter'])
  })
})

describe('chordHotkey', () => {
  test('spells a chord the way the hotkey library takes it', () => {
    expect(chordHotkey(parseChord('shift+mod+p'))).toBe('Mod+Shift+P')
    expect(chordHotkey(parseChord('Esc'))).toBe('Escape')
    expect(chordHotkey(parseChord('space'))).toBe('Space')
    expect(chordHotkey(parseChord('ctrl+arrowup'))).toBe('Control+ArrowUp')
    expect(chordHotkey(parseChord('f5'))).toBe('F5')
    expect(chordHotkey(parseChord('?'))).toBe('?')
    expect(chordHotkey(parseChord('Mod+.'))).toBe('Mod+.')
  })
})

describe('yieldsToControls', () => {
  test('a bare key or a Shift chord leaves a focused control its keys', () => {
    expect(yieldsToControls(parseChord('j'))).toBe(true)
    expect(yieldsToControls(parseChord('Enter'))).toBe(true)
    expect(yieldsToControls(parseChord('Shift+J'))).toBe(true)
  })

  test('a chord with Mod, Ctrl, Meta or Alt fires everywhere', () => {
    for (const chord of ['Mod+K', 'Ctrl+K', 'Meta+K', 'Alt+K']) {
      expect(yieldsToControls(parseChord(chord))).toBe(false)
    }
  })
})
