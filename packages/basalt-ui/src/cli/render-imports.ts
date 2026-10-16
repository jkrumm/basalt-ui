/**
 * The ONE import hop `doctor` follows from a Start route file to a component wrapper that holds the
 * `<BasaltProvider>` tag. A leaf: it imports no CLI command module. Textual, so blind to tsconfig
 * `extends` paths, `export … from` re-exports, dynamic `import()` and multi-wildcard `paths`.
 */
import { dirname, relative, resolve } from 'node:path'

import { providerTags } from './provider-tags'
import type { ProviderTag } from './provider-tags'
import { parseJsonc, readIfExists, tokenize } from './source-text'

export type ModuleFile = { file: string; text: string | null; tags: ProviderTag[] }

/** One read path for every module in the walk; `text` is null for a missing file. */
export function loadModule(cwd: string, file: string): ModuleFile {
  const text = readIfExists(resolve(cwd, file))
  return { file, text, tags: providerTags(text ?? '') }
}

const MODULE_SUFFIXES = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']

type Alias = [prefix: string, dir: string]

/** tsconfig `compilerOptions.paths` single-wildcard `alias/*` entries; a malformed shape is no alias. */
export function pathAliases(cwd: string): Alias[] {
  const opts = parseJsonc(readIfExists(resolve(cwd, 'tsconfig.json')) ?? '')?.['compilerOptions']
  if (typeof opts !== 'object' || opts === null) return []
  const { baseUrl, paths } = opts as { baseUrl?: unknown; paths?: unknown }
  if (typeof paths !== 'object' || paths === null) return []
  const base = typeof baseUrl === 'string' ? baseUrl : '.'
  return Object.entries(paths).flatMap(([pattern, targets]) => {
    const target: unknown = Array.isArray(targets) ? targets[0] : undefined
    if (!pattern.endsWith('/*') || typeof target !== 'string' || !target.endsWith('/*')) return []
    return [[pattern.slice(0, -1), `${base}/${target.slice(0, -1)}`]]
  })
}

const escapeRegex = (name: string): string => name.replaceAll('$', String.raw`\$`)

/** The local modules `file` renders a component from: `<Name` in JSX, name imported from a relative or aliased specifier. */
export function renderedImports(
  cwd: string,
  file: string,
  text: string,
  aliases: Alias[],
): string[] {
  const code = tokenize(text).code
  const found = new Set<string>()
  for (const m of text.matchAll(/\bimport\s+(?!type\b)([^'"]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[2]!.replace(/\.[jt]sx?$/, '')
    const base = spec.startsWith('.')
      ? resolve(cwd, dirname(file), spec)
      : aliases.flatMap(([prefix, dir]) =>
          spec.startsWith(prefix) ? [resolve(cwd, dir + spec.slice(prefix.length))] : [],
        )[0]
    if (base === undefined) continue
    const names = [...m[1]!.replace(/\btype\s+/g, '').matchAll(/[A-Za-z_$][\w$]*/g)].map(
      (n) => n[0],
    )
    if (!names.some((n) => new RegExp(`<${escapeRegex(n)}\\b`).test(code))) continue
    const rel = relative(cwd, base).split('\\').join('/')
    const hit = MODULE_SUFFIXES.map((x) => rel + x).find(
      (c) => readIfExists(resolve(cwd, c)) !== null,
    )
    if (hit !== undefined) found.add(hit)
  }
  return [...found]
}

/**
 * `hops`: modules (not already `scanned`) that a scanned file renders a component from and that hold
 * a provider tag. `far`: provider-holding modules one more hop out, which doctor does not follow but
 * names (the one-provider invariant and the failure message both need them).
 */
export function followProviderHops(
  cwd: string,
  scanned: ModuleFile[],
): { hops: ModuleFile[]; far: string[] } {
  const aliases = pathAliases(cwd)
  const modules = new Map(scanned.map((f) => [f.file, f]))
  const load = (file: string): ModuleFile => {
    const known = modules.get(file) ?? loadModule(cwd, file)
    modules.set(file, known)
    return known
  }
  const hops: ModuleFile[] = []
  const far = new Set<string>()
  for (const f of scanned) {
    for (const mod of renderedImports(cwd, f.file, f.text ?? '', aliases)) {
      if (scanned.some((s) => s.file === mod) || hops.some((h) => h.file === mod)) continue
      const hop = load(mod)
      if (hop.tags.length > 0) hops.push(hop)
      for (const next of renderedImports(cwd, mod, hop.text ?? '', aliases)) {
        if (!scanned.some((s) => s.file === next) && load(next).tags.length > 0) far.add(next)
      }
    }
  }
  const nearFiles = new Set(hops.map((h) => h.file))
  return { hops, far: [...far].filter((f) => !nearFiles.has(f)) }
}
