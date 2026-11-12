/**
 * `defineCommands`: the one declaration behind the chord matcher, the palette and the native menu.
 * It is pure data plus a check: it registers nothing and binds no key. `CommandPalette` reads the
 * set and owns the one `keydown` listener; `toMenuTemplate` reads the same set for the host menu.
 */
import type { IconComponent } from '../../core/ports'
import { chordId, parseChord } from './chord'
import type { Chord } from './chord'

/** What a command is. Everything but `label` and `run` is optional. */
export type Command = {
  /** The palette row and the menu item. */
  label: string
  /** `Mod+Shift+P`. `Mod` is the platform's command key. Reserved: `Mod+K`, `Mod+B`, `Mod+1`..`Mod+9`. */
  chord?: string
  /**
   * The focus scope: the command fires only while focus is inside a `<Page area="…">` of this name,
   * and the palette lists it only there. Without it the command is global.
   */
  area?: string
  /** The palette section it sits under. */
  group?: string
  icon?: IconComponent
  /** Words the palette also matches besides the label. */
  keywords?: readonly string[]
  /** Read when a key is pressed and when the palette opens; `false` makes the command inert and unlisted. */
  enabled?: () => boolean
  /** `false` keeps the command out of the palette; the chord still works. Default `true`. */
  listed?: boolean
  run: () => void | Promise<void>
}

export type CommandMap = Record<string, Command>

/** One command of a set, resolved: its id and its parsed chord. */
export type CommandEntry = Command & {
  readonly id: string
  readonly parsed: Chord | undefined
  /** True for the commands the shell itself adds (`shell.*`). */
  readonly builtin: boolean
}

/** What the palette host binds into the shell's own commands when it mounts. */
export type ShellActions = { toggleRail(): void; togglePalette(): void }

export type CommandSet<T extends CommandMap = CommandMap> = {
  /** The declared commands, as written. */
  readonly commands: Readonly<T>
  /** Built-ins first, then the declared commands in declaration order. */
  readonly entries: readonly CommandEntry[]
  /** Binds the built-ins to the mounted shell. Called by `CommandPalette`; returns the unbind. */
  bind(actions: ShellActions): () => void
}

/** The built-in ids. `shell.toggle-rail` replaces 2.x `toggleSidebar`. */
export const SHELL_TOGGLE_RAIL = 'shell.toggle-rail'
export const SHELL_PALETTE = 'shell.palette'

/** The nav chords: `Mod+1`..`Mod+9` go to the Nth top-level `defineNav` item. */
export const NAV_CHORD_COUNT = 9

const BUILTINS: ReadonlyArray<{ id: string; label: string; chord: string; listed: boolean }> = [
  { id: SHELL_TOGGLE_RAIL, label: 'Toggle sidebar', chord: 'Mod+B', listed: true },
  { id: SHELL_PALETTE, label: 'Command palette', chord: 'Mod+K', listed: false },
]

/** Chords the shell owns; a declared command may not take one. */
function reservedChords(): Map<string, string> {
  const reserved = new Map<string, string>()
  for (const builtin of BUILTINS) reserved.set(chordId(parseChord(builtin.chord)), builtin.id)
  for (let n = 1; n <= NAV_CHORD_COUNT; n++) {
    reserved.set(chordId(parseChord(`Mod+${n}`)), `the nav item at position ${n}`)
  }
  return reserved
}

/**
 * Declares the commands of an app and checks them: two commands that share a chord (in the same
 * area, or both global) or a command that takes a chord the shell reserves throws here, at define
 * time, naming both. The returned set goes to `CommandPalette` and `toMenuTemplate`.
 *
 * Every `defineNav` item lists itself in the palette and `Mod+1`..`Mod+9` go to the first nine
 * top-level items in declaration order; declare no command for either. `shell.toggle-rail` (`Mod+B`)
 * is built in. A chord with no modifier never fires in a text field, and a bare `Enter` or `Space`
 * never fires on a focused button, link or menu item, so the control keeps its own key.
 *
 * @useWhen an app has shortcuts, a palette or a native menu: declare them once, here
 * @neverWhen the action is a destination (a `defineNav` item lists itself) or belongs to one control (use its own onClick)
 *
 * @example
 * export const COMMANDS = defineCommands({
 *   'run.start': { label: 'Start run', chord: 'Mod+Enter', area: 'runs', run: start },
 *   'jobs.cancel': { label: 'Cancel job', chord: 'Mod+.', enabled: () => hasJob(), run: cancel },
 *   'help.docs': { label: 'Open docs', group: 'Help', run: () => window.open('/docs') },
 * })
 * // __root.tsx, inside <AppShell>:  <CommandPalette commands={COMMANDS} />
 */
export function defineCommands<const T extends CommandMap>(spec: T): CommandSet<T> {
  const reserved = reservedChords()
  const taken = new Map<string, string>()
  const entries: CommandEntry[] = []
  const handlers: { current: ShellActions | undefined } = { current: undefined }

  for (const builtin of BUILTINS) {
    entries.push({
      id: builtin.id,
      label: builtin.label,
      chord: builtin.chord,
      parsed: parseChord(builtin.chord),
      group: 'Shell',
      listed: builtin.listed,
      builtin: true,
      run: () => {
        if (handlers.current === undefined) return
        if (builtin.id === SHELL_TOGGLE_RAIL) handlers.current.toggleRail()
        else handlers.current.togglePalette()
      },
    })
  }

  for (const [id, command] of Object.entries(spec)) {
    let parsed: Chord | undefined
    if (command.chord !== undefined) {
      parsed = parseChord(command.chord)
      const canonical = chordId(parsed)
      const owner = reserved.get(canonical)
      if (owner !== undefined) {
        throw new Error(
          `[basalt] defineCommands: "${id}" takes ${command.chord}, which the shell reserves for ${owner}`,
        )
      }
      const scope = `${canonical}@${command.area ?? ''}`
      const other = taken.get(scope)
      if (other !== undefined) {
        throw new Error(
          `[basalt] defineCommands: "${other}" and "${id}" share the chord ${command.chord}${
            command.area === undefined ? '' : ` in area "${command.area}"`
          }`,
        )
      }
      taken.set(scope, id)
    }
    entries.push({ ...command, id, parsed, builtin: false })
  }

  return {
    commands: spec,
    entries,
    bind(actions) {
      handlers.current = actions
      return () => {
        if (handlers.current === actions) handlers.current = undefined
      }
    },
  }
}
