/**
 * shortcut-format — platform-aware shortcut string parsing and display formatting.
 *
 * Extracted from ShortcutsHelp.tsx so projectors and other modules can share the logic.
 *
 * @example
 * // Kbd tokens for ShortcutsHelp rows:
 * parseShortcut('Mod+S', true)   // ['⌘', 'S']
 * parseShortcut('Mod+S', false)  // ['Ctrl', 'S']
 *
 * // Single display string for Spotlight description:
 * formatShortcutDisplay('Mod+S', true)   // '⌘S' on mac
 * formatShortcutDisplay('Mod+S', false)  // 'Ctrl+S' on windows
 */

// ── detectMac ─────────────────────────────────────────────────────────────────

/**
 * Returns true when running on macOS. SSR-safe — returns false when navigator is unavailable.
 * Uses userAgentData.platform when available; falls back to userAgent string regex.
 * Never call during render — use only inside useEffect to avoid hydration mismatches.
 */
export function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const uadPlatform = (navigator as { userAgentData?: { platform?: string } }).userAgentData
    ?.platform
  if (uadPlatform !== undefined) return /mac|iphone|ipad/i.test(uadPlatform)
  return /Mac|iPhone|iPad/.test(navigator.userAgent)
}

// ── parseShortcut ─────────────────────────────────────────────────────────────

/** Named keys → [mac glyph, other-platform word]. Keys are the lower-cased shortcut token. */
const NAMED_KEYS: Record<string, readonly [mac: string, other: string]> = {
  backspace: ['⌫', 'Backspace'],
  delete: ['⌦', 'Delete'],
  del: ['⌦', 'Delete'],
  arrowleft: ['←', 'Left'],
  arrowright: ['→', 'Right'],
  arrowup: ['↑', 'Up'],
  arrowdown: ['↓', 'Down'],
  left: ['←', 'Left'],
  right: ['→', 'Right'],
  up: ['↑', 'Up'],
  down: ['↓', 'Down'],
  escape: ['⎋', 'Esc'],
  esc: ['⎋', 'Esc'],
  enter: ['↩', 'Enter'],
  return: ['↩', 'Enter'],
  tab: ['⇥', 'Tab'],
  space: ['␣', 'Space'],
  home: ['↖', 'Home'],
  end: ['↘', 'End'],
  pageup: ['⇞', 'PgUp'],
  pagedown: ['⇟', 'PgDn'],
}

/** A key that is not a modifier or a named key: a single character upper-cases (`s` → `S`), any
 * other word title-cases (`f5` → `F5`, `insert` → `Insert`). */
function plainKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Convert a shortcut string to a list of Kbd-friendly tokens.
 * 'Mod+S' → ['⌘', 'S'] (mac) or ['Ctrl', 'S'] (other).
 * 'Shift+Mod+P' → ['⇧', '⌘', 'P'] (mac) or ['Shift', 'Ctrl', 'P'] (other).
 * Named keys read as glyphs on mac and Title-case words elsewhere:
 * 'Mod+Backspace' → ['⌘', '⌫'] (mac) or ['Ctrl', 'Backspace'] (other).
 * isMac is the post-mount platform flag; defaults false on SSR / first render.
 *
 * @example
 * parseShortcut('Mod+S', true)         // ['⌘', 'S']
 * parseShortcut('Shift+Mod+P', false)  // ['Shift', 'Ctrl', 'P']
 * parseShortcut('ArrowLeft', true)     // ['←']
 */
export function parseShortcut(shortcut: string, isMac: boolean): string[] {
  return shortcut.split('+').map((key) => {
    const lower = key.toLowerCase()
    switch (lower) {
      case 'mod':
        return isMac ? '⌘' : 'Ctrl'
      case 'shift':
        return isMac ? '⇧' : 'Shift'
      case 'alt':
        return isMac ? '⌥' : 'Alt'
      case 'meta':
        return isMac ? '⌘' : 'Meta'
      case 'ctrl':
        return isMac ? '⌃' : 'Ctrl'
      default: {
        const named = NAMED_KEYS[lower]
        if (named !== undefined) return isMac ? named[0] : named[1]
        return plainKey(key)
      }
    }
  })
}

// ── formatShortcutDisplay ─────────────────────────────────────────────────────

/**
 * Format a shortcut string for inline display (e.g. Spotlight action description).
 * Returns a compact string like '⌘S' / '⌘⌫' (mac, glyphs with no separator) or 'Ctrl+S' /
 * 'Ctrl+Backspace' (elsewhere, Title-case words joined with '+').
 *
 * isMac is the post-mount platform flag. Pass false on SSR / first client render.
 *
 * Note: @tanstack/hotkeys also exports `formatForDisplay` which produces equivalent output
 * with richer symbol handling. That function requires the optional peer; this utility is
 * always-on and produces the same tokens via parseShortcut.
 *
 * @example
 * formatShortcutDisplay('Mod+S', true)          // '⌘S'
 * formatShortcutDisplay('Mod+Backspace', true)  // '⌘⌫'
 * formatShortcutDisplay('Mod+S', false)         // 'Ctrl+S'
 * formatShortcutDisplay('Shift+Mod+P', true)    // '⇧⌘P'
 */
export function formatShortcutDisplay(shortcut: string, isMac: boolean): string {
  const tokens = parseShortcut(shortcut, isMac)
  return tokens.join(isMac ? '' : '+')
}
