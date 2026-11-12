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
      'b',
      'a',
    ])
    expect(set.entries.find((entry) => entry.id === 'a')?.parsed?.key).toBe('j')
  })

  test('the built-ins run what the mounted shell binds, and nothing once unbound', () => {
    const set = defineCommands({})
    const calls: string[] = []
    const unbind = set.bind({
      toggleRail: () => calls.push('rail'),
      togglePalette: () => calls.push('palette'),
    })
    for (const entry of set.entries) void entry.run()
    expect(calls).toEqual(['rail', 'palette'])
    unbind()
    for (const entry of set.entries) void entry.run()
    expect(calls).toEqual(['rail', 'palette'])
  })
})
