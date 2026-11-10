/**
 * URL trust boundary for model and author text. A parser decides, never a `startsWith`: the 2.x
 * prefix check treated `//attacker.example/p?d=SECRET` and `/\attacker.example` as same-origin
 * because they begin with `/`, and both resolve to another host.
 *
 * Allowed: `https:`, `mailto:`, `tel:` and same-origin relative references (`/a`, `a/b`, `#f`,
 * `?q`). Everything else is blocked, including explicit `http:`. `untrusted` text additionally
 * refuses any backslash, which WHATWG parsers fold into `/` for special schemes.
 */

export type UrlTrust = 'trusted' | 'untrusted'

const BASE = 'https://x.invalid'
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'mailto:', 'tel:'])
// remend's repair placeholders for a half-streamed destination, never a real URL.
const INCOMPLETE_SENTINEL = /^streamdown:incomplete-(?:link|image)$/i
const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const EDGE_SPACE = /^\s|\s$/

function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

export function classifyUrl(url: string, trust: UrlTrust): 'ok' | 'blocked' {
  if (hasControlChar(url) || EDGE_SPACE.test(url) || INCOMPLETE_SENTINEL.test(url)) return 'blocked'
  if (trust === 'untrusted' && url.includes('\\')) return 'blocked'
  try {
    const resolved = new URL(url, BASE)
    if (EXPLICIT_SCHEME.test(url))
      return ALLOWED_PROTOCOLS.has(resolved.protocol) ? 'ok' : 'blocked'
    return resolved.origin === BASE ? 'ok' : 'blocked'
  } catch {
    return 'blocked'
  }
}

/** The original string when the policy accepts it, otherwise `null`. */
export function safeUrl(url: string, trust: UrlTrust): string | null {
  return classifyUrl(url, trust) === 'ok' ? url : null
}

/** Like `safeUrl`, but only same-origin relative references: an explicit scheme is refused. */
export function safeRelativeUrl(url: string, trust: UrlTrust): string | null {
  return EXPLICIT_SCHEME.test(url) ? null : safeUrl(url, trust)
}
