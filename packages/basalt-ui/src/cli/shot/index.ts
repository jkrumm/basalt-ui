/**
 * `basalt-ui shot <route…> (--base <url> | --dist <dir>) [--out <dir>] [--states <list>]` — render
 * routes in a real browser and write `board.html`, `metrics.json` and `png/*` for a design round.
 * `basalt-ui shot detect` reads that out dir back without a browser (`./detect`).
 */
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
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
import { detect } from './detect'
import { INSTALL_LINE, ShotError, resolvePlaywright, withBrowser } from './playwright'
import type { Playwright, PlaywrightResolver } from './playwright'
import { apiProxy, parseApi, parseHeaders, parseStorage } from './real-data'
import type { ApiRoute, Pair, Source } from './real-data'
import { serveDist } from './serve'
import { SCHEMES, SHOT_HOME, STATES, VIEWPORTS } from './types'
import type { ShotMetrics, ShotState } from './types'

const HOME = SHOT_HOME
/** A run dir under the home, so `last.json` and a named run's dir never share the default out. */
const DEFAULT_OUT = `${HOME}/latest`
const USAGE_LINE =
  'usage: basalt-ui shot <route…> (--base <url> | --dist <dir>) [--out <dir>] [--states <list>] [--local-storage k=@env:X] [--api /p=origin] [--header n=@env:X] [--api-allow-writes] [--wait ms] [--auto-anchors]'

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
  /** Resolved secrets: held for the browser only, never written anywhere. */
  localStorage: Pair[]
  api: ApiRoute[]
  headers: Pair[]
  /** Extra settle in ms after networkidle. */
  wait: number
  allowWrites: boolean
  autoAnchors: boolean
}

/** Parses argv; throws `ShotError` with the one-line reason. */
export function parseShotArgs(
  flags: readonly string[],
  src: Source = { env: process.env, cwd: process.cwd() },
): ShotArgs {
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
        'local-storage': { type: 'string', multiple: true },
        api: { type: 'string', multiple: true },
        header: { type: 'string', multiple: true },
        wait: { type: 'string' },
        'auto-anchors': { type: 'boolean' },
        'api-allow-writes': { type: 'boolean' },
      },
    })
  } catch (error) {
    throw new ShotError(`${error instanceof Error ? error.message : String(error)}\n${USAGE_LINE}`)
  }
  const { values, positionals } = parsed
  if (values.base) sanitizeBase(values.base)
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
  const secrets = (values.header?.length ?? 0) + (values['local-storage']?.length ?? 0) > 0
  const api = parseApi(values.api ?? [], secrets)
  if (api.length > 0 && !values.dist)
    throw new ShotError(`--api needs --dist (it proxies the static server).\n${USAGE_LINE}`)
  if ((values.header?.length ?? 0) > 0 && new Set(api.map((r) => r.origin)).size > 1)
    throw new ShotError(
      `--header goes to every --api origin; it is refused when --api names more than one.\n${USAGE_LINE}`,
    )
  if ((values.header?.length ?? 0) > 0 && api.length === 0)
    throw new ShotError(`--header is sent on --api requests only; pass --api.\n${USAGE_LINE}`)
  const wait = values.wait ?? 'networkidle'
  if (wait !== 'networkidle' && !/^\d+$/.test(wait))
    throw new ShotError(`--wait takes milliseconds or 'networkidle'.\n${USAGE_LINE}`)
  return {
    routes: positionals,
    localStorage: parseStorage(values['local-storage'] ?? [], src),
    api,
    headers: parseHeaders(values.header ?? [], src),
    wait: wait === 'networkidle' ? 0 : Number(wait),
    allowWrites: values['api-allow-writes'] ?? false,
    autoAnchors: values['auto-anchors'] ?? false,
    ...(values.base ? { base: values.base.replace(/\/+$/, '') } : {}),
    ...(values.dist ? { dist: values.dist } : {}),
    out: values.out ?? DEFAULT_OUT,
    states: STATES.filter((s) => states.includes(s)),
  }
}

const PROTECTED_SEGMENTS = new Set(['.git', 'node_modules'])
/** What a shot writes into its out dir: only a dir made of these is ever emptied. */
const SHOT_OWNED = new Set(['png', 'board.html', 'metrics.json', 'detect.json', '.gitignore'])

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

/** A previous render: `metrics.json` (`version: 1`) and nothing but shot-owned entries. */
const isPreviousShot = (dir: string): boolean => {
  try {
    const marker = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8')) as {
      version?: unknown
    }
    const png = join(dir, 'png')
    return (
      marker.version === 1 &&
      readdirSync(dir).every((e) => SHOT_OWNED.has(e)) &&
      (!lexists(png) || (lstatSync(png).isDirectory() && !lstatSync(png).isSymbolicLink()))
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
  if (relative(join(cwd, HOME), dir) === '')
    refuse('is the shot home (holds last.json); use a subdirectory')
  if (rel === '.basalt' || rel.split(sep).some((part) => PROTECTED_SEGMENTS.has(part))) {
    refuse('is (or sits inside) a protected directory (.git, node_modules, .basalt)')
  }
  let probe = dir
  while (!lexists(probe)) probe = dirname(probe)
  if (probe === dir && lstatSync(dir).isSymbolicLink())
    refuse('is a symlink; refusing to follow it')
  let real = ''
  try {
    real = realpathSync(probe)
  } catch {
    refuse('sits behind a dangling symlink')
  }
  if (outside(relative(realpathSync(cwd), real))) refuse('resolves outside the project')
  if (probe === dir) {
    if (!statSync(dir).isDirectory()) refuse('exists and is not a directory')
    if (readdirSync(dir).length > 0 && !isPreviousShot(dir)) {
      refuse(
        'exists and is not purely a previous shot output (metrics.json version 1 plus png/, board.html, .gitignore); refusing to empty it',
      )
    }
  }
  return dir
}

/** `--base` as recorded: origin and path only, never credentials, query or fragment. */
export function sanitizeBase(base: string): string {
  try {
    const url = new URL(base)
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  } catch {
    throw new ShotError(`--base ${base} is not a URL`)
  }
}

const STALE_TMP_MS = 60 * 60 * 1000

/** A pid is alive when signal 0 reaches it (EPERM: it exists, we just may not signal it). */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Removes `<home>/tmp-<pid>-*` render dirs a killed run left behind: older than an hour AND owned
 * by a pid that is gone (a name without a pid, from an older run, goes by age alone). Never follows
 * a symlink, and an entry that vanishes, dangles or is a plain file is skipped, never fatal.
 */
export function sweepStaleTmp(
  home: string,
  now: Date,
  alive: (pid: number) => boolean = pidAlive,
): void {
  let entries: string[]
  try {
    entries = readdirSync(home)
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.startsWith('tmp-')) continue
    const path = join(home, entry)
    try {
      const stat = lstatSync(path)
      if (!stat.isDirectory() || now.getTime() - stat.mtimeMs <= STALE_TMP_MS) continue
      const pid = /^tmp-(\d+)-/.exec(entry)?.[1]
      if (pid !== undefined && alive(Number(pid))) continue
      rmSync(path, { recursive: true, force: true })
    } catch {
      // Gone already, or not ours to remove: the next run tries again.
    }
  }
}

/** An out dir moved aside while a swap ran. */
const asideOf = (dir: string): string => `${dir}.prev`

/** A swap killed between its two renames leaves `<out>.prev` and no `<out>`: put it back. */
export function recoverOut(dir: string): void {
  if (lexists(asideOf(dir)) && !lexists(dir)) renameSync(asideOf(dir), dir)
}

/**
 * Swaps the finished `tmp` render in for `out` (re-validated): old aside, new in, aside removed —
 * a failure between the renames restores the old render. `last.json` is written last.
 */
export function commitOut(
  cwd: string,
  out: string,
  tmp: string,
  routes: readonly string[],
  now: Date,
): void {
  const dir = planOut(cwd, out)
  const aside = asideOf(dir)
  if (lexists(aside)) {
    if (!isPreviousShot(aside))
      throw new ShotError(`${relative(cwd, aside)} exists and is not a previous shot output`)
    rmSync(aside, { recursive: true, force: true })
  }
  mkdirSync(dirname(dir), { recursive: true })
  const hadOld = lexists(dir)
  if (hadOld) renameSync(dir, aside)
  try {
    renameSync(tmp, dir)
  } catch (error) {
    if (hadOld) renameSync(aside, dir)
    throw error
  }
  if (hadOld) rmSync(aside, { recursive: true, force: true })
  const home = join(cwd, HOME)
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
  if (flags[0] === 'detect') return detect(flags.slice(1), cwd, deps)
  const log = deps.log ?? ((line: string) => console.log(line))
  const stops: (() => unknown)[] = []
  const uninstall = exitOnSignal(stops)
  try {
    const args = parseShotArgs(flags, { env: process.env, cwd })
    const outDir = planOut(cwd, args.out)
    recoverOut(outDir)
    const pw: Playwright | null = (deps.resolve ?? resolvePlaywright)(cwd)
    if (!pw) throw new ShotError(INSTALL_LINE)
    const now = (deps.now ?? (() => new Date()))()
    sweepStaleTmp(join(cwd, HOME), now)
    const proxy =
      args.api.length > 0
        ? apiProxy(args.api, args.headers, { log, allowWrites: args.allowWrites })
        : null
    const server = args.dist ? serveDist(resolve(cwd, args.dist), proxy?.handle) : null
    if (server) stops.push(server.stop)
    let tmp = ''
    stops.push(() => tmp && rmSync(tmp, { recursive: true, force: true }))
    const base = server?.origin ?? args.base ?? ''
    try {
      // The browser is up BEFORE the out dir is touched: a failed launch leaves the last board intact.
      const { anchors, shots, scale, scaleError } = await withBrowser(
        pw,
        (browser) => {
          const home = join(cwd, HOME)
          mkdirSync(home, { recursive: true })
          writeFileSync(join(home, '.gitignore'), '*\n')
          tmp = mkdtempSync(join(home, `tmp-${process.pid}-`))
          mkdirSync(join(tmp, 'png'))
          writeFileSync(join(tmp, '.gitignore'), '*\n')
          return (deps.capture ?? capture)({
            browser,
            base,
            routes: args.routes,
            states: args.states,
            pngDir: join(tmp, 'png'),
            localStorage: args.localStorage,
            wait: args.wait,
            autoAnchors: args.autoAnchors,
            ...(proxy && { apiProblems: proxy.drain }),
            log,
          })
        },
        { stops },
      )
      const metrics: ShotMetrics = {
        version: 1,
        generatedAt: now.toISOString(),
        base: sanitizeBase(base),
        routes: args.routes,
        viewports: [...VIEWPORTS],
        schemes: [...SCHEMES],
        states: args.states,
        scale,
        ...(scaleError ? { scaleError } : {}),
        anchors,
        shots,
      }
      writeFileSync(join(tmp, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n')
      writeFileSync(join(tmp, 'board.html'), buildBoard(metrics))
      commitOut(cwd, args.out, tmp, args.routes, now)
      const count = (status: string): number => shots.filter((s) => s.status === status).length
      const absent = count('absent') ? `${count('absent')} absent, ` : ''
      log(
        `[shot] ${count('ok')} shots, ${count('not-declared')} not declared, ${absent}${count('skipped')} skipped, ${count('error')} failed → ${relative(cwd, outDir)}/board.html`,
      )
      if (count('error') > 0) {
        console.error(`basalt-ui shot: ${count('error')} shot(s) failed; see board.html`)
        return 1
      }
      return count('ok') === 0 ? 1 : 0
    } finally {
      if (tmp) rmSync(tmp, { recursive: true, force: true })
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
