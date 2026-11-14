/**
 * `basalt-ui shot <route…> (--base <url> | --dist <dir>) --out <fresh dir> [--states <list>]` —
 * render routes in a real browser at the manifest's viewports and write `board.html`,
 * `metrics.json` and `png/*` for a design round. `basalt-ui shot detect` reads that dir back
 * without a browser (`./detect`).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'

import { readManifest } from '../manifest'
import { buildBoard } from './board'
import { capture } from './capture'
import { detect } from './detect'
import { INSTALL_LINE, ShotError, resolvePlaywright, withBrowser } from './playwright'
import type { Playwright, PlaywrightResolver } from './playwright'
import { apiProxy, parseApi, parseHeaders, parseStorage } from './real-data'
import type { ApiRoute, Pair, Source } from './real-data'
import { serveDist } from './serve'
import { DEFAULT_VIEWPORTS, LAST_SHOT, SCHEMES, STATES, parseViewport } from './types'
import type { ShotMetrics, ShotState, ViewportSpec } from './types'

const USAGE_LINE =
  'usage: basalt-ui shot <route…> (--base <url> | --dist <dir>) --out <fresh dir> [--states <list>] [--local-storage k=@env:X] [--api /p=origin] [--header n=@env:X] [--api-allow-writes] [--wait ms] [--auto-anchors]'

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
  /** The manifest's `viewports` (a desktop-only app declares no phone), else the defaults. */
  viewports: ViewportSpec[]
  /** Resolved secrets: held for the browser only, never written anywhere. */
  localStorage: Pair[]
  api: ApiRoute[]
  headers: Pair[]
  /** Extra settle in ms after networkidle. */
  wait: number
  allowWrites: boolean
  autoAnchors: boolean
}

/** The viewports `.basalt/manifest.json` declares at or above `cwd`; the defaults when it declares none. */
export function manifestViewports(cwd: string): ViewportSpec[] {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const read = readManifest(dir)
    const declared = read && 'manifest' in read ? read.manifest.viewports : []
    if (read || dirname(dir) === dir) {
      const specs = (declared.length ? declared : DEFAULT_VIEWPORTS).map(
        (v) => [v, parseViewport(v)] as const,
      )
      const bad = specs.find(([, spec]) => !spec)
      if (bad) throw new ShotError(`manifest viewport '${bad[0]}' is not <width>x<height>`)
      return specs.map(([, spec]) => spec as ViewportSpec)
    }
  }
}

/** Parses argv; throws `ShotError` with the one-line reason. */
export function parseShotArgs(
  flags: readonly string[],
  src: Source = { env: process.env, cwd: process.cwd() },
): ShotArgs {
  const fail = (why: string): never => {
    throw new ShotError(`${why}\n${USAGE_LINE}`)
  }
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
    return fail(error instanceof Error ? error.message : String(error))
  }
  const { values, positionals } = parsed
  if (values.base) sanitizeBase(values.base)
  if (positionals.length === 0) fail('no route given.')
  const bad = positionals.find((r) => !r.startsWith('/'))
  if (bad) fail(`route '${bad}' must start with '/'.`)
  const spaced = positionals.find((r) => /\s/.test(r))
  if (spaced)
    fail(
      `route '${spaced}' contains whitespace: pass each route as its own argument (zsh does not word-split $ROUTES; use \${=ROUTES} or an array).`,
    )
  if (Boolean(values.base) === Boolean(values.dist))
    fail('pass exactly one of --base <url> or --dist <dir>.')
  const out =
    values.out ??
    fail(
      '--out <dir> is required: every round writes to a fresh directory that does not exist yet.',
    )
  const states = values.states
    ? values.states
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...STATES]
  const unknown = states.find((s) => !(STATES as readonly string[]).includes(s))
  if (unknown) throw new ShotError(`unknown state '${unknown}'. Known: ${STATES.join(', ')}`)
  const headers = values.header?.length ?? 0
  const secrets = headers + (values['local-storage']?.length ?? 0) > 0
  const api = parseApi(values.api ?? [], secrets)
  if (api.length > 0 && !values.dist) fail('--api needs --dist (it proxies the static server).')
  if (headers > 0 && new Set(api.map((r) => r.origin)).size > 1)
    fail('--header goes to every --api origin; it is refused when --api names more than one.')
  if (headers > 0 && api.length === 0) fail('--header is sent on --api requests only; pass --api.')
  const wait = values.wait ?? 'networkidle'
  if (wait !== 'networkidle' && !/^\d+$/.test(wait))
    fail("--wait takes milliseconds or 'networkidle'.")
  return {
    routes: positionals,
    viewports: manifestViewports(src.cwd),
    localStorage: parseStorage(values['local-storage'] ?? [], src),
    api,
    headers: parseHeaders(values.header ?? [], src),
    wait: wait === 'networkidle' ? 0 : Number(wait),
    allowWrites: values['api-allow-writes'] ?? false,
    autoAnchors: values['auto-anchors'] ?? false,
    ...(values.base ? { base: values.base.replace(/\/+$/, '') } : {}),
    ...(values.dist ? { dist: values.dist } : {}),
    out,
    states: STATES.filter((s) => states.includes(s)),
  }
}

/** Validates `out` WITHOUT touching it and returns its absolute path: inside the project, outside `.git`/`node_modules`, and not there yet. */
export function planOut(cwd: string, out: string): string {
  const dir = resolve(cwd, out)
  const rel = relative(cwd, dir)
  const refuse = (why: string): never => {
    throw new ShotError(`--out ${out} ${why}`)
  }
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || resolve(rel) === rel)
    refuse(`must be a directory inside the project (${cwd}; in a monorepo, the app dir)`)
  if (rel.split(sep).some((part) => part === '.git' || part === 'node_modules'))
    refuse('is (or sits inside) a protected directory (.git, node_modules)')
  if (existsSync(dir))
    refuse('exists already: every round writes to a fresh directory (shots-2, shots-3, …)')
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

/** `.basalt/last-shot.json`: the out dir of the latest round and its number, which the reviewer and `detect` read. */
function writeLast(cwd: string, out: string): void {
  const file = join(cwd, LAST_SHOT)
  let round = 1
  try {
    round += Number((JSON.parse(readFileSync(file, 'utf8')) as { round?: unknown }).round) || 0
  } catch {
    // No round recorded yet: this is the first.
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ out, round }, null, 2) + '\n')
}

/** One handler for SIGINT/SIGTERM: runs every stop (browser kill, server stop), then exits. */
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
  let server: ReturnType<typeof serveDist> | null = null
  try {
    const args = parseShotArgs(flags, { env: process.env, cwd })
    const outDir = planOut(cwd, args.out)
    const pw: Playwright | null = (deps.resolve ?? resolvePlaywright)(cwd)
    if (!pw) throw new ShotError(INSTALL_LINE)
    const now = (deps.now ?? (() => new Date()))()
    const proxy =
      args.api.length > 0
        ? apiProxy(args.api, args.headers, { log, allowWrites: args.allowWrites })
        : null
    server = args.dist ? serveDist(resolve(cwd, args.dist), proxy?.handle) : null
    if (server) stops.push(server.stop)
    const base = server?.origin ?? args.base ?? ''
    // The browser is up BEFORE the out dir exists: a failed launch leaves nothing behind.
    const result = await withBrowser(
      pw,
      (browser) => {
        mkdirSync(join(outDir, 'png'), { recursive: true })
        writeFileSync(join(outDir, '.gitignore'), '*\n')
        return (deps.capture ?? capture)({
          browser,
          base,
          routes: args.routes,
          viewports: args.viewports,
          states: args.states,
          pngDir: join(outDir, 'png'),
          localStorage: args.localStorage,
          wait: args.wait,
          autoAnchors: args.autoAnchors,
          ...(proxy && { apiProblems: proxy.drain }),
          log,
        })
      },
      { stops },
    ).catch((error: unknown) => {
      rmSync(outDir, { recursive: true, force: true })
      throw error
    })
    const metrics: ShotMetrics = {
      version: 1,
      generatedAt: now.toISOString(),
      base: sanitizeBase(base),
      routes: args.routes,
      viewports: args.viewports.map((v) => v.label),
      schemes: [...SCHEMES],
      states: args.states,
      ...result,
    }
    writeFileSync(join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n')
    writeFileSync(join(outDir, 'board.html'), buildBoard(metrics))
    writeLast(cwd, relative(cwd, outDir).split(sep).join('/'))
    const count = (status: string): number => result.shots.filter((s) => s.status === status).length
    const absent = count('absent') ? `${count('absent')} absent, ` : ''
    log(
      `[shot] ${count('ok')} shots, ${count('not-declared')} not declared, ${absent}${count('skipped')} skipped, ${count('error')} failed → ${relative(cwd, outDir)}/board.html`,
    )
    if (count('error') > 0) {
      console.error(`basalt-ui shot: ${count('error')} shot(s) failed; see board.html`)
      return 1
    }
    return count('ok') === 0 ? 1 : 0
  } catch (error) {
    if (!(error instanceof ShotError)) throw error
    console.error(error.message)
    return 1
  } finally {
    server?.stop()
    uninstall()
  }
}

export { openContext } from './capture'
export { withBrowser } from './playwright'
export { serveDist } from './serve'
export { VIEWPORT_SPECS } from './types'
