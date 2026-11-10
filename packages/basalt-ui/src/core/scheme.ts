/** Scheme state: `data-theme` on `<html>` plus the raw-string `basalt:scheme` device key. Imports nothing. */

export const SCHEME_KEY = 'basalt:scheme'
export const LEGACY_SCHEME_KEY = 'mantine-color-scheme-value'
export const SCHEME_ATTRIBUTE = 'data-theme'

export type Scheme = 'light' | 'dark' | 'auto'

const COOKIE_MAX_AGE = 31536000

let declaredCookie: string | undefined

export function parseScheme(raw: unknown): Scheme | undefined {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : undefined
}

function readStorage(key: string): Scheme | undefined {
  try {
    return parseScheme(localStorage.getItem(key))
  } catch {
    return undefined
  }
}

function readCookie(name: string): Scheme | undefined {
  try {
    for (const part of document.cookie.split(/;\s*/)) {
      if (part.startsWith(`${name}=`)) return parseScheme(part.slice(name.length + 1))
    }
  } catch {
    return undefined
  }
  return undefined
}

/** First valid value of the key, the legacy Mantine key, then the cookie (only when named). */
export function readScheme(
  options: { key?: string; cookie?: string | undefined } = {},
): Scheme | undefined {
  const { key = SCHEME_KEY, cookie } = options
  return (
    readStorage(key) ?? readStorage(LEGACY_SCHEME_KEY) ?? (cookie ? readCookie(cookie) : undefined)
  )
}

function apply(value: Scheme): void {
  const root = document.documentElement
  if (value === 'auto') root.removeAttribute(SCHEME_ATTRIBUTE)
  else root.setAttribute(SCHEME_ATTRIBUTE, value)
}

/**
 * `setScheme('dark' | 'light' | 'auto')` applies, stores `basalt:scheme` and mirrors the declared
 * cookie. `setScheme()` re-reads storage and applies, overriding any attribute: call it after an
 * async restore (same-tab localStorage writes fire no storage event).
 */
export function setScheme(value?: Scheme, options: { cookie?: string } = {}): void {
  if (typeof document === 'undefined') return
  if (options.cookie) declaredCookie = options.cookie
  if (value === undefined) {
    const stored = readScheme({ cookie: declaredCookie })
    if (stored) apply(stored)
    return
  }
  apply(value)
  try {
    localStorage.setItem(SCHEME_KEY, value)
  } catch {
    // storage unavailable: the attribute is still applied for this page
  }
  if (!declaredCookie) return
  try {
    document.cookie = `${declaredCookie}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  } catch {
    // cookies unavailable
  }
}
