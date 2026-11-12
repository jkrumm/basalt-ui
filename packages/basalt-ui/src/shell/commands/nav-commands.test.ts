import { describe, expect, test } from 'bun:test'
import { navCommands } from './nav-commands'
import type { AnyNavConfig } from '../../router/nav/types'

const item = (id: string, extra: object = {}) => ({
  id,
  label: id.toUpperCase(),
  link: { to: `/${id}` },
  ...extra,
})

const NAV: AnyNavConfig = {
  sections: [
    {
      id: 's1',
      label: 'One',
      items: [
        item('a', { children: [{ id: 'a1', label: 'A1', link: { to: '/a/1' } }] }),
        item('b'),
      ],
    },
    { id: 's2', label: 'Two', items: [item('c')] },
  ],
  pinned: [item('settings')],
}

describe('navCommands', () => {
  test('Mod+N goes to the Nth top-level item in defineNav order, children after their parent', () => {
    const rows = navCommands(NAV).map((cmd) => [cmd.id, cmd.chord])
    expect(rows).toEqual([
      ['nav.a', 'Mod+1'],
      ['nav.a1', undefined],
      ['nav.b', 'Mod+2'],
      ['nav.c', 'Mod+3'],
      ['nav.settings', 'Mod+4'],
    ])
  })

  test('reordering the declaration renumbers the keys', () => {
    const reordered: AnyNavConfig = {
      sections: [{ ...NAV.sections[1]!, items: [...NAV.sections[1]!.items] }, NAV.sections[0]!],
    }
    const byId = Object.fromEntries(navCommands(reordered).map((cmd) => [cmd.id, cmd.chord]))
    expect(byId['nav.c']).toBe('Mod+1')
    expect(byId['nav.a']).toBe('Mod+2')
    expect(byId['nav.b']).toBe('Mod+3')
  })

  test('only the first nine top-level items get a key and a child label carries its trail', () => {
    const many: AnyNavConfig = {
      sections: [
        { id: 's', label: 'S', items: Array.from({ length: 11 }, (_, i) => item(`i${i}`)) },
      ],
    }
    const chords = navCommands(many).map((cmd) => cmd.chord)
    expect(chords.slice(0, 9)).toEqual(Array.from({ length: 9 }, (_, i) => `Mod+${i + 1}`))
    expect(chords.slice(9)).toEqual([undefined, undefined])
    expect(navCommands(NAV)[1]?.label).toBe('Go to A / A1')
  })

  test('a disabled item is not listed but keeps its number', () => {
    const nav: AnyNavConfig = {
      sections: [{ id: 's', label: 'S', items: [item('x', { disabled: true }), item('y')] }],
    }
    expect(navCommands(nav).map((cmd) => [cmd.id, cmd.chord])).toEqual([['nav.y', 'Mod+2']])
  })
})
