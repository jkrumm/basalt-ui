/**
 * shiki singleton — OPTIONAL PEER, lazy dynamic-import, mirrors the streaming-markdown.tsx
 * optional-peer pattern (dynamic import + `.catch` degrade, no unhandled rejection, no crash).
 *
 * Dual TextMate themes (`github-light-high-contrast`/`github-dark`: the light one clears 4.5:1 on the off-white inset) baked into the output as `--shiki-*` CSS
 * vars via `defaultColor: false` (docs/CONTENT-SPEC.md decision 3) — a scheme flip is then
 * pure CSS with zero re-highlighting. The `createJavaScriptRegexEngine({ forgiving: true })` engine
 * never throws on partial/streamed code (vs the default Oniguruma/wasm engine).
 *
 * Not part of the public surface — `CodeBlock` is the only consumer. `shiki` is imported ONLY as a
 * type here (erased at compile time); the runtime import is fully dynamic so importing
 * `basalt-ui/content` never eagerly resolves the optional peer.
 */
import type { HighlighterCore, LanguageInput } from 'shiki'

const THEME_LIGHT = 'github-light-high-contrast'
const THEME_DARK = 'github-dark'

/**
 * Curated lazy language loaders — every subpath is a real `@shikijs/langs/*` export (verified
 * against the installed package). `@shikijs/langs`/`@shikijs/themes` are transitives of `shiki`
 * at RUNTIME (resolvable whenever the `shiki` optional peer is installed), but bun's isolated
 * install layout does not expose a package's own transitives to sibling workspace packages for
 * TYPE resolution — `@shikijs/langs`/`@shikijs/themes` are therefore also explicit devDependencies
 * here (dev-only; never a published dependency of `basalt-ui` itself).
 */
const LANG_LOADERS: Record<string, () => Promise<unknown>> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  bash: () => import('@shikijs/langs/bash'),
  sh: () => import('@shikijs/langs/sh'),
  zsh: () => import('@shikijs/langs/zsh'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
  yaml: () => import('@shikijs/langs/yaml'),
  markdown: () => import('@shikijs/langs/markdown'),
  sql: () => import('@shikijs/langs/sql'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  rust: () => import('@shikijs/langs/rust'),
  diff: () => import('@shikijs/langs/diff'),
  toml: () => import('@shikijs/langs/toml'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
}

/* The fence-info shorthands people actually type, resolved to their canonical grammar. */
const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  shell: 'bash',
  shellscript: 'bash',
  docker: 'dockerfile',
}

/**
 * shiki stops tokenising a line after 500 ms by default and leaves the rest mis-scoped (`:` and `=`
 * in `const x: number = 1` come back variable-blue instead of keyword-red). The first pass over a
 * grammar compiles its regexes lazily and blows that budget on a loaded host, so the same code
 * highlighted twice differed. 0 is "no limit": the colors never depend on how busy the host is.
 */
const NO_TIME_LIMIT = 0

function normalizeLang(lang: string): string {
  const lowered = lang.toLowerCase()
  return Object.hasOwn(LANG_ALIASES, lowered) ? (LANG_ALIASES[lowered] as string) : lowered
}

let highlighterPromise: Promise<HighlighterCore | null> | null = null
let warnedMissingPeer = false

/** Dev-only, once per process: the highlighter peers did not resolve, so code stays unhighlighted. */
function warnMissingPeer(error: unknown): void {
  if (warnedMissingPeer || process.env['NODE_ENV'] === 'production') return
  warnedMissingPeer = true
  console.warn(
    '[basalt] CodeBlock: syntax highlighting is off — a peer of basalt-ui/content did not load ' +
      `(${error instanceof Error ? error.message : String(error)}). Code renders unhighlighted. ` +
      'Install them with: bun add shiki @shikijs/langs @shikijs/themes',
  )
}

async function loadHighlighter(): Promise<HighlighterCore | null> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
  ])
  return createHighlighterCore({
    themes: [
      import('@shikijs/themes/github-light-high-contrast'),
      import('@shikijs/themes/github-dark'),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
}

/** Module-level singleton — resolves once; every caller shares the same highlighter instance. */
function getHighlighter(): Promise<HighlighterCore | null> {
  highlighterPromise ??= loadHighlighter().catch((error: unknown) => {
    warnMissingPeer(error)
    return null
  })
  return highlighterPromise
}

/** Loads `lang` into the shared highlighter on demand (no-op if already loaded). */
async function ensureLanguage(highlighter: HighlighterCore, lang: string): Promise<boolean> {
  if (highlighter.getLoadedLanguages().includes(lang)) return true
  if (!Object.hasOwn(LANG_LOADERS, lang)) return false
  const loadLang = LANG_LOADERS[lang]
  if (!loadLang) return false
  try {
    await highlighter.loadLanguage(loadLang() as LanguageInput)
    return true
  } catch (error) {
    warnMissingPeer(error)
    return false
  }
}

/**
 * Highlight `code` as `lang` via the shared shiki singleton. Returns `null` (never throws) when:
 *  - the `shiki` optional peer is not installed (the dynamic import rejected), or
 *  - `lang` is not in the curated {@link LANG_LOADERS} map (an unsupported/unknown language never
 *    gets a wasted highlight pass — the caller renders plain mono instead).
 */
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  const highlighter = await getHighlighter()
  if (!highlighter) return null

  const normalized = normalizeLang(lang)
  const loaded = await ensureLanguage(highlighter, normalized)
  if (!loaded) return null

  try {
    return highlighter.codeToHtml(code, {
      lang: normalized,
      themes: { light: THEME_LIGHT, dark: THEME_DARK },
      defaultColor: false,
      tokenizeTimeLimit: NO_TIME_LIMIT,
    })
  } catch {
    return null
  }
}

/**
 * Longest source that is highlighted. A server render runs shiki on the request's thread for
 * whatever a model wrote into a fence: measured on the mini, about 5 ms per 1000 characters and 15
 * times the source in markup (50 000 characters: 250 ms, 750 KB), so a larger block stays plain on
 * the server and in the browser alike (hydration needs the same answer on both sides). The cost of
 * a render is then bounded per fence, and in total by the size of the message the host accepts.
 */
const MAX_HIGHLIGHT_CHARS = 50_000

/** Whether `code` as `lang` is worth waiting on: a grammar the curated map loads, of a size shiki is asked for. */
export function canHighlight(lang: string, code: string): boolean {
  return code.length <= MAX_HIGHLIGHT_CHARS && Object.hasOwn(LANG_LOADERS, normalizeLang(lang))
}

/** One highlight for one source: the promise to suspend on, and the markup once it has settled. */
export type Highlight = {
  promise: Promise<string | null>
  /** `undefined` while pending; the markup, or `null` for "stays plain", once settled. */
  settled?: { html: string | null }
  /** A render has taken the settled markup: the entry is no longer a retry waiting to happen. */
  read?: boolean
}

/**
 * Source characters the cache keeps (about 15 times that in markup), up to twice that while entries
 * wait unread (see `evict`). A settled block asks for the
 * same source on every render and on the server render before it, so a hit is the common case; the
 * bound only stops a long-lived page that shows ever-new sources from holding them all.
 */
const CACHE_CHARS = 500_000
const cache = new Map<string, Highlight>()
let cachedChars = 0

/**
 * Drops the least recently asked-for settled entries until the cache fits. A pending entry is still awaited by a
 * render, and a settled one nobody has read yet is a suspended boundary's retry about to happen, so
 * both stay until the cache is twice over budget (a render that was aborted never reads its entry).
 */
function evict(): void {
  for (const [limit, evictable] of [
    [CACHE_CHARS, (entry: Highlight): boolean => entry.read === true],
    [2 * CACHE_CHARS, (entry: Highlight): boolean => entry.settled !== undefined],
  ] as const) {
    for (const [key, entry] of cache) {
      if (cachedChars <= limit) return
      if (!evictable(entry)) continue
      cache.delete(key)
      cachedChars -= key.length
    }
  }
}

/**
 * The highlight of `code` as `lang`, one per distinct pair. A render that reads it suspends on
 * `promise` until `settled` is set, so the server render waits for the markup and the client's first
 * hydration pass finds it already there when the same process rendered it (tests, a dev server).
 * `NUL` cannot occur in a language name, so the key is unambiguous.
 */
export function getHighlight(code: string, lang: string): Highlight {
  const key = `${lang}\0${code}`
  const hit = cache.get(key)
  if (hit) {
    if (hit.settled) hit.read = true
    // Map order is recency, so the eviction below drops what no render has asked for in the longest time.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const entry: Highlight = {
    promise: highlightCode(code, lang).then((html) => {
      entry.settled = { html }
      return html
    }),
  }
  cache.set(key, entry)
  cachedChars += key.length
  evict()
  return entry
}
