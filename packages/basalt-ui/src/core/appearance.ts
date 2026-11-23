/**
 * Appearance state: `data-density`, `data-frame` and `data-accent` on `<html>`, stored together as
 * one JSON object under `basalt:appearance`. `setScheme` keeps the scheme on its own key; the boot
 * script (`basalt-ui/theme-script`) applies both before paint. The page's attributes are the state:
 * `appearanceSnapshot` reads them, so the boot script, `setScheme` and another tab are one source.
 * Imports nothing that renders.
 */
import { isAccentName } from '../tokens/accents'
import type { AccentName } from '../tokens/accents'
import { SCHEME_ATTRIBUTE, SCHEME_KEY, parseScheme, setScheme } from './scheme'
import type { Scheme } from './scheme'

export const APPEARANCE_KEY = 'basalt:appearance'

/** Control and row height steps; `dense` is the default and needs no attribute. */
export const DENSITIES = ['dense', 'normal', 'comfortable'] as const
export type AppearanceDensity = (typeof DENSITIES)[number]

/** How the shell's work surface meets the window from `md` up; compact is always flush. */
export const FRAMES = ['panel', 'flush'] as const
export type AppearanceFrame = (typeof FRAMES)[number]

/** A stored choice per attribute; an absent key leaves the app's default. */
export type Appearance = {
  density?: AppearanceDensity
  frame?: AppearanceFrame
  accent?: AccentName
}

/** A change to apply: a value sets its attribute, `null` removes it, an absent key keeps it. */
export type AppearanceChange = { [K in keyof Appearance]?: Appearance[K] | null }

/** What the page wears now: the scheme (`auto` when `data-theme` is absent) and the three attributes. */
export type AppearanceState = Appearance & { scheme: Scheme }

const KEYS = ['density', 'frame', 'accent'] as const
type Key = (typeof KEYS)[number]

const attribute = (key: Key): string => `data-${key}`

const valid: Record<Key, (value: unknown) => boolean> = {
  density: (v) => (DENSITIES as readonly unknown[]).includes(v),
  frame: (v) => (FRAMES as readonly unknown[]).includes(v),
  accent: isAccentName,
}

/** The valid keys of a stored value; anything else (an old value, a hand edit) is dropped. */
export function parseAppearance(raw: unknown): Appearance {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, unknown> = {}
  for (const key of KEYS) {
    const value = (raw as Record<string, unknown>)[key]
    if (valid[key](value)) out[key] = value
  }
  return out as Appearance
}

/** The stored appearance, or `{}` when nothing valid is stored or storage throws. */
export function readAppearance(): Appearance {
  try {
    return parseAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

function applyKey(root: HTMLElement, key: Key, value: string | null | undefined): void {
  if (value === undefined) return
  if (value === null) root.removeAttribute(attribute(key))
  else root.setAttribute(attribute(key), value)
}

function store(value: Appearance): void {
  try {
    if (Object.keys(value).length === 0) localStorage.removeItem(APPEARANCE_KEY)
    else localStorage.setItem(APPEARANCE_KEY, JSON.stringify(value))
  } catch {
    // storage unavailable: the attributes still apply for this page
  }
}

/**
 * `setAppearance({ density: 'normal', accent: 'violet', frame: null })` applies the change to
 * `<html>` at once and stores the merged result. `setAppearance()` re-reads storage and applies it,
 * overriding the attributes: call it after an async restore.
 */
export function setAppearance(change?: AppearanceChange): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (change === undefined) {
    const stored = readAppearance()
    for (const key of KEYS) applyKey(root, key, stored[key] ?? null)
    return
  }
  const next: Record<string, unknown> = { ...readAppearance() }
  for (const key of KEYS) {
    const value = change[key]
    if (value === undefined) continue
    if (value !== null && !valid[key](value)) continue
    applyKey(root, key, value)
    if (value === null) delete next[key]
    else next[key] = value
  }
  store(next as Appearance)
}

/** Removes the three attributes and the stored appearance; the scheme is `setScheme`'s. */
export function resetAppearance(): void {
  setAppearance({ density: null, frame: null, accent: null })
}

const SERVER: AppearanceState = Object.freeze({ scheme: 'auto' })
let last: AppearanceState = SERVER
let lastKey = ''

/** What `<html>` wears now, the same object while nothing changed (a `useSyncExternalStore` snapshot). */
export function appearanceSnapshot(): AppearanceState {
  if (typeof document === 'undefined') return SERVER
  const root = document.documentElement
  const scheme = parseScheme(root.getAttribute(SCHEME_ATTRIBUTE)) ?? 'auto'
  const attrs = KEYS.map((key) => root.getAttribute(attribute(key)))
  const key = [scheme, ...attrs].join('|')
  if (key === lastKey) return last
  const state: Record<string, unknown> = { scheme }
  KEYS.forEach((name, i) => {
    if (valid[name](attrs[i])) state[name] = attrs[i]
  })
  lastKey = key
  last = state as AppearanceState
  return last
}

/** The server's snapshot: nothing chosen. */
export function serverAppearance(): AppearanceState {
  return SERVER
}

/**
 * Calls `onChange` when `<html>` changes its scheme or appearance attributes, whoever wrote them;
 * another tab's write to either key is applied here first.
 */
export function subscribeAppearance(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [SCHEME_ATTRIBUTE, ...KEYS.map(attribute)],
  })
  const onStorage = (event: StorageEvent): void => {
    if (event.key === APPEARANCE_KEY) setAppearance()
    if (event.key === SCHEME_KEY) setScheme()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    observer.disconnect()
    window.removeEventListener('storage', onStorage)
  }
}
