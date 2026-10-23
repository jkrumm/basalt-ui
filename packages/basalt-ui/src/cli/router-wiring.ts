/**
 * Router wiring: is an app TanStack Start, code-routed (route tree defined in code) or file-routed
 * (plugin or `routeTree.gen.*`)? Textual, no TS program. A leaf module shared by init/sync/doctor.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { hasDependency, readIfExists, tokenize } from './source-text'

/** Relative-import hops (static or dynamic) `callsIn` follows from the entry; a router often lives in a singleton module. */
const IMPORT_DEPTH = 3

export const VITE_CONFIGS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map((e) => `vite.config.${e}`)
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

/** True when `src` calls a binding imported from `@tanstack/router-plugin` after its `plugins` key (a textual proxy for "inside the array"). */
export function registersRouterPlugin(src: string): boolean {
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
      .map((part) => part.split(/\s+as\s+/).pop() ?? part)
    return names.some((name) =>
      [
        ...code.matchAll(
          new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}(?:\\.\\w+)?\\s*\\(`, 'g'),
        ),
      ].some((call) => call.index > pluginsAt && !inLiteral(call.index)),
    )
  })
}

/** A relative specifier: `import … from`, `export … from`, bare `import '…'` and dynamic `import('…')`. */
const RELATIVE_IMPORT =
  /(?<![.\w$])(?:(?:import|export)\b[^'";]*?\bfrom|import\s*\(?)\s*['"](\.{1,2}\/[^'"]+)['"]/g

/** An import/export specifier naming the generated route tree (`./routeTree.gen`). */
const GENERATED_TREE_IMPORT =
  /(?<![.\w$])(?:(?:import|export)\b[^'";]*?\bfrom|import\s*\(?)\s*['"][^'"]*routeTree\.gen[^'"]*['"]/g

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
  const src = htmlEntry(readIfExists(resolve(dir, 'index.html')) ?? '') ?? 'src/main.tsx'
  return src.replace(/^\//, '')
}

type Tokens = ReturnType<typeof tokenize>

/**
 * Whether the entry or a module it imports (relative imports, static or dynamic, `IMPORT_DEPTH`
 * hops) matches `pattern` in code — a global regex, ignoring comments and string literals; an
 * import inside a comment or a string is not followed. `entryTokens` reuses an already-tokenized entry.
 */
export function callsIn(
  dir: string,
  entry: string,
  pattern: RegExp,
  entryTokens?: Tokens,
): boolean {
  const entryPath = resolve(dir, entry)
  const seen = new Set([entryPath])
  let frontier = [entryPath]
  for (let depth = 0; depth <= IMPORT_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const file of frontier) {
      const { code, inLiteral } =
        file === entryPath && entryTokens ? entryTokens : tokenize(readIfExists(file) ?? '')
      if ([...code.matchAll(pattern)].some((c) => !inLiteral(c.index))) return true
      for (const m of code.matchAll(RELATIVE_IMPORT)) {
        if (inLiteral(m.index)) continue
        const dep = resolveRelative(file, m[1] ?? '')
        if (dep === null || seen.has(dep)) continue
        seen.add(dep)
        next.push(dep)
      }
    }
    frontier = next
  }
  return false
}

/** A global regex matching a CALL of `name` (itself a regex source), generic or not — not an import or bare mention. */
export function callOf(pattern: string): RegExp {
  return new RegExp(`\\b${pattern}\\b\\s*(?:<[^()]*>)?\\s*\\(`, 'g')
}

const CREATE_BASALT_ROUTER = callOf('createBasaltRouter')

/** The directories a generated `routeTree.gen.*` is looked for in: beside the entry, then src/. */
export function routeTreeDirs(entry: string): string[] {
  return [...new Set([dirname(entry), 'src'])]
}

/** A TanStack router plugin in the vite config, or a `routeTree.gen.*` in `routeTreeDirs`. */
export function hasRouteTree(dir: string, entry: string): boolean {
  const vite = VITE_CONFIGS.map((f) => readIfExists(resolve(dir, f))).find((t) => t !== null) ?? ''
  return (
    registersRouterPlugin(vite) ||
    routeTreeDirs(entry).some((d) =>
      ['ts', 'tsx', 'js'].some((e) => existsSync(resolve(dir, d, `routeTree.gen.${e}`))),
    )
  )
}

/** Whether `createBasaltRouter` is called in a module reachable from the entry. */
export function hasRouter(dir: string, entry: string, entryTokens?: Tokens): boolean {
  return callsIn(dir, entry, CREATE_BASALT_ROUTER, entryTokens)
}

/** Whether the (tokenized) entry imports the generated route tree — a freshly seeded entry does. */
function importsGeneratedTree({ code, inLiteral }: Tokens): boolean {
  return [...code.matchAll(GENERATED_TREE_IMPORT)].some((m) => !inLiteral(m.index))
}

/**
 * THE classification, shared by `init`, `sync` and `doctor`: code-routed = `createBasaltRouter` is
 * called in a module reachable from the entry, no router plugin is registered and no
 * `routeTree.gen.*` exists, and the entry does not import a generated tree (a freshly seeded entry
 * does, before the first vite run — that app is file-routed). Comments and strings do not count.
 */
export function isCodeRoutedApp(cwd: string, appRel: string): boolean {
  const dir = resolve(cwd, appRel)
  const entry = appEntry(dir)
  const tokens = tokenize(readIfExists(resolve(dir, entry)) ?? '')
  if (importsGeneratedTree(tokens)) return false
  return hasRouter(dir, entry, tokens) && !hasRouteTree(dir, entry)
}

/** A TanStack Start app owns its router, so its router seeds give way to an in-tree `<BasaltProvider>`. */
export function isStartApp(cwd: string, appRel: string): boolean {
  return hasDependency(resolve(cwd, appRel), '@tanstack/react-start')
}

/** Why an app's router seeds are not placed (see `routerSeedSkip`). */
export type RouterSeedSkip = 'start' | 'code-routed' | 'shell-less' | null

export const CODE_ROUTED_NOTE =
  'code-routed app (createBasaltRouter, no route-tree plugin or routeTree.gen) — no main.tsx/nav.tsx/__root.tsx seeded.'

/**
 * Why an app's router seeds (main/nav/__root) are not placed: `start` (Start owns the router, and
 * wins when both apply) or `code-routed` (no generated tree to assume); null when they are. The
 * declared `shell: false` (`shell-less`) is applied by `routerSeedPlan`, which reads the config.
 */
export function routerSeedSkip(cwd: string, appRel: string): RouterSeedSkip {
  if (isStartApp(cwd, appRel)) return 'start'
  return isCodeRoutedApp(cwd, appRel) ? 'code-routed' : null
}

export const SHELL_LESS_NOTE =
  '`basalt.shell: false` — no main.tsx/nav.tsx/__root.tsx seeded; the app owns its root route (or has none).'

/** The router seeds (TanStack Router and Query are required peers of `.`, so they are always written). */
export const ROUTER_SEED_DESTS = {
  nav: 'src/lib/nav.tsx',
  root: 'src/routes/__root.tsx',
  main: 'src/main.tsx',
} as const

/** A router seed's dest, relative to the install root: under the app dir when it is not the root. */
export function routerSeedDest(appRel: string, seed: keyof typeof ROUTER_SEED_DESTS): string {
  return appRel === '' ? ROUTER_SEED_DESTS[seed] : `${appRel}/${ROUTER_SEED_DESTS[seed]}`
}

/** The router seeds' dests for an app dir (`main.tsx`, `nav.tsx`, `__root.tsx`). */
export function routerSeedDests(appRel: string): string[] {
  return (Object.keys(ROUTER_SEED_DESTS) as (keyof typeof ROUTER_SEED_DESTS)[]).map((seed) =>
    routerSeedDest(appRel, seed),
  )
}

/** Where a Start app's embedded provider goes (doctor, init and sync all say it). */
export const START_PROVIDER_HINT =
  'render <BasaltProvider><Outlet /></BasaltProvider> in the root route component or a pathless layout'
