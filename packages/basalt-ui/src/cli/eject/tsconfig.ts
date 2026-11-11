/**
 * The `paths` row eject adds so tsc resolves `basalt-ui/ui/<name>` to the local file (ARCHITECTURE
 * 4.2). A text edit, never a re-serialise: comments, order and spacing of the consumer's tsconfig
 * survive, and `--undo` removes exactly what eject inserted. Where the edit cannot be made safely
 * (no `compilerOptions`, or a file that `extends` another and has no `paths` of its own, where a
 * new `paths` would silently drop the inherited ones), the caller exits 1 printing the line to add.
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import { parseJsonc } from '../source-text'

type Value =
  | { kind: 'object'; start: number; end: number; members: Member[] }
  | { kind: 'other'; start: number; end: number }
type Member = { key: string; keyStart: number; value: Value }

/** A JSONC value tree with source offsets (`end` exclusive). Throws on malformed input. */
function parse(text: string): Value {
  let i = 0
  const fail = (): never => {
    throw new SyntaxError(`unexpected input at offset ${i}`)
  }
  const skip = (): void => {
    for (;;) {
      if (/\s/.test(text[i] ?? '')) i++
      else if (text.startsWith('//', i))
        i = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i)
      else if (text.startsWith('/*', i)) {
        const close = text.indexOf('*/', i + 2)
        if (close === -1) fail()
        i = close + 2
      } else return
    }
  }
  const string = (): string => {
    const start = i++
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    if (text[i] !== '"') fail()
    i++
    return JSON.parse(text.slice(start, i)) as string
  }
  const value = (): Value => {
    skip()
    const start = i
    const ch = text[i]
    if (ch === '{') {
      i++
      const members: Member[] = []
      for (;;) {
        skip()
        if (text[i] === '}') break
        if (text[i] !== '"') fail()
        const keyStart = i
        const key = string()
        skip()
        if (text[i] !== ':') fail()
        i++
        members.push({ key, keyStart, value: value() })
        skip()
        if (text[i] === ',') i++
        else if (text[i] !== '}') fail()
      }
      i++
      return { kind: 'object', start, end: i, members }
    }
    if (ch === '[') {
      i++
      for (;;) {
        skip()
        if (text[i] === ']') break
        value()
        skip()
        if (text[i] === ',') i++
        else if (text[i] !== ']') fail()
      }
      i++
      return { kind: 'other', start, end: i }
    }
    if (ch === '"') {
      string()
      return { kind: 'other', start, end: i }
    }
    while (i < text.length && !/[\s,\]}/]/.test(text[i] ?? '')) i++
    if (i === start) fail()
    return { kind: 'other', start, end: i }
  }
  const root = value()
  skip()
  if (i !== text.length) fail()
  return root
}

const member = (value: Value | undefined, key: string): Member | undefined =>
  value?.kind === 'object' ? value.members.find((m) => m.key === key) : undefined

const lineIndent = (text: string, at: number): string => {
  const lineStart = text.lastIndexOf('\n', at - 1) + 1
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? ''
}

/** The tsconfig paths go into: the app's `tsconfig.app.json`, else its `tsconfig.json`. */
export function appTsconfig(appDir: string): string | null {
  for (const file of ['tsconfig.app.json', 'tsconfig.json']) {
    if (existsSync(join(appDir, file))) return join(appDir, file)
  }
  return null
}

/** The `paths` target for `file`: relative to `baseUrl` when the tsconfig sets one, else to its dir. */
export function pathsTarget(tsconfigPath: string, text: string, file: string): string {
  const options = parseJsonc(text)?.['compilerOptions'] as Record<string, unknown> | undefined
  const baseUrl = options?.['baseUrl']
  const dir = dirname(tsconfigPath)
  const from =
    typeof baseUrl === 'string' ? (isAbsolute(baseUrl) ? baseUrl : resolve(dir, baseUrl)) : dir
  const rel = relative(from, file).replaceAll('\\', '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

export const pathsLine = (key: string, target: string): string =>
  `${JSON.stringify(key)}: [${JSON.stringify(target)}]`

export type PathsEdit = { text: string } | { error: string }

type Doc = Record<string, unknown>
const pathsOf = (doc: Doc): Doc =>
  ((doc['compilerOptions'] as Doc | undefined)?.['paths'] ?? {}) as Doc

/** Whether the edit landed: every other key unchanged, and `key` mapping to `[target]` or absent. */
function verify(before: string, after: string, key: string, target: string | null): boolean {
  const a = parseJsonc(before)
  const b = parseJsonc(after)
  if (a === null || b === null) return false
  const strip = (doc: Record<string, unknown>): string => {
    const options = { ...(doc['compilerOptions'] as Record<string, unknown> | undefined) }
    const paths = { ...pathsOf(doc) }
    delete paths[key]
    if (Object.keys(paths).length > 0) options['paths'] = paths
    else delete options['paths']
    return JSON.stringify({ ...doc, compilerOptions: options })
  }
  const landed =
    target === null
      ? !(key in pathsOf(b))
      : JSON.stringify(pathsOf(b)[key]) === JSON.stringify([target])
  return landed && strip(a) === strip(b)
}

export function addPathsRow(text: string, key: string, target: string): PathsEdit {
  const line = pathsLine(key, target)
  const refuse = (why: string): PathsEdit => ({
    error: `${why}; add this line under compilerOptions.paths yourself: ${line}`,
  })
  let root: Value
  try {
    root = parse(text)
  } catch {
    return refuse('the tsconfig does not parse as JSONC')
  }
  const options = member(root, 'compilerOptions')?.value
  if (options?.kind !== 'object') return refuse('the tsconfig has no compilerOptions object')
  const paths = member(options, 'paths')?.value
  let next: string
  if (paths !== undefined) {
    if (paths.kind !== 'object') return refuse('compilerOptions.paths is not an object')
    if (member(paths, key) !== undefined) return refuse(`compilerOptions.paths already maps ${key}`)
    const first = paths.members[0]
    const at = paths.start + 1
    if (first === undefined) {
      next = `${text.slice(0, at)}${line}${text.slice(at)}`
    } else {
      const sameLine = !text.slice(at, first.keyStart).includes('\n')
      const indent = sameLine
        ? `${lineIndent(text, paths.start)}  `
        : lineIndent(text, first.keyStart)
      next = `${text.slice(0, at)}\n${indent}${line},${text.slice(at)}`
    }
  } else {
    if (member(root, 'extends') !== undefined) {
      return refuse(
        'the tsconfig extends another and sets no paths, so a new paths object would drop the inherited ones',
      )
    }
    const first = options.members[0]
    if (first === undefined) return refuse('compilerOptions is empty')
    const indent = lineIndent(text, first.keyStart)
    const inner = `${indent}${indent.startsWith('\t') ? '\t' : '  '}`
    const at = options.start + 1
    next = `${text.slice(0, at)}\n${indent}"paths": {\n${inner}${line}\n${indent}},${text.slice(at)}`
  }
  return verify(text, next, key, target) ? { text: next } : refuse('the edit did not verify')
}

/** Cuts a member and its separator: its own line when it has one, else the adjacent comma. */
function cut(text: string, owner: Value & { kind: 'object' }, index: number): string {
  const target = owner.members[index] as Member
  let start = target.keyStart
  let end = target.value.end
  const after = /^[ \t]*,/.exec(text.slice(end))
  if (after !== null) end += after[0].length
  else if (index > 0) {
    const before = /,[ \t\r\n]*$/.exec(text.slice(0, start))
    if (before !== null) start -= before[0].length
  }
  const lineStart = text.lastIndexOf('\n', start - 1)
  if (after !== null && lineStart !== -1 && /^[ \t]*$/.test(text.slice(lineStart + 1, start))) {
    start = lineStart
  }
  return text.slice(0, start) + text.slice(end)
}

/** The tsconfig with the `key` row gone (and the `paths` object eject created, once empty). */
export function removePathsRow(text: string, key: string): PathsEdit {
  let root: Value
  try {
    root = parse(text)
  } catch {
    return { error: `the tsconfig does not parse as JSONC; remove the ${key} paths row yourself` }
  }
  const options = member(root, 'compilerOptions')?.value
  const paths = member(options, 'paths')?.value
  if (options?.kind !== 'object' || paths?.kind !== 'object') return { text }
  const index = paths.members.findIndex((m) => m.key === key)
  if (index === -1) return { text }
  let next = cut(text, paths, index)
  const reparsed = parse(next)
  const reOptions = member(reparsed, 'compilerOptions')?.value
  const rePaths = member(reOptions, 'paths')?.value
  // An emptied multi-line `paths` is the one eject created; an inline `{}` was the consumer's.
  if (
    reOptions?.kind === 'object' &&
    rePaths?.kind === 'object' &&
    rePaths.members.length === 0 &&
    /^\{\s*\n\s*\}$/.test(next.slice(rePaths.start, rePaths.end))
  ) {
    next = cut(
      next,
      reOptions,
      reOptions.members.findIndex((m) => m.key === 'paths'),
    )
  }
  return verify(text, next, key, null)
    ? { text: next }
    : { error: `removing the ${key} paths row did not verify; remove it yourself` }
}
