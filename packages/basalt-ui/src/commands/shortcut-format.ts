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
 * formatShortcutDisplay('Mod+S', true)   // '⌘ S' on mac
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

/**
 * Convert a shortcut string to a list of Kbd-friendly tokens.
 * 'Mod+S' → ['⌘', 'S'] (mac) or ['Ctrl', 'S'] (other).
 * 'Shift+Mod+P' → ['⇧', '⌘', 'P'] (mac) or ['Shift', 'Ctrl', 'P'] (other).
 * isMac is the post-mount platform flag; defaults false on SSR / first render.
 *
 * @example
 * parseShortcut('Mod+S', true)         // ['⌘', 'S']
 * parseShortcut('Shift+Mod+P', false)  // ['Shift', 'Ctrl', 'P']
 */
export function parseShortcut(shortcut: string, isMac: boolean): string[] {
  return shortcut.split('+').map((key) => {
    switch (key.toLowerCase()) {
      case 'mod':
        return isMac ? '⌘' : 'Ctrl'
      case 'shift':
        return isMac ? '⇧' : 'Shift'
      case 'alt':
        return isMac ? '⌥' : 'Alt'
      case 'meta':
        return isMac ? '⌘' : 'Meta'
      case 'ctrl':
        return isMac ? '^' : 'Ctrl'
      default:
        return key.toUpperCase()
    }
  })
}

// ── formatShortcutDisplay ─────────────────────────────────────────────────────

/**
 * Format a shortcut string for inline display (e.g. Spotlight action description).
 * Returns a compact string like '⌘ S' (mac) or 'Ctrl+S' (windows).
 *
 * isMac is the post-mount platform flag. Pass false on SSR / first client render.
 *
 * Note: @tanstack/hotkeys also exports `formatForDisplay` which produces equivalent output
 * with richer symbol handling. That function requires the optional peer; this utility is
 * always-on and produces the same tokens via parseShortcut.
 *
 * @example
 * formatShortcutDisplay('Mod+S', true)         // '⌘ S'
 * formatShortcutDisplay('Mod+S', false)         // 'Ctrl+S'
 * formatShortcutDisplay('Shift+Mod+P', true)    // '⇧ ⌘ P'
 */
export function formatShortcutDisplay(shortcut: string, isMac: boolean): string {
  const tokens = parseShortcut(shortcut, isMac)
  // Mac uses space-separated symbols (⌘ S); windows uses + (Ctrl+S)
  return isMac ? tokens.join(' ') : tokens.join('+')
}
