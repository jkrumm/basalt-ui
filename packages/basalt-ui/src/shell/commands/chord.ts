/**
 * The chord matcher: one pure parser, one canonical form for the duplicate check, one event
 * matcher and one guard that keeps a bare key away from the control it belongs to. No library:
 * `defineCommands` owns a single `keydown` listener (in `CommandPalette`) and nothing else binds keys.
 *
 * A chord is `Mod+Shift+P`: modifiers `Mod` (the platform's command key), `Ctrl`, `Meta`, `Alt` and
 * `Shift` in any order, then one key. Named keys are `Enter`, `Space`, `Escape`, `Tab`, the arrows,
 * `Backspace`, `Delete`, `Home`, `End`, `PageUp`, `PageDown` and `F1`..`F12`.
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

type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>

/** Whether a physical digit or letter key matches although the layout produced another character. */
function codeMatches(event: KeyEventLike, key: string): boolean {
  if (/^[a-z0-9]$/i.test(event.key)) return false
  return event.code === `Key${key.toUpperCase()}` || event.code === `Digit${key}`
}

/**
 * Whether the event is exactly this chord: every modifier it names is down and no other is. `Mod`
 * is `Meta` on Apple platforms and `Ctrl` elsewhere.
 */
export function matchesChord(event: KeyEventLike, chord: Chord, apple: boolean): boolean {
  const wantMeta = chord.meta || (chord.mod && apple)
  const wantCtrl = chord.ctrl || (chord.mod && !apple)
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl) return false
  if (event.altKey !== chord.alt || event.shiftKey !== chord.shift) return false
  const key = event.key.toLowerCase()
  if (key === chord.key) return true
  // Shift turns `1` into `!` and Alt turns `k` into a dead character; the physical key is the chord.
  return chord.key.length === 1 && codeMatches(event, chord.key)
}

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
const ACTIVATES =
  'button, a[href], summary, [role=button], [role=link], [role^=menuitem], [role=option], [role=checkbox], [role=switch], [role=tab], [role=radio]'

/**
 * Whether a chord may fire with `target` focused. A chord with no command modifier is a key the
 * focused control may want: it never fires in a text field, and a bare `Enter` or `Space` never
 * fires on anything that activates on that key (a button, a link, a menu item, a checkbox), so the
 * control still gets its keydown. A chord with `Mod`, `Ctrl`, `Meta` or `Alt` fires everywhere.
 */
export function mayFireOn(chord: Chord, target: EventTarget | null): boolean {
  if (chord.mod || chord.ctrl || chord.meta || chord.alt) return true
  if (!(target instanceof Element)) return true
  if (target.closest(EDITABLE) !== null) return false
  if ((chord.key === 'enter' || chord.key === ' ') && target.closest(ACTIVATES) !== null) {
    return false
  }
  return true
}
