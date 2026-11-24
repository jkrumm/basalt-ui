import { describe, expect, test } from 'bun:test'
import { defineCommands } from './define-commands'

const run = (): void => {}

describe('defineCommands', () => {
  test('a duplicate chord throws at define time and names both commands', () => {
    expect(() =>
      defineCommands({
        'file.save': { label: 'Save', chord: 'Mod+S', run },
        'file.store': { label: 'Store', chord: 'mod+s', run },
      }),
    ).toThrow('"file.save" and "file.store" share the chord mod+s')
  })

  test('the same chord in two areas is two commands; the same area is a duplicate', () => {
    expect(() =>
      defineCommands({
        'a.next': { label: 'Next', chord: 'j', area: 'runs', run },
        'b.next': { label: 'Next', chord: 'j', area: 'jobs', run },
      }),
    ).not.toThrow()
    expect(() =>
      defineCommands({
        'a.next': { label: 'Next', chord: 'j', area: 'runs', run },
        'a.down': { label: 'Down', chord: 'J', area: 'runs', run },
      }),
    ).toThrow('in area "runs"')
  })

  test('the chords the shell owns are reserved', () => {
    expect(() => defineCommands({ x: { label: 'X', chord: 'Mod+K', run } })).toThrow(
      'shell.palette',
    )
    expect(() => defineCommands({ x: { label: 'X', chord: 'Mod+B', run } })).toThrow(
      'shell.toggle-rail',
    )
    expect(() => defineCommands({ x: { label: 'X', chord: 'Mod+3', run } })).toThrow(
      'nav item at position 3',
    )
    expect(() => defineCommands({ x: { label: 'X', chord: 'Mod+Shift+3', run } })).not.toThrow()
  })

  test('the set carries the built-ins first, then the declared commands in order', () => {
    const set = defineCommands({
      b: { label: 'B', run },
      a: { label: 'A', chord: 'Mod+J', run },
    })
    expect(set.entries.map((entry) => entry.id)).toEqual([
      'shell.toggle-rail',
      'shell.palette',
      'shell.shortcuts',
      'record.previous',
      'record.next',
      'b',
      'a',
    ])
    expect(set.entries.find((entry) => entry.id === 'a')?.steps[0]?.key).toBe('j')
    expect(set.entries.find((entry) => entry.id === 'b')?.steps).toEqual([])
  })

  test('the built-ins run what the mounted shell binds, and nothing once unbound', () => {
    const set = defineCommands({})
    const calls: string[] = []
    const unbind = set.bind({
      toggleRail: () => calls.push('rail'),
      togglePalette: () => calls.push('palette'),
      toggleShortcuts: () => calls.push('shortcuts'),
    })
    for (const entry of set.entries) void entry.run()
    expect(calls).toEqual(['rail', 'palette', 'shortcuts'])
    unbind()
    for (const entry of set.entries) void entry.run()
    expect(calls).toEqual(['rail', 'palette', 'shortcuts'])
  })

  test('two hosts bind their own built-ins; the shortcut list is inert with no host', () => {
    const set = defineCommands({})
    const shortcuts = set.entries.find((entry) => entry.id === 'shell.shortcuts')
    expect(shortcuts?.enabled?.()).toBe(false)
    const unbindList = set.bind({ toggleShortcuts: () => {} })
    const unbindPalette = set.bind({ toggleRail: () => {}, togglePalette: () => {} })
    expect(shortcuts?.enabled?.()).toBe(true)
    unbindPalette()
    expect(shortcuts?.enabled?.()).toBe(true)
    unbindList()
    expect(shortcuts?.enabled?.()).toBe(false)
  })

  test('a sequence is declared as chords separated by a space', () => {
    const set = defineCommands({ go: { label: 'Go', chord: 'g n', run } })
    expect(set.entries.find((entry) => entry.id === 'go')?.steps.map((step) => step.key)).toEqual([
      'g',
      'n',
    ])
  })

  test('a chord that begins another, or is a sequence it duplicates, throws in one scope', () => {
    expect(() =>
      defineCommands({
        'a.go': { label: 'Go', chord: 'g n', run },
        'a.goto': { label: 'Goto', chord: 'G N', run },
      }),
    ).toThrow('share the chord G N')
    expect(() =>
      defineCommands({
        'a.g': { label: 'G', chord: 'g', run },
        'a.go': { label: 'Go', chord: 'g n', run },
      }),
    ).toThrow('overlap: "g" and "g n"')
    expect(() =>
      defineCommands({
        'a.g': { label: 'G', chord: 'g', area: 'runs', run },
        'a.go': { label: 'Go', chord: 'g n', run },
      }),
    ).not.toThrow()
    expect(() =>
      defineCommands({
        'a.go': { label: 'Go', chord: 'g n', run },
        'a.gf': { label: 'Files', chord: 'g f', run },
      }),
    ).not.toThrow()
  })

  test('a sequence may not begin with a chord the shell reserves', () => {
    expect(() => defineCommands({ x: { label: 'X', chord: 'Mod+K s', run } })).toThrow(
      'shell.palette',
    )
    expect(() => defineCommands({ x: { label: 'X', chord: '?', run } })).toThrow('shell.shortcuts')
  })
})
