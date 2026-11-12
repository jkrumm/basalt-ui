import { describe, expect, test } from 'bun:test'
import golden from './menu-template.golden.json'
import { defineCommands } from './commands/define-commands'
import { toMenuTemplate } from './menu-template'

const run = (): void => {}

/** The 6-command fixture the golden JSON pins. */
const COMMANDS = defineCommands({
  'file.new': { label: 'New run', chord: 'Mod+N', run },
  'file.save': { label: 'Save', chord: 'Mod+S', run },
  'file.export': { label: 'Export…', chord: 'Mod+Shift+E', run },
  'view.zoom-in': { label: 'Zoom in', chord: 'Mod+=', run },
  'edit.undo': { label: 'Undo', chord: 'Mod+Z', enabled: () => false, run },
  'help.docs': { label: 'Open docs', run },
})

describe('toMenuTemplate', () => {
  test('equals the committed golden JSON for the 6-command fixture', () => {
    const template = toMenuTemplate(COMMANDS, {
      order: [
        'file.new',
        'file.save',
        'file.export',
        '-',
        'edit.undo',
        '-',
        'view.zoom-in',
        'shell.toggle-rail',
      ],
    })
    expect(template).toEqual(golden as never)
  })

  test('is plain JSON: it survives a round trip unchanged', () => {
    const template = toMenuTemplate(COMMANDS)
    expect(JSON.parse(JSON.stringify(template))).toEqual(template as never)
  })

  test('without an order it lists every command that has a chord, the palette chord left out', () => {
    const ids = toMenuTemplate(COMMANDS).flatMap((item) => (item.type === 'item' ? [item.id] : []))
    expect(ids).toEqual([
      'shell.toggle-rail',
      'file.new',
      'file.save',
      'file.export',
      'view.zoom-in',
      'edit.undo',
    ])
  })

  test('a command without a chord, or an unknown id, cannot be in a menu', () => {
    expect(() => toMenuTemplate(COMMANDS, { order: ['help.docs'] })).toThrow('no chord')
    expect(() => toMenuTemplate(COMMANDS, { order: ['nope' as never] })).toThrow(
      'no command "nope"',
    )
  })

  test('named keys become the accelerator names a host expects', () => {
    const set = defineCommands({
      up: { label: 'Up', chord: 'Mod+pageup', run },
      f5: { label: 'Reload', chord: 'f5', run },
      del: { label: 'Delete', chord: 'Mod+Backspace', run },
    })
    const accelerators = toMenuTemplate(set, { order: ['up', 'f5', 'del'] }).flatMap((item) =>
      item.type === 'item' ? [item.accelerator] : [],
    )
    expect(accelerators).toEqual(['CmdOrCtrl+PageUp', 'F5', 'CmdOrCtrl+Backspace'])
  })
})
