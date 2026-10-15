/**
 * Textual source helpers shared by the CLI's router detection and its checks: reading a file as
 * `null` when it is not there, a package.json dependency probe, and a comment/string tokenizer.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** `abs` read as text, or null: absent, a directory, unreadable or raced away all mean "not there". */
export function readIfExists(abs: string): string | null {
  try {
    return readFileSync(abs, 'utf8')
  } catch {
    return null
  }
}

/** `<dir>/package.json` parsed as `T`; null when absent or not JSON. */
export function readPackageJson<T>(dir: string): T | null {
  const raw = readIfExists(resolve(dir, 'package.json'))
  try {
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const

/** True when `pkgName` appears in any of the consumer's dependencies, devDependencies or peerDependencies. */
export function hasDependency(cwd: string, pkgName: string): boolean {
  const pkg =
    readPackageJson<Partial<Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>>>(
      cwd,
    )
  return DEPENDENCY_FIELDS.some((field) => pkg?.[field]?.[pkgName] !== undefined)
}

/**
 * Strings and template literals (captured) and comments. Known, accepted gap: a regex literal that
 * contains a quote (`/'/`) opens a string this tokenizer never closes, which can blank or hide code
 * after it on that line; a template literal nested inside a `${…}` is not tracked either.
 */
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
