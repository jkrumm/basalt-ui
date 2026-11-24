/**
 * `defineCommands`: the one declaration behind the chord matcher, the palette and the native menu.
 * It is pure data plus a check: it registers nothing and binds no key. `CommandPalette` reads the
 * set and binds its chords through `bindings.ts`; `toMenuTemplate` reads the same set for the host menu.
 */
import type { IconComponent } from '../../core/ports'
import { canStepRecord, stepRecord } from '../../core/record-steps'
import { chordId, parseChord, parseChordSequence, sequenceId } from './chord'
import type { Chord } from './chord'

/** What a command is. Everything but `label` and `run` is optional. */
export type Command = {
  /** The palette row and the menu item. */
  label: string
  /**
   * `Mod+Shift+P`. `Mod` is the platform's command key. A sequence is chords separated by a space,
   * pressed one after the other (`g n`); a step must follow within a second. Reserved: `Mod+K`,
   * `Mod+B`, `?`, `Mod+1`..`Mod+9`, and no sequence may begin with one of them.
   */
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

/** One command of a set, resolved: its id and the steps of its chord (empty without one). */
export type CommandEntry = Command & {
  readonly id: string
  readonly steps: readonly Chord[]
  /** True for the commands the shell itself adds (`shell.*`, `record.*`). */
  readonly builtin: boolean
}

/** What `CommandPalette` binds into the shell's own commands when it mounts. */
export type ShellActions = {
  toggleRail(): void
  togglePalette(): void
  toggleShortcuts(): void
}

export type CommandSet<T extends CommandMap = CommandMap> = {
  /** The declared commands, as written. */
  readonly commands: Readonly<T>
  /** Built-ins first, then the declared commands in declaration order. */
  readonly entries: readonly CommandEntry[]
  /** Binds built-ins to the mounted shell. Called by `CommandPalette` and its shortcut list; returns the unbind. */
  bind(actions: Partial<ShellActions>): () => void
}

/** The built-in ids. `shell.toggle-rail` replaces 2.x `toggleSidebar`. */
export const SHELL_TOGGLE_RAIL = 'shell.toggle-rail'
export const SHELL_PALETTE = 'shell.palette'
export const SHELL_SHORTCUTS = 'shell.shortcuts'

export const RECORD_PREVIOUS = 'record.previous'
export const RECORD_NEXT = 'record.next'

/** The nav chords: `Mod+1`..`Mod+9` go to the Nth top-level `defineNav` item. */
export const NAV_CHORD_COUNT = 9

const BUILTINS: ReadonlyArray<{
  id: string
  label: string
  chord: string
  listed: boolean
  action: keyof ShellActions
}> = [
  {
    id: SHELL_TOGGLE_RAIL,
    label: 'Toggle sidebar',
    chord: 'Mod+B',
    listed: true,
    action: 'toggleRail',
  },
  {
    id: SHELL_PALETTE,
    label: 'Command palette',
    chord: 'Mod+K',
    listed: false,
    action: 'togglePalette',
  },
  {
    id: SHELL_SHORTCUTS,
    label: 'Keyboard shortcuts',
    chord: '?',
    listed: true,
    action: 'toggleShortcuts',
  },
]

/**
 * The steps of a routed record page (`PageBar records`): global, live only while such a page is on
 * screen with a record on that side. An app's global command may not take their chords; one in an
 * area may, and beats them there.
 */
const RECORD_STEPS: ReadonlyArray<{
  id: string
  label: string
  chord: string
  direction: 'previous' | 'next'
}> = [
  { id: RECORD_PREVIOUS, label: 'Previous record', chord: 'k', direction: 'previous' },
  { id: RECORD_NEXT, label: 'Next record', chord: 'j', direction: 'next' },
]

/** Whether `a` is `b` or its first steps; two commands in one scope may not be. */
function overlaps(a: readonly Chord[], b: readonly Chord[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.every((step, i) => chordId(step) === chordId(long[i] as Chord))
}

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
 * and `shell.shortcuts` (`?`, the shortcut list `CommandPalette` renders) are built in. A chord can
 * be a sequence (`g n`): two commands in one scope may not share a chord or begin with one another. A chord with no modifier never fires in a text field, and a bare `Enter` or `Space`
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
  /** The chords taken per scope (the area, or `''` for global), as steps. */
  const taken = new Map<string, { id: string; chord: string; steps: readonly Chord[] }[]>()
  const entries: CommandEntry[] = []
  const handlers: Partial<ShellActions> = {}

  for (const builtin of BUILTINS) {
    entries.push({
      id: builtin.id,
      label: builtin.label,
      chord: builtin.chord,
      steps: [parseChord(builtin.chord)],
      group: 'Shell',
      listed: builtin.listed,
      builtin: true,
      // The shortcut list binds only once it mounts, so until then `?` is inert and unlisted. The
      // rail and palette keep no gate: a native menu reads them with no shell mounted.
      ...(builtin.id === SHELL_SHORTCUTS && {
        enabled: () => handlers[builtin.action] !== undefined,
      }),
      run: () => handlers[builtin.action]?.(),
    })
  }

  for (const step of RECORD_STEPS) {
    const steps = [parseChord(step.chord)]
    taken.set('', [...(taken.get('') ?? []), { id: step.id, chord: step.chord, steps }])
    entries.push({
      id: step.id,
      label: step.label,
      chord: step.chord,
      steps,
      group: 'Record',
      builtin: true,
      enabled: () => canStepRecord(step.direction),
      run: () => stepRecord(step.direction),
    })
  }

  for (const [id, command] of Object.entries(spec)) {
    let steps: readonly Chord[] = []
    if (command.chord !== undefined) {
      steps = parseChordSequence(command.chord)
      const first = steps[0] as Chord
      const owner = reserved.get(chordId(first))
      if (owner !== undefined) {
        throw new Error(
          `[basalt] defineCommands: "${id}" takes ${command.chord}, which the shell reserves for ${owner}`,
        )
      }
      const scope = command.area ?? ''
      const inScope = taken.get(scope) ?? []
      const other = inScope.find((entry) => overlaps(entry.steps, steps))
      if (other !== undefined) {
        const same = sequenceId(other.steps) === sequenceId(steps)
        throw new Error(
          `[basalt] defineCommands: "${other.id}" and "${id}" ${
            same
              ? `share the chord ${command.chord}`
              : `overlap: "${other.chord}" and "${command.chord}", one starts the other`
          }${command.area === undefined ? '' : ` in area "${command.area}"`}`,
        )
      }
      inScope.push({ id, chord: command.chord, steps })
      taken.set(scope, inScope)
    }
    entries.push({ ...command, id, steps, builtin: false })
  }

  return {
    commands: spec,
    entries,
    bind(actions) {
      const keys = Object.keys(actions) as (keyof ShellActions)[]
      for (const key of keys) Object.assign(handlers, { [key]: actions[key] })
      return () => {
        for (const key of keys) if (handlers[key] === actions[key]) delete handlers[key]
      }
    },
  }
}
