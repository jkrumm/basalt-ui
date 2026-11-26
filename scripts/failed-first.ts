#!/usr/bin/env bun
/**
 * A step that failed is proven fixed before the rest of it runs again. The unit suite does this for its processes
 * (scripts/unit-order.ts); this does it for the two browser steps a lead reruns after every red one: `make layout-fast`
 * (the files of the failed tests run first) and `make quality-matrix-fast` (the failed routes run alone, before the rest).
 * A slot minute spent on a run that fails is lost, and a fix that is not whole fails again at the same late test: this
 * moves that test to the front, so the second red costs seconds, not the minutes the first one took to reach it.
 *
 * The order is the only thing it changes: every file and route still runs in the same run, and a green run clears the
 * memory. The memory is node_modules/.cache/failed-<name>.json of this checkout. It fails open: an unreadable memory
 * is none, and a run that printed no failure leaves none.
 *
 * Usage:
 *   bun scripts/failed-first.ts order <name> <item...>        every item, the remembered ones first (space separated)
 *   bun scripts/failed-first.ts first <name> <a,b,c>          the remembered items of a comma list (comma list)
 *   bun scripts/failed-first.ts rest <name> <a,b,c>           the others of a comma list (comma list)
 *   bun scripts/failed-first.ts run <name> <file|route> -- <cmd...>
 *       runs the command with its output passed through; on exit 0 forgets, on a failure remembers what `bun test` printed
 *       as failed: the files (`<file>:` header, then `(fail)`) or the matrix routes (`(fail) <route> <w> x <h> ...`)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { parseFailedFiles } from './unit-order'

export type Kind = 'file' | 'route'

// eslint-disable-next-line no-control-regex -- bun colors its output on a terminal
const ANSI = /\u001b\[[0-9;]*m/g
const HEADER = /^(\S+\.(?:test|spec)\.[cm]?[jt]sx?):\s*$/
const ROUTE = /(?:^|> )(\/\S*) \d+ x \d+/

/** What a `bun test` output says failed: the files (the header printed before a failing test), or the matrix routes. */
export function parseFailures(output: string, kind: Kind): string[] {
  const failed = new Set<string>()
  let current: string | null = null
  for (const raw of output.split('\n')) {
    const line = raw.replace(ANSI, '').trimEnd()
    const header = HEADER.exec(line)
    if (header) {
      current = header[1] ?? null
      continue
    }
    if (!line.startsWith('(fail) ')) continue
    if (kind === 'file') {
      if (current !== null) failed.add(current)
      continue
    }
    const route = ROUTE.exec(line.slice('(fail) '.length))
    if (route?.[1]) failed.add(route[1])
  }
  return [...failed]
}

const norm = (item: string): string => item.replace(/^\.\//, '')

/** The items in `failed` first, then the others, each part in its own order. */
export function failedItemsFirst(items: readonly string[], failed: ReadonlySet<string>): string[] {
  const hit = (item: string): boolean => failed.has(norm(item))
  return [...items.filter(hit), ...items.filter((item) => !hit(item))]
}

const memoryFile = (name: string): string => `node_modules/.cache/failed-${name}.json`

function recall(name: string): Set<string> {
  const file = memoryFile(name)
  return parseFailedFiles(existsSync(file) ? readFileSync(file, 'utf8') : '')
}

function remember(name: string, items: readonly string[]): void {
  if (items.length === 0) {
    rmSync(memoryFile(name), { force: true })
    return
  }
  mkdirSync('node_modules/.cache', { recursive: true })
  writeFileSync(memoryFile(name), JSON.stringify(items))
}

/** Runs the command, passes its output through and returns its exit code and everything it printed. */
async function tee(cmd: string[]): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(cmd, { stdin: 'inherit', stdout: 'pipe', stderr: 'pipe' })
  let output = ''
  const pump = async (
    stream: ReadableStream<Uint8Array>,
    sink: NodeJS.WriteStream,
  ): Promise<void> => {
    const decoder = new TextDecoder()
    for await (const chunk of stream) {
      sink.write(chunk)
      output += decoder.decode(chunk, { stream: true })
    }
  }
  await Promise.all([pump(proc.stdout, process.stdout), pump(proc.stderr, process.stderr)])
  return { code: await proc.exited, output }
}

function usage(text: string): never {
  process.stderr.write(`usage: failed-first.ts ${text}\n`)
  process.exit(2)
}

if (import.meta.main) {
  process.chdir(new URL('..', import.meta.url).pathname)
  const [verb, name, ...args] = process.argv.slice(2)
  if (!name) usage('order|first|rest|run <name> ...')
  if (verb === 'order') {
    process.stdout.write(`${failedItemsFirst(args, recall(name)).join(' ')}\n`)
  } else if (verb === 'first' || verb === 'rest') {
    const items = (args[0] ?? '').split(',').filter(Boolean)
    const failed = recall(name)
    const hit = items.filter((item) => failed.has(item))
    process.stdout.write(
      `${(verb === 'first' ? hit : items.filter((item) => !failed.has(item))).join(',')}\n`,
    )
  } else if (verb === 'run') {
    const [kind, separator, ...cmd] = args
    if ((kind !== 'file' && kind !== 'route') || separator !== '--' || cmd.length === 0) {
      usage('run <name> <file|route> -- <cmd...>')
    }
    const { code, output } = await tee(cmd)
    remember(name, code === 0 ? [] : parseFailures(output, kind))
    process.exit(code)
  } else {
    usage('order|first|rest|run <name> ...')
  }
}
