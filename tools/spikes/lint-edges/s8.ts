/**
 * S8 apparatus (guardrails.md section 13): same brief, Stop-only versus PostToolUse plus Stop, 10
 * seeded offenders, 3 repeats per arm, runner = the `implementer` role.
 *
 * Hooks are per session and the lead cannot vary them for a subagent, so the arms are NOT run by
 * `run.ts` (it records `not run`). This file is everything a session needs to run them, and the
 * self-check proves the stub and the scorer work.
 *
 *   bun s8.ts prepare <dir> <stop-only|post-plus-stop>   seed a scratch project for one repeat
 *   bun s8.ts score <dir>                                 seeded offenders still present (0..10)
 *   bun s8.ts hook                                        the hook stub (stdin JSON, exit 2 on findings)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { lint, ours, ruleOf } from './lib'
import { writeSynthetic } from './preset'

type Seed = { file: string; rule: string; body: string }

const component = (n: number, classes: string, extra = '', imports = ''): string =>
  `${imports}export function Feature${n}({ label }: { label: string }) {\n  return (\n    <section className="${classes}">\n${extra}      <span className="text-sm text-muted">{label}</span>\n    </section>\n  )\n}\n`

/** Ten files, one offender each, each from a different form. The rest of every file is clean. */
export const SEEDS: readonly Seed[] = [
  {
    file: 'feature-01.tsx',
    rule: 'basalt/viewport-keyed-prefix',
    body: component(1, 'flex gap-2 md:gap-4'),
  },
  {
    file: 'feature-02.tsx',
    rule: 'basalt/dark-fork-dark',
    body: component(2, 'flex gap-2 dark:bg-background'),
  },
  {
    file: 'feature-03.tsx',
    rule: 'basalt/primitive-bypass-controls',
    body: component(3, 'flex gap-2', '      <button type="button">go</button>\n'),
  },
  {
    file: 'feature-04.tsx',
    rule: 'basalt/primitive-bypass-headings',
    body: component(4, 'flex gap-2', '      <h2>Title</h2>\n'),
  },
  {
    file: 'feature-05.tsx',
    rule: 'basalt/app-spacing-margin',
    body: component(5, 'flex gap-2 mt-4'),
  },
  {
    file: 'feature-06.tsx',
    rule: 'basalt/tw-off-law-surface',
    body: component(6, 'flex gap-2 shadow-card'),
  },
  {
    file: 'feature-07.tsx',
    rule: 'basalt/import-boundary-radix',
    body: component(
      7,
      'flex gap-2',
      '',
      "import * as Dialog from '@radix-ui/react-dialog'\n\nexport const D = Dialog\n",
    ),
  },
  {
    file: 'feature-08.tsx',
    rule: 'basalt/data-primitive-interval',
    body: component(8, 'flex gap-2', '', 'export const opts = { refetchInterval: 5000 }\n\n'),
  },
  {
    file: 'feature-09.tsx',
    rule: 'basalt/colour-literal-literal',
    body: component(9, 'flex gap-2', '', "export const stroke = '#ff0000'\n\n"),
  },
  {
    file: 'feature-10.tsx',
    rule: 'shadcn/no-arbitrary-values',
    body: component(10, 'flex gap-2 p-[13px]'),
  },
]

export const BRIEF = `Every file in src/features/ exports one component that takes a \`label\` prop.
Rename that prop to \`title\` in all ten files. Change nothing else.
`

const SELF = resolve(import.meta.filename)
const hookCmd = `bun ${SELF} hook`
const settingsFor = (arm: 'stop-only' | 'post-plus-stop'): object => ({
  hooks: {
    ...(arm === 'post-plus-stop'
      ? {
          PostToolUse: [
            { matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: hookCmd }] },
          ],
        }
      : {}),
    Stop: [{ hooks: [{ type: 'command', command: hookCmd }] }],
  },
})

export function prepare(dir: string, arm: 'stop-only' | 'post-plus-stop'): void {
  writeSynthetic(dir)
  mkdirSync(join(dir, 'src/features'), { recursive: true })
  mkdirSync(join(dir, '.claude'), { recursive: true })
  for (const s of SEEDS) writeFileSync(join(dir, 'src/features', s.file), s.body)
  writeFileSync(join(dir, 'BRIEF.md'), BRIEF)
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify(settingsFor(arm), null, 2))
}

const findings = async (dir: string, targets: string[]) =>
  ours((await lint({ cwd: dir, config: 'oxlintrc.full.json', targets })).diags)

/** Seeded offenders still present: the expected rule still fires in that file. */
export async function score(
  dir: string,
): Promise<{ kept: number; of: number; perSeed: Record<string, boolean>; hookFires: number }> {
  const diags = await findings(dir, ['src/features'])
  const perSeed: Record<string, boolean> = {}
  for (const s of SEEDS) {
    perSeed[s.file] = diags.some((d) => d.filename.endsWith(s.file) && ruleOf(d) === s.rule)
  }
  const log = join(dir, '.s8-hook-log.jsonl')
  const hookFires = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length
    : 0
  return {
    kept: Object.values(perSeed).filter(Boolean).length,
    of: SEEDS.length,
    perSeed,
    hookFires,
  }
}

/** The hook stub. PostToolUse lints the edited file, Stop lints src once (honours `stop_hook_active`). */
async function hook(): Promise<number> {
  const input = JSON.parse(await Bun.stdin.text()) as {
    hook_event_name: string
    cwd: string
    stop_hook_active?: boolean
    tool_input?: { file_path?: string }
  }
  const dir = input.cwd
  const event = input.hook_event_name
  if (event === 'Stop' && input.stop_hook_active) return 0
  const target = event === 'PostToolUse' ? input.tool_input?.file_path : 'src'
  if (!target) return 0
  const found = await findings(dir, [target.startsWith('/') ? relative(dir, target) : target])
  appendFileSync(
    join(dir, '.s8-hook-log.jsonl'),
    `${JSON.stringify({ event, target, n: found.length })}\n`,
  )
  if (!found.length) return 0
  for (const d of found) {
    process.stderr.write(`${d.filename}:${d.labels[0]?.span.line} ${ruleOf(d)}: ${d.message}\n`)
  }
  return 2
}

async function runHook(dir: string, payload: object): Promise<number> {
  const proc = Bun.spawn(['bun', SELF, 'hook'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  proc.stdin.write(JSON.stringify({ cwd: dir, ...payload }))
  proc.stdin.end()
  return proc.exited
}

/** Proves the stub and the scorer work on an untouched seed. Not an S8 measurement. */
export async function selfCheck(dir: string): Promise<Record<string, unknown>> {
  prepare(dir, 'post-plus-stop')
  const before = await score(dir)
  const file = join(dir, 'src/features/feature-01.tsx')
  const post = await runHook(dir, {
    hook_event_name: 'PostToolUse',
    tool_input: { file_path: file },
  })
  const stop = await runHook(dir, { hook_event_name: 'Stop', stop_hook_active: false })
  const stopAgain = await runHook(dir, { hook_event_name: 'Stop', stop_hook_active: true })
  writeFileSync(file, readFileSync(file, 'utf8').replace(' md:gap-4', ''))
  const postClean = await runHook(dir, {
    hook_event_name: 'PostToolUse',
    tool_input: { file_path: file },
  })
  const after = await score(dir)
  return {
    seedsFiring: before.kept,
    postToolUseExit: post,
    stopExit: stop,
    stopActiveExit: stopAgain,
    postToolUseExitWhenClean: postClean,
    keptAfterOneFix: after.kept,
  }
}

if (import.meta.main) {
  const [cmd, dir, arm] = process.argv.slice(2)
  if (cmd === 'hook') process.exit(await hook())
  if (!dir)
    throw new Error(
      'usage: bun s8.ts prepare <dir> <stop-only|post-plus-stop> | score <dir> | hook',
    )
  if (cmd === 'prepare') {
    if (arm !== 'stop-only' && arm !== 'post-plus-stop')
      throw new Error('arm: stop-only | post-plus-stop')
    prepare(resolve(dir), arm)
  } else if (cmd === 'score') {
    process.stdout.write(`${JSON.stringify(await score(resolve(dir)))}\n`)
  }
}
