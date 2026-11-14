/**
 * `init --profile tokens|bridge|parts|app [--root <path>]... [--tokens-out <css>]
 * [--tokens-json-out <json>] [--extra <file>] [--accent --neutral --vibrancy --selector]`: the one
 * door into an install (docs/v3/concepts/skills-agent-layer.md 4.1). The profile is declared,
 * never inferred. It declares the manifest, generates the token outputs, installs the profile's
 * peers at exact pins, places the managed files through `sync`, seeds the budget and DESIGN.md and
 * ends in `doctor`, which reports; `init` exits 0 when every step ran, 1 when one could not.
 * Running it twice changes nothing. The steps live in `./steps`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { parseArgs } from 'node:util'

import { doctor } from '../doctor'
import { packageRoot } from '../index'
import { PROFILES } from '../manifest'
import type { Profile } from '../manifest'
import {
  declareManifest,
  generateTokens,
  installPeers,
  installRoot,
  placeManaged,
  seedBudgetFile,
  seedDesign,
  wireApp,
  wireFormatterAndLint,
} from './steps'
import type { Args, Ctx, Runner } from './steps'

export type InitDeps = {
  /** Runs a command in a directory; true on exit 0. Defaults to a real spawn. */
  run?: Runner
  /** Shipped-source root; defaults to this package. */
  pkgRoot?: string
  /** The closing report; defaults to `doctor`. */
  doctor?: (root: string) => Promise<number>
}

/** Longest an install waits. */
const RUN_TIMEOUT_MS = 10 * 60_000

const spawnRun: Runner = (argv, dir) =>
  spawnSync(argv[0] ?? '', argv.slice(1), {
    cwd: dir,
    stdio: 'inherit',
    timeout: RUN_TIMEOUT_MS,
    shell: process.platform === 'win32',
  }).status === 0

const FLAGS = {
  profile: { type: 'string' },
  root: { type: 'string', multiple: true },
  'tokens-out': { type: 'string' },
  'tokens-json-out': { type: 'string' },
  extra: { type: 'string' },
  accent: { type: 'string' },
  neutral: { type: 'string' },
  vibrancy: { type: 'string' },
  selector: { type: 'string' },
  'no-install': { type: 'boolean' },
} as const

/** A path inside the repo: relative, no `..`, no line breaks. */
const isInside = (path: string): boolean =>
  path !== '' &&
  !isAbsolute(path) &&
  !/^[a-zA-Z]:|\n|\r/.test(path) &&
  !path.split(/[\\/]/).includes('..')

const clean = (path: string): string => path.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.'

/** The flags as `Args`, or the first reason they are not a legal call. */
export function parseInit(argv: readonly string[]): { args: Args } | { error: string } {
  let values: ReturnType<typeof parseArgs<{ options: typeof FLAGS }>>['values']
  try {
    values = parseArgs({ args: [...argv], options: FLAGS, strict: true }).values
  } catch (error) {
    return { error: (error as Error).message }
  }
  const profile = values.profile as Profile | undefined
  if (profile === undefined || !PROFILES.includes(profile)) {
    return {
      error:
        profile === undefined
          ? `--profile is required and never inferred: ${PROFILES.join(' | ')}`
          : `--profile must be one of ${PROFILES.join(' | ')} (got '${profile}')`,
    }
  }
  const roots = [...new Set((values.root ?? ['.']).map(clean))]
  const tokensOut = clean(
    values['tokens-out'] ?? `${roots[0] === '.' ? '' : `${roots[0]}/`}tokens.css`,
  )
  const tokensJsonOut =
    values['tokens-json-out'] === undefined ? undefined : clean(values['tokens-json-out'])
  const extra = values.extra === undefined ? undefined : clean(values.extra)
  const paths = [
    ...roots,
    tokensOut,
    ...(tokensJsonOut === undefined ? [] : [tokensJsonOut]),
    ...(extra === undefined ? [] : [extra]),
  ]
  const outside = paths.find((p) => !isInside(p))
  if (outside !== undefined) {
    return { error: `'${outside}' must be a path relative to the repo root, without '..'` }
  }
  const identity = [
    ...(values.accent === undefined ? [] : ['--accent', values.accent]),
    ...(values.neutral === undefined ? [] : ['--neutral', values.neutral]),
    ...(values.vibrancy === undefined ? [] : [`--vibrancy=${values.vibrancy}`]),
    ...(values.selector === undefined ? [] : ['--selector', values.selector]),
  ]
  return {
    args: {
      profile,
      roots,
      tokensOut,
      tokensJsonOut,
      extra,
      identity,
      noInstall: values['no-install'] === true,
    },
  }
}

export async function init(
  argv: readonly string[],
  cwd: string,
  deps: InitDeps = {},
): Promise<number> {
  const fail = (why: string): number => (console.error(`✖ basalt-ui init: ${why}`), 1)
  const parsed = parseInit(argv)
  if ('error' in parsed) return fail(parsed.error)
  const { args } = parsed

  const root = installRoot(cwd)
  const ctx: Ctx = {
    root,
    args,
    pkgRoot: deps.pkgRoot ?? packageRoot(),
    run: args.noInstall ? undefined : (deps.run ?? spawnRun),
    problems: [],
    todo: [],
  }
  if (args.extra !== undefined && !existsSync(`${root}/${args.extra}`)) {
    return fail(`--extra ${args.extra} does not exist: write the file, then run init again`)
  }

  if (!generateTokens(ctx)) return fail('a token output could not be generated (see above)')
  const declared = declareManifest(ctx)
  if (declared !== null) return fail(declared.error)

  for (const step of [
    installPeers,
    placeManaged,
    seedBudgetFile,
    wireFormatterAndLint,
    seedDesign,
    wireApp,
  ]) {
    try {
      step(ctx)
    } catch (error) {
      ctx.problems.push((error as Error).message)
    }
  }

  for (const line of ctx.todo) console.log(`to do: ${line}`)
  console.log('')
  if (args.noInstall) {
    console.log(
      'doctor not run (--no-install): once the peers are installed, run `basalt-ui doctor`.',
    )
  } else {
    await (deps.doctor ?? ((dir) => doctor(dir)))(root)
  }
  if (ctx.problems.length === 0) return 0
  for (const problem of ctx.problems) console.error(`✖ basalt-ui init: ${problem}`)
  return 1
}
