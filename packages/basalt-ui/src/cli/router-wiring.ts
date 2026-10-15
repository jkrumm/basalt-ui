/**
 * Router wiring: is an app TanStack Start, code-routed (route tree defined in code) or file-routed
 * (plugin or `routeTree.gen.*`)? Textual, no TS program. A leaf module shared by init/sync/doctor.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function readText(abs: string): string {
  try {
    return readFileSync(abs, 'utf8')
  } catch {
    return ''
  }
}

/** Relative-import hops `callsIn` follows from the entry (a router often lives in a singleton module). */
const IMPORT_DEPTH = 3

/** Strings, template literals (captured) and comments. Known gap: a regex literal containing a quote, or a template nested in `${…}`. */
const TOKEN =
  /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g

/** Source with comments blanked (and template text), plus a test for "offset sits inside a string". */
export function tokenize(src: string): { code: string; inLiteral: (at: number) => boolean } {
  const literals: [number, number][] = []
  const code = src.replace(TOKEN, (m, literal: string | undefined, at: number) => {
    if (literal === undefined) return m.replace(/[^\n]/g, ' ')
    if (!literal.startsWith('`')) {
      literals.push([at, at + m.length])
      return m
    }
    // Template literal: blank the text, keep the delimiters and the `${…}` code scannable.
    return m.replace(
      /(\$\{[^}]*\})|[^\n`]/g,
      (c, interpolation: string | undefined) => interpolation ?? ' ',
    )
  })
  return { code, inLiteral: (at) => literals.some(([from, to]) => at >= from && at < to) }
}

const VITE_CONFIGS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map((e) => `vite.config.${e}`)
/** The first local `<script type="module" src>` in index.html (comments and remote src skipped). */
function htmlEntry(html: string): string | undefined {
  for (const [, attrs = ''] of html
    .replace(/<!--[\s\S]*?-->/g, '')
    .matchAll(/<script\b([^>]*)>/gi)) {
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]
    if (
      /\btype\s*=\s*["']?module\b/i.test(attrs) &&
      src !== undefined &&
      !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src)
    ) {
      return src
    }
  }
  return undefined
}

/** True when `code` calls a binding imported from `@tanstack/router-plugin` inside `plugins`. */
function registersRouterPlugin(src: string): boolean {
  const { code, inLiteral } = tokenize(src)
  const pluginsAt = [...code.matchAll(/\bplugins\b/g)].find((m) => !inLiteral(m.index))?.index
  if (pluginsAt === undefined) return false
  const imports = code.matchAll(
    /(?:^|;)[ \t]*import\s+(?:type\s+)?([^'"`;]*?)\s*from\s*(['"])@tanstack\/router-plugin(?:\/[^'"]*)?\2/gm,
  )
  return [...imports].some((m) => {
    if (inLiteral(m.index)) return false
    const names = (m[1] ?? '')
      .replace(/[{}]/g, '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '' && !/^type\s/.test(part))
      .map((part) => part.split(/\s+as\s+/).pop() as string)
    return names.some((name) =>
      [
        ...code.matchAll(
          new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}(?:\\.\\w+)?\\s*\\(`, 'g'),
        ),
      ].some((call) => call.index > pluginsAt && !inLiteral(call.index)),
    )
  })
}

const RELATIVE_IMPORT =
  /(?:\b(?:import|export)\b[^'";]*?\bfrom|\bimport)\s*['"](\.{1,2}\/[^'"]+)['"]/g

/** The source file a relative specifier names: as written, `.ts`/`.tsx` appended, or a directory index. */
function resolveRelative(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec.replace(/\.[jt]sx?$/, ''))
  return (
    [
      resolve(dirname(from), spec),
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ].find((f) => /\.[jt]sx?$/.test(f) && existsSync(f)) ?? null
  )
}

/** The module `index.html` loads for the app at `dir` (default src/main.tsx), relative to `dir`. */
export function appEntry(dir: string): string {
  const src = htmlEntry(readText(resolve(dir, 'index.html'))) ?? 'src/main.tsx'
  return src.replace(/^\//, '')
}

/**
 * Whether the entry or a module it imports (relative imports, `IMPORT_DEPTH` hops) matches
 * `pattern` in code — a regex source, searched globally, ignoring comments and string literals.
 */
export function callsIn(dir: string, entry: string, pattern: string): boolean {
  const seen = new Set<string>()
  let frontier = [resolve(dir, entry)]
  for (let depth = 0; depth <= IMPORT_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const file of frontier) {
      seen.add(file)
      const text = readText(file)
      const { code, inLiteral } = tokenize(text)
      if ([...code.matchAll(new RegExp(pattern, 'g'))].some((c) => !inLiteral(c.index))) return true
      for (const m of text.matchAll(RELATIVE_IMPORT)) {
        const dep = resolveRelative(file, m[1] ?? '')
        if (dep !== null && !seen.has(dep)) next.push(dep)
      }
    }
    frontier = next
  }
  return false
}

/** `new Foo<T>(` / `Foo<T>(`: a CALL of `name`, not an import line or a bare mention. */
export function callOf(name: string): string {
  return `\\b${name}\\b\\s*(?:<[^()]*>)?\\s*\\(`
}

/** The directories a generated `routeTree.gen.*` is looked for in: beside the entry, then src/. */
export function routeTreeDirs(entry: string): string[] {
  return [...new Set([dirname(entry), 'src'])]
}

/** A TanStack router plugin in the vite config, or a `routeTree.gen.*` in `routeTreeDirs`. */
export function hasRouteTree(dir: string, entry: string): boolean {
  const vite = VITE_CONFIGS.map((f) => readText(resolve(dir, f))).find((t) => t !== '') ?? ''
  return (
    registersRouterPlugin(vite) ||
    routeTreeDirs(entry).some((d) =>
      ['ts', 'tsx', 'js'].some((e) => existsSync(resolve(dir, d, `routeTree.gen.${e}`))),
    )
  )
}

/**
 * Code-routed: the app calls `createBasaltRouter`, registers no route-tree plugin, has no
 * `routeTree.gen.*`, and its entry does not import one (a freshly seeded entry does, before the
 * first vite run). Comments do not count.
 */
export function isCodeRoutedApp(cwd: string, appRel: string): boolean {
  const dir = resolve(cwd, appRel)
  const entry = appEntry(dir)
  if (!callsIn(dir, entry, callOf('createBasaltRouter')) || hasRouteTree(dir, entry)) return false
  return !/routeTree\.gen/.test(tokenize(readText(resolve(dir, entry))).code)
}

export const CODE_ROUTED_NOTE =
  'code-routed app (createBasaltRouter, no route-tree plugin or routeTree.gen) — no main.tsx/nav.tsx/__root.tsx seeded.'

/**
 * Why an app's router seeds (main/nav/__root) are not placed: `start` (Start owns the router, and
 * wins when both apply) or `code-routed` (no generated tree to assume); null when they are.
 */
export function routerSeedSkip(
  cwd: string,
  appRel: string,
  startApp: boolean,
): 'start' | 'code-routed' | null {
  if (startApp) return 'start'
  return isCodeRoutedApp(cwd, appRel) ? 'code-routed' : null
}
