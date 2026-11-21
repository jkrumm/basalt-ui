/**
 * The chord grammar: one pure parser, one canonical form for the duplicate check, the display keys
 * and the spelling the hotkey library takes. Key events are not matched here: `bindings.ts`
 * hands every chord to `@tanstack/react-hotkeys` and nothing else binds keys.
 *
 * A chord is `Mod+Shift+P`: modifiers `Mod` (the platform's command key), `Ctrl`, `Meta`, `Alt` and
 * `Shift` in any order, then one key. Named keys are `Enter`, `Space`, `Escape`, `Tab`, the arrows,
 * `Backspace`, `Delete`, `Home`, `End`, `PageUp`, `PageDown` and `F1`..`F12`. A sequence is chords
 * separated by a space, pressed one after the other: `g n`, `Mod+K Mod+S`.
 */

export type Chord = {
  readonly mod: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly alt: boolean
  readonly shift: boolean
  /** The key, lower-cased: `k`, `1`, `enter`, `arrowup`. */
  readonly key: string
}

const KEY_ALIASES: Readonly<Record<string, string>> = { esc: 'escape', space: ' ' }

/** Parses a chord string; throws on an empty chord, an unknown shape or a missing key. */
export function parseChord(source: string): Chord {
  const tokens = source.split('+').map((token) => token.trim())
  const flags = { mod: false, ctrl: false, meta: false, alt: false, shift: false }
  let key: string | undefined
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === '') throw new Error(`[basalt] chord "${source}" has an empty part`)
    if (Object.hasOwn(flags, lower)) {
      flags[lower as keyof typeof flags] = true
      continue
    }
    if (key !== undefined) throw new Error(`[basalt] chord "${source}" names two keys`)
    key = KEY_ALIASES[lower] ?? lower
  }
  if (key === undefined) throw new Error(`[basalt] chord "${source}" names no key`)
  return { ...flags, key }
}

/** Parses a chord or a sequence of chords (`g n`) into its steps; throws like `parseChord`. */
export function parseChordSequence(source: string): Chord[] {
  return source
    .replace(/\s*\+\s*/g, '+')
    .trim()
    .split(/\s+/)
    .map(parseChord)
}

/** The canonical text of a chord: two spellings of one chord compare equal. */
export function chordId(chord: Chord): string {
  const parts = [
    chord.mod && 'mod',
    chord.ctrl && 'ctrl',
    chord.meta && 'meta',
    chord.alt && 'alt',
    chord.shift && 'shift',
    chord.key,
  ]
  return parts.filter((part) => part !== false).join('+')
}

/** The canonical text of a sequence: two spellings of one sequence compare equal. */
export function sequenceId(steps: readonly Chord[]): string {
  return steps.map(chordId).join(' ')
}

const GLYPHS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  escape: 'Esc',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
}

/**
 * The keys of a chord for display, one entry per `Kbd` (`Mod` stays `Mod`: `Kbd` draws it as `⌘`
 * or `Ctrl`).
 */
export function chordKeys(chord: Chord): string[] {
  const keys: string[] = []
  if (chord.mod) keys.push('Mod')
  if (chord.ctrl) keys.push('Ctrl')
  if (chord.meta) keys.push('Meta')
  if (chord.alt) keys.push('Alt')
  if (chord.shift) keys.push('Shift')
  keys.push(GLYPHS[chord.key] ?? chord.key.charAt(0).toUpperCase() + chord.key.slice(1))
  return keys
}

/** Whether this is an Apple platform; the server says no, so a server render never guesses. */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
  return /mac|iphone|ipad/i.test(platform ?? navigator.userAgent)
}

const HOTKEY_NAMES: Readonly<Record<string, string>> = {
  ' ': 'Space',
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
}

/** The chord as the hotkey library spells it: `Mod+Shift+P`, `Escape`, `F5`, `?`. */
export function chordHotkey(chord: Chord): string {
  const named = HOTKEY_NAMES[chord.key]
  const key =
    named ??
    (/^f\d{1,2}$/.test(chord.key) || chord.key.length === 1 ? chord.key.toUpperCase() : chord.key)
  const parts = [
    chord.mod && 'Mod',
    chord.ctrl && 'Control',
    chord.meta && 'Meta',
    chord.alt && 'Alt',
    chord.shift && 'Shift',
    key,
  ]
  return parts.filter((part) => part !== false).join('+')
}

/**
 * Whether a chord leaves a focused control its own keys: a chord with no `Mod`, `Ctrl`, `Meta` or
 * `Alt` is a key the control may want (typing, Enter on a button), so the hotkey library's
 * `ignoreInputs` skips it there. A chord with one fires everywhere.
 */
export function yieldsToControls(chord: Chord): boolean {
  return !(chord.mod || chord.ctrl || chord.meta || chord.alt)
}
