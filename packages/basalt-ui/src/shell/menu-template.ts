/**
 * `toMenuTemplate`: the same command set as plain JSON for a native menu. The host (Rust, in
 * shutterflow's case) builds its menu from this and, when an item is chosen, dispatches the item's
 * chord into the webview as a key event; `CommandPalette` then runs the command exactly as a typed
 * key would. The `accelerator` only displays, so the menu never owns a second key map.
 */
import type { CommandMap, CommandSet } from './commands/define-commands'

export type MenuTemplateItem =
  | { readonly type: 'separator' }
  | {
      readonly type: 'item'
      readonly id: string
      readonly label: string
      /** The chord as written, `Mod+Shift+P`: what the host dispatches into the webview. */
      readonly chord: string
      /** The same chord for display in the host's own vocabulary, `CmdOrCtrl+Shift+P`. */
      readonly accelerator: string
      /** `enabled()` at the time of the call; call again to refresh. */
      readonly enabled: boolean
    }

export type MenuTemplate = readonly MenuTemplateItem[]

export type MenuTemplateOptions<T extends CommandMap = CommandMap> = {
  /**
   * Item ids in menu order, `shell.toggle-rail` included; `'-'` is a separator. Default: every
   * command with a chord, built-ins first, then declared order.
   */
  order?: readonly ((keyof T & string) | 'shell.toggle-rail' | '-')[]
}

const ACCELERATOR_KEYS: Readonly<Record<string, string>> = {
  mod: 'CmdOrCtrl',
  ctrl: 'Ctrl',
  meta: 'Cmd',
  alt: 'Alt',
  shift: 'Shift',
  ' ': 'Space',
  escape: 'Escape',
  enter: 'Enter',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
}

function accelerator(chord: string): string {
  return chord
    .split('+')
    .map((part) => {
      const lower = part.trim().toLowerCase()
      return ACCELERATOR_KEYS[lower] ?? (lower.length === 1 ? lower.toUpperCase() : part.trim())
    })
    .join('+')
}

/**
 * Turns a command set into a native-menu template: plain, JSON-safe data with no function in it.
 * Only a command with a chord can be in a menu, because the chord is what the host dispatches; an
 * `order` that names an unknown id or one without a chord throws.
 *
 * @useWhen the app runs in a native shell (Tauri) whose menu bar should list the commands of the app
 * @neverWhen the app is web only (the palette is the menu) or the menu needs submenus (the host groups the items)
 *
 * @example
 * const template = toMenuTemplate(COMMANDS, { order: ['file.save', '-', 'shell.toggle-rail'] })
 * await invoke('set_menu', { template })
 */
export function toMenuTemplate<T extends CommandMap>(
  commands: CommandSet<T>,
  options: MenuTemplateOptions<T> = {},
): MenuTemplate {
  const byId = new Map(commands.entries.map((entry) => [entry.id, entry]))
  const order =
    options.order ??
    commands.entries
      .filter((entry) => entry.chord !== undefined && entry.id !== 'shell.palette')
      .map((entry) => entry.id)
  const items: MenuTemplateItem[] = []
  for (const id of order) {
    if (id === '-') {
      items.push({ type: 'separator' })
      continue
    }
    const entry = byId.get(id)
    if (entry === undefined) throw new Error(`[basalt] toMenuTemplate: no command "${id}"`)
    if (entry.chord === undefined) {
      throw new Error(`[basalt] toMenuTemplate: "${id}" has no chord, so a menu cannot dispatch it`)
    }
    items.push({
      type: 'item',
      id: entry.id,
      label: entry.label,
      chord: entry.chord,
      accelerator: accelerator(entry.chord),
      enabled: entry.enabled?.() !== false,
    })
  }
  return items
}
