/**
 * `basalt-ui shot <route…> (--base <url> | --dist <dir>) [--out <dir>] [--states <list>]` — render
 * routes in a real browser and write `board.html`, `metrics.json` and `png/*` for a design round.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
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

/** Empties `out`, drops a `*` .gitignore when it lives under `.basalt/`, and records `last.json`. */
export function prepareOut(cwd: string, out: string, routes: readonly string[], now: Date): string {
  const dir = resolve(cwd, out)
  const rel = relative(cwd, dir)
  if (dir === cwd || rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new ShotError(`--out ${out} must be a directory inside the project (it is emptied first)`)
  }
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'png'), { recursive: true })
  const home = join(cwd, '.basalt', 'shots')
  mkdirSync(home, { recursive: true })
  writeFileSync(join(home, '.gitignore'), '*\n')
  if (rel.split(/[\\/]/)[0] === '.basalt') writeFileSync(join(dir, '.gitignore'), '*\n')
  writeFileSync(
    join(home, 'last.json'),
    JSON.stringify(
      { version: 1, at: now.toISOString(), out: rel.split('\\').join('/'), routes },
      null,
      2,
    ) + '\n',
  )
  return dir
}

export async function shot(
  flags: readonly string[],
  cwd: string,
  deps: ShotDeps = {},
): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line))
  try {
    const args = parseShotArgs(flags)
    const pw: Playwright | null = (deps.resolve ?? resolvePlaywright)(cwd)
    if (!pw) throw new ShotError(INSTALL_LINE)
    const now = (deps.now ?? (() => new Date()))()
    const outDir = prepareOut(cwd, args.out, args.routes, now)
    const server = args.dist ? serveDist(resolve(cwd, args.dist)) : null
    const base = server?.origin ?? args.base ?? ''
    try {
      const run = deps.capture ?? capture
      const { anchors, shots } = await withBrowser(pw, (browser) =>
        run({
          browser,
          base,
          routes: args.routes,
          states: args.states,
          pngDir: join(outDir, 'png'),
          log,
        }),
      )
      const metrics: ShotMetrics = {
        version: 1,
        generatedAt: now.toISOString(),
        base,
        routes: args.routes,
        viewports: [...VIEWPORTS],
        schemes: [...SCHEMES],
        states: args.states,
        anchors,
        shots,
      }
      writeFileSync(join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n')
      writeFileSync(join(outDir, 'board.html'), buildBoard(metrics))
      const ok = shots.filter((s) => s.status === 'ok').length
      const failed = shots.filter((s) => s.status === 'error').length
      log(
        `[shot] ${ok} shots, ${shots.length - ok - failed} not declared, ${failed} failed → ${relative(cwd, outDir)}/board.html`,
      )
      return ok === 0 ? 1 : 0
    } finally {
      server?.stop()
    }
  } catch (error) {
    if (!(error instanceof ShotError)) throw error
    console.error(error.message)
    return 1
  }
}
