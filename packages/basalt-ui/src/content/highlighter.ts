/**
 * shiki singleton — OPTIONAL PEER, lazy dynamic-import, mirrors the streaming-markdown.tsx
 * optional-peer pattern (dynamic import + `.catch` degrade, no unhandled rejection, no crash).
 *
 * Dual TextMate themes (`github-light`/`github-dark`) baked into the output as `--shiki-*` CSS
 * vars via `defaultColor: false` (docs/CONTENT-SPEC.md decision 3) — a Mantine scheme flip is then
 * pure CSS with zero re-highlighting. The `createJavaScriptRegexEngine({ forgiving: true })` engine
 * never throws on partial/streamed code (vs the default Oniguruma/wasm engine).
 *
 * Not part of the public surface — `CodeBlock` is the only consumer. `shiki` is imported ONLY as a
 * type here (erased at compile time); the runtime import is fully dynamic so importing
 * `basalt-ui/content` never eagerly resolves the optional peer.
 */
import type { HighlighterCore, LanguageInput } from 'shiki'

const THEME_LIGHT = 'github-light'
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

let highlighterPromise: Promise<HighlighterCore | null> | null = null

async function loadHighlighter(): Promise<HighlighterCore | null> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
  ])
  return createHighlighterCore({
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
}

/** Module-level singleton — resolves once; every caller shares the same highlighter instance. */
function getHighlighter(): Promise<HighlighterCore | null> {
  highlighterPromise ??= loadHighlighter().catch(() => null)
  return highlighterPromise
}

/** Loads `lang` into the shared highlighter on demand (no-op if already loaded). */
async function ensureLanguage(highlighter: HighlighterCore, lang: string): Promise<boolean> {
  if (highlighter.getLoadedLanguages().includes(lang)) return true
  const loadLang = LANG_LOADERS[lang]
  if (!loadLang) return false
  try {
    await highlighter.loadLanguage(loadLang() as LanguageInput)
    return true
  } catch {
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

  const lowered = lang.toLowerCase()
  const normalized = LANG_ALIASES[lowered] ?? lowered
  const loaded = await ensureLanguage(highlighter, normalized)
  if (!loaded) return null

  try {
    return highlighter.codeToHtml(code, {
      lang: normalized,
      themes: { light: THEME_LIGHT, dark: THEME_DARK },
      defaultColor: false,
    })
  } catch {
    return null
  }
}
