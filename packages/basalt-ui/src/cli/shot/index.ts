/**
 * `basalt-ui shot <route…> (--base <url> | --dist <dir>) [--out <dir>] [--states <list>]` — render
 * routes in a real browser and write `board.html`, `metrics.json` and `png/*` for a design round.
 */
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'

import { buildBoard } from './board'
import { capture } from './capture'
import { INSTALL_LINE, ShotError, resolvePlaywright, withBrowser } from './playwright'
import type { Playwright, PlaywrightResolver } from './playwright'
import { serveDist } from './serve'
import { SCHEMES, STATES, VIEWPORTS } from './types'
import type { ShotMetrics, ShotState } from './types'

const DEFAULT_OUT = '.basalt/shots'
const USAGE_LINE =
  'usage: basalt-ui shot <route…> (--base <url> | --dist <dir>) [--out <dir>] [--states <list>]'

export type ShotDeps = {
  resolve?: PlaywrightResolver
  /** Replaces the browser run (tests): returns what `capture` would. */
  capture?: typeof capture
  now?: () => Date
  log?: (line: string) => void
}

export type ShotArgs = {
  routes: string[]
  base?: string
  dist?: string
  out: string
  states: ShotState[]
}

/** Parses argv; throws `ShotError` with the one-line reason. */
export function parseShotArgs(flags: readonly string[]): ShotArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: [...flags],
      allowPositionals: true,
      options: {
        base: { type: 'string' },
        dist: { type: 'string' },
        out: { type: 'string' },
        states: { type: 'string' },
      },
    })
  } catch (error) {
    throw new ShotError(`${error instanceof Error ? error.message : String(error)}\n${USAGE_LINE}`)
  }
  const { values, positionals } = parsed
  if (positionals.length === 0) throw new ShotError(`no route given.\n${USAGE_LINE}`)
  const bad = positionals.find((r) => !r.startsWith('/'))
  if (bad) throw new ShotError(`route '${bad}' must start with '/'.\n${USAGE_LINE}`)
  if (Boolean(values.base) === Boolean(values.dist)) {
    throw new ShotError(`pass exactly one of --base <url> or --dist <dir>.\n${USAGE_LINE}`)
  }
  const states = values.states
    ? values.states
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...STATES]
  const unknown = states.find((s) => !(STATES as readonly string[]).includes(s))
  if (unknown) throw new ShotError(`unknown state '${unknown}'. Known: ${STATES.join(', ')}`)
  return {
    routes: positionals,
    ...(values.base ? { base: values.base.replace(/\/+$/, '') } : {}),
    ...(values.dist ? { dist: values.dist } : {}),
    out: values.out ?? DEFAULT_OUT,
    states: STATES.filter((s) => states.includes(s)),
  }
}

const PROTECTED_SEGMENTS = new Set(['.git', 'node_modules'])
/** Files a shot writes beside its output: a dir holding only these counts as empty. */
const OWN_FILES = new Set(['.gitignore', 'last.json'])

const outside = (rel: string): boolean =>
  rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)

const lexists = (path: string): boolean => {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

const isPreviousShot = (dir: string): boolean => {
  try {
    return (
      (JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8')) as { version?: unknown })
        .version === 1
    )
  } catch {
    return false
  }
}

/**
 * Validates `out` WITHOUT touching it and returns its absolute path. A shot only ever empties what
 * it wrote: the dir must be absent, empty, or hold a previous run's `metrics.json` (`version: 1`).
 */
export function planOut(cwd: string, out: string): string {
  const dir = resolve(cwd, out)
  const rel = relative(cwd, dir)
  const refuse = (why: string): never => {
    throw new ShotError(`--out ${out} ${why}`)
  }
  if (rel === '' || outside(rel)) refuse('must be a directory inside the project')
  if (rel === '.basalt' || rel.split(sep).some((part) => PROTECTED_SEGMENTS.has(part))) {
    refuse('is (or sits inside) a protected directory (.git, node_modules, .basalt)')
  }
  let probe = dir
  while (!lexists(probe)) probe = dirname(probe)
  if (probe === dir && lstatSync(dir).isSymbolicLink())
    refuse('is a symlink; refusing to follow it')
  if (outside(relative(realpathSync(cwd), realpathSync(probe))))
    refuse('resolves outside the project')
  if (probe === dir) {
    if (!statSync(dir).isDirectory()) refuse('exists and is not a directory')
    const entries = readdirSync(dir)
    if (!entries.every((e) => OWN_FILES.has(e)) && !isPreviousShot(dir)) {
      refuse(
        'exists and is not a previous shot output (no metrics.json with version 1); refusing to empty it',
      )
    }
  }
  return dir
}

/** Swaps the finished `tmp` render in for `outDir` (re-validated), then records `last.json` last. */
export function commitOut(
  cwd: string,
  out: string,
  tmp: string,
  routes: readonly string[],
  now: Date,
): void {
  const dir = planOut(cwd, out)
  rmSync(dir, { recursive: true, force: true })
  renameSync(tmp, dir)
  const home = join(cwd, '.basalt', 'shots')
  mkdirSync(home, { recursive: true })
  writeFileSync(join(home, '.gitignore'), '*\n')
  const rel = relative(cwd, dir).split(sep).join('/')
  writeFileSync(
    join(home, 'last.json'),
    JSON.stringify({ version: 1, at: now.toISOString(), out: rel, routes }, null, 2) + '\n',
  )
}

/** One handler for SIGINT/SIGTERM: runs every stop (browser kill, server stop, temp cleanup), then exits. */
function exitOnSignal(stops: readonly (() => unknown)[]): () => void {
  const exitWith = (code: number) => (): void => {
    void Promise.allSettled(stops.map((stop) => stop())).finally(() => process.exit(code))
  }
  const [onInt, onTerm] = [exitWith(130), exitWith(143)]
  // The Bun/Node typings disagree on the signal overloads; the events are plain EventEmitter ones.
  const events: NodeJS.EventEmitter = process
  events.once('SIGINT', onInt)
  events.once('SIGTERM', onTerm)
  return () => {
    events.removeListener('SIGINT', onInt)
    events.removeListener('SIGTERM', onTerm)
  }
}

export async function shot(
  flags: readonly string[],
  cwd: string,
  deps: ShotDeps = {},
): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line))
  const stops: (() => unknown)[] = []
  const uninstall = exitOnSignal(stops)
  try {
    const args = parseShotArgs(flags)
    const outDir = planOut(cwd, args.out)
    const pw: Playwright | null = (deps.resolve ?? resolvePlaywright)(cwd)
    if (!pw) throw new ShotError(INSTALL_LINE)
    const now = (deps.now ?? (() => new Date()))()
    const server = args.dist ? serveDist(resolve(cwd, args.dist)) : null
    if (server) stops.push(server.stop)
    const tmp = `${outDir}.tmp-${process.pid}`
    stops.push(() => rmSync(tmp, { recursive: true, force: true }))
    const base = server?.origin ?? args.base ?? ''
    try {
      // The browser is up BEFORE the out dir is touched: a failed launch leaves the last board intact.
      const { anchors, shots, scale } = await withBrowser(
        pw,
        (browser) => {
          mkdirSync(join(tmp, 'png'), { recursive: true })
          writeFileSync(join(tmp, '.gitignore'), '*\n')
          return (deps.capture ?? capture)({
            browser,
            base,
            routes: args.routes,
            states: args.states,
            pngDir: join(tmp, 'png'),
            log,
          })
        },
        { stops },
      )
      const metrics: ShotMetrics = {
        version: 1,
        generatedAt: now.toISOString(),
        base,
        routes: args.routes,
        viewports: [...VIEWPORTS],
        schemes: [...SCHEMES],
        states: args.states,
        scale,
        anchors,
        shots,
      }
      writeFileSync(join(tmp, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n')
      writeFileSync(join(tmp, 'board.html'), buildBoard(metrics))
      commitOut(cwd, args.out, tmp, args.routes, now)
      const count = (status: string): number => shots.filter((s) => s.status === status).length
      log(
        `[shot] ${count('ok')} shots, ${count('not-declared')} not declared, ${count('skipped')} skipped, ${count('error')} failed → ${relative(cwd, outDir)}/board.html`,
      )
      if (count('error') > 0) {
        console.error(`basalt-ui shot: ${count('error')} shot(s) failed; see board.html`)
        return 1
      }
      return count('ok') === 0 ? 1 : 0
    } finally {
      rmSync(tmp, { recursive: true, force: true })
      server?.stop()
    }
  } catch (error) {
    if (!(error instanceof ShotError)) throw error
    console.error(error.message)
    return 1
  } finally {
    uninstall()
  }
}

export { openContext } from './capture'
export { INSTALL_LINE, resolvePlaywright, withBrowser } from './playwright'
export { serveDist } from './serve'
export { VIEWPORT_SPECS } from './types'
