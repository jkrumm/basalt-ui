import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chordId, chordKeys, matchesChord, mayFireOn, parseChord } from './chord'

const key = (init: Partial<KeyboardEvent> & { key: string }) => ({
  code: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
})

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

  test('chordKeys keeps Mod for Kbd to draw', () => {
    expect(chordKeys(parseChord('Mod+Shift+p'))).toEqual(['Mod', 'Shift', 'P'])
    expect(chordKeys(parseChord('Mod+Enter'))).toEqual(['Mod', 'Enter'])
  })
})

describe('matchesChord', () => {
  const modK = parseChord('Mod+K')

  test('Mod is Meta on Apple and Ctrl elsewhere', () => {
    expect(matchesChord(key({ key: 'k', metaKey: true }), modK, true)).toBe(true)
    expect(matchesChord(key({ key: 'k', ctrlKey: true }), modK, true)).toBe(false)
    expect(matchesChord(key({ key: 'k', ctrlKey: true }), modK, false)).toBe(true)
    expect(matchesChord(key({ key: 'k', metaKey: true }), modK, false)).toBe(false)
  })

  test('an extra modifier is a different chord', () => {
    expect(matchesChord(key({ key: 'K', metaKey: true, shiftKey: true }), modK, true)).toBe(false)
    expect(matchesChord(key({ key: 'k', metaKey: true, altKey: true }), modK, true)).toBe(false)
  })

  test('the physical digit key matches when shift or the layout changed the character', () => {
    const mod1 = parseChord('Mod+1')
    expect(matchesChord(key({ key: '&', code: 'Digit1', metaKey: true }), mod1, true)).toBe(true)
    expect(matchesChord(key({ key: '2', code: 'Digit2', metaKey: true }), mod1, true)).toBe(false)
  })
})

describe('mayFireOn', () => {
  const host = document.createElement('div')
  beforeAll(() => {
    host.innerHTML =
      '<button id="b">b</button><input id="i"><a id="a" href="#">a</a><div id="d" tabindex="0">d</div><div role="menuitem" id="m">m</div>'
    document.body.append(host)
  })
  afterAll(() => host.remove())
  const el = (id: string): Element => host.querySelector(`#${id}`) as Element

  test('a command chord fires everywhere', () => {
    for (const id of ['b', 'i', 'a', 'd']) expect(mayFireOn(parseChord('Mod+K'), el(id))).toBe(true)
  })

  test('a bare key never fires in a text field', () => {
    expect(mayFireOn(parseChord('j'), el('i'))).toBe(false)
    expect(mayFireOn(parseChord('j'), el('d'))).toBe(true)
  })

  test('a bare Enter or Space never fires on a control that activates on it', () => {
    for (const chord of ['Enter', 'Space']) {
      for (const id of ['b', 'i', 'a', 'm'])
        expect(mayFireOn(parseChord(chord), el(id))).toBe(false)
      expect(mayFireOn(parseChord(chord), el('d'))).toBe(true)
    }
  })
})
