import { describe, expect, test } from 'bun:test'
import { parseChordSequence } from './chord'
import { defineCommands } from './define-commands'
import { navShortcutSources, shortcutGroups } from './shortcut-rows'

const run = (): void => {}

describe('shortcutGroups', () => {
  const set = defineCommands({
    'file.save': { label: 'Save', chord: 'Mod+S', group: 'File', run },
    'go.next': { label: 'Next page', chord: 'g n', group: 'Go', run },
    'runs.next': { label: 'Next run', chord: 'j', area: 'runs', run },
    'jobs.next': { label: 'Next job', chord: 'j', area: 'jobs', run },
    'no.chord': { label: 'No chord', group: 'File', run },
    'off.save': { label: 'Off', chord: 'Mod+O', group: 'File', enabled: () => false, run },
    'hidden.key': { label: 'Hidden', chord: 'Mod+H', listed: false, run },
  })

  test('lists only commands with a chord that works here, grouped in declaration order', () => {
    // The shell's own commands are inert until a host binds them.
    set.bind({ toggleRail: run, togglePalette: run, toggleShortcuts: run })
    const groups = shortcutGroups(set.entries, 'runs')
    expect(groups.map((g) => [g.name, g.rows.map((r) => r.id)])).toEqual([
      ['Shell', ['shell.toggle-rail', 'shell.palette', 'shell.shortcuts']],
      ['File', ['file.save']],
      ['Go', ['go.next']],
      ['runs', ['runs.next']],
      ['General', ['hidden.key']],
    ])
  })

  test('a command another area owns is left out; no area leaves only the global ones', () => {
    const ids = (area?: string) =>
      shortcutGroups(set.entries, area).flatMap((g) => g.rows.map((r) => r.id))
    expect(ids('jobs')).toContain('jobs.next')
    expect(ids('jobs')).not.toContain('runs.next')
    expect(ids()).not.toContain('jobs.next')
  })

  test('a sequence keeps its steps', () => {
    const row = shortcutGroups(set.entries, undefined)
      .flatMap((g) => g.rows)
      .find((r) => r.id === 'go.next')
    expect(row?.steps.map((s) => s.key)).toEqual(['g', 'n'])
  })

  test('nav chords join as a Navigate group; unchorded items are left out', () => {
    const sources = navShortcutSources([
      { id: 'nav.a', label: 'Go to A', chord: 'Mod+1', group: 'Navigate' } as never,
      { id: 'nav.b', label: 'Go to B', chord: undefined, group: 'Navigate' } as never,
    ])
    expect(sources.map((s) => s.id)).toEqual(['nav.a'])
    expect(sources[0]?.steps).toEqual(parseChordSequence('Mod+1'))
    const groups = shortcutGroups(sources, undefined)
    expect(groups).toEqual([{ name: 'Navigate', rows: [expect.objectContaining({ id: 'nav.a' })] }])
  })
})
