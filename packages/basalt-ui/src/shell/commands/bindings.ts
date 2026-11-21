/**
 * The one place a key reaches a command: `@tanstack/react-hotkeys` registers every chord of the set
 * and nothing else in `src/` imports it. A retreat from the library, or a bump that breaks it, is
 * this file. `defineCommands` has already checked the chords at define time; this only fires them.
 */
import { useHotkeys } from '@tanstack/react-hotkeys'
import type { UseHotkeyDefinition } from '@tanstack/react-hotkeys'
import { useMemo } from 'react'
import { currentArea } from './area'
import { chordHotkey, sequenceId, yieldsToControls } from './chord'
import type { Chord } from './chord'

/** How long a sequence waits for its next step. */
const SEQUENCE_MS = 1000

/** What a binding needs of a command: its steps, where it fires and what it runs. */
export type Bindable = {
  readonly steps: readonly Chord[]
  readonly area?: string | undefined
  readonly enabled?: (() => boolean) | undefined
  readonly run: () => unknown
}

/**
 * Binds every item that has a chord. A command fires when `allowed` holds, `enabled()` holds (read at
 * the key press) and focus is inside its `area` (or it has none); an area command beats a global one
 * on the same chord, whichever was declared first. A chord with no command modifier never fires in a
 * text field or on a control that uses the key itself, and a held key does not repeat.
 */
export function useChordBindings<T extends Bindable>(
  items: readonly T[],
  allowed: (item: T) => boolean,
): void {
  const groups = useMemo(() => {
    const byChord = new Map<string, T[]>()
    for (const item of items) {
      if (item.steps.length === 0) continue
      const id = sequenceId(item.steps)
      byChord.set(id, [...(byChord.get(id) ?? []), item])
    }
    return [...byChord.values()]
  }, [items])

  const definitions = groups.map((group): UseHotkeyDefinition => {
    const steps = (group[0] as T).steps
    const first = steps[0] as Chord
    const callback = (event: KeyboardEvent): void => {
      const scope = currentArea()
      const hits = group.filter(
        (item) =>
          allowed(item) &&
          (item.area === undefined || item.area === scope) &&
          item.enabled?.() !== false,
      )
      if (hits.length === 0) return
      event.preventDefault()
      void (hits.find((item) => item.area !== undefined) ?? hits[0])?.run()
    }
    const common = {
      ignoreInputs: yieldsToControls(first),
      ignoreDefaultPrevented: true,
      stopPropagation: false,
    }
    if (steps.length === 1) {
      return {
        hotkey: chordHotkey(first),
        callback,
        // The callback prevents the default only for a command that fires here.
        options: { ...common, preventDefault: false, requireReset: true },
      } as UseHotkeyDefinition
    }
    return {
      hotkey: steps.map(chordHotkey),
      callback,
      options: { ...common, timeout: SEQUENCE_MS },
    } as UseHotkeyDefinition
  })

  useHotkeys(definitions)
}
