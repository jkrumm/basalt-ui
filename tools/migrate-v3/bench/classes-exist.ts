// `classes-exist`: every class the codemod emitted exists in the app's built CSS. A class the theme lacks
// compiles to nothing and fails silently (a dead `text-xl` was 4 of the 128 silently wrong elements), so
// this is the check that turns it into an error.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { sourceFiles } from '../layout/index.ts'

/** The text between a bracket pair opened at `from`, quotes respected. */
function balanced(source: string, from: number, open: string, close: string): string {
  let depth = 1
  let i = from
  while (i < source.length && depth > 0) {
    const c = source[i]!
    if (c === '"' || c === "'" || c === '`') {
      const end = source.indexOf(c, i + 1)
      if (end < 0) break
      i = end
    } else if (c === open) depth++
    else if (c === close) depth--
    i++
  }
  return source.slice(from, i)
}

/** Tailwind markers other classes key on (`group-hover:`); they have no rule of their own. */
const MARKER = /^(?:group|peer)(?:\/[\w-]+)?$/

/**
 * Class tokens in static `className="..."` and in every string literal of a `className={...}` expression
 * or a `cn(...)`/`clsx(...)` call, so a ternary the codemod emits is read as well.
 */
export function emittedClasses(source: string): Set<string> {
  const out = new Set<string>()
  const add = (literal: string) => {
    for (const token of literal.split(/\s+/)) if (token && !MARKER.test(token)) out.add(token)
  }
  for (const m of source.matchAll(/\bclassName=(?:"([^"]*)"|'([^']*)')/g)) add(m[1] ?? m[2] ?? '')
  for (const call of source.matchAll(/\bclassName=\{|\b(?:cn|clsx)\(/g)) {
    const close = call[0].endsWith('{') ? '}' : ')'
    const open = call[0].endsWith('{') ? '{' : '('
    const body = balanced(source, call.index + call[0].length, open, close)
    for (const lit of body.matchAll(/"([^"]*)"|'([^']*)'|`([^`$]*)`/g))
      add(lit[1] ?? lit[2] ?? lit[3] ?? '')
  }
  return out
}

/** Every class selector in a stylesheet, CSS escapes undone (`.md\:flex` is `md:flex`). */
export function definedClasses(css: string): Set<string> {
  const out = new Set<string>()
  for (const m of css.matchAll(/\.(?!\d)((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g)) {
    out.add(
      m[1]!
        .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) =>
          String.fromCodePoint(Number.parseInt(hex, 16)),
        )
        .replace(/\\(.)/g, '$1'),
    )
  }
  return out
}

export function missingClasses(source: string, css: string): string[] {
  const defined = definedClasses(css)
  return [...emittedClasses(source)].filter((c) => !defined.has(c)).toSorted()
}

function cssFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path]
  return [...new Bun.Glob('**/*.css').scanSync({ cwd: path, onlyFiles: true })].map((f) =>
    join(path, f),
  )
}

/** Class text of the lines a diff adds: the classes of this migration, not the app's older ones. */
function addedSource(dir: string, since: string): string {
  const r = Bun.spawnSync(['git', '-C', dir, 'diff', since, '-U0', '--', '*.tsx', '*.jsx'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (r.exitCode !== 0) throw new Error(`git diff ${since} failed: ${r.stderr.toString()}`)
  return r.stdout
    .toString()
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1))
    .join('\n')
}

export function classesExistCommand(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { css: { type: 'string', multiple: true }, since: { type: 'string' } },
  })
  const dir = positionals[0] ? resolve(positionals[0]) : undefined
  if (!dir || !values.css?.length) {
    console.error(
      'usage: run.ts classes-exist <app-dir> --css <built css file or dir>... [--since <git-ref>]',
    )
    return 2
  }
  const sheets = values.css.map((p) => resolve(p))
  const absent = sheets.find((p) => !existsSync(p))
  if (absent) {
    console.error(`classes-exist: ${absent} does not exist; build the app first`)
    return 2
  }
  const css = sheets
    .flatMap(cssFiles)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const source = values.since
    ? addedSource(dir, values.since)
    : sourceFiles(dir)
        .map((f) => readFileSync(join(dir, f), 'utf8'))
        .join('\n')
  const missing = missingClasses(source, css)
  for (const c of missing) console.error(`  missing from the built CSS: ${c}`)
  console.log(`classes-exist: ${emittedClasses(source).size} classes, ${missing.length} missing`)
  return missing.length === 0 ? 0 : 1
}
