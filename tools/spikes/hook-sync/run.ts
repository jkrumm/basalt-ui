/**
 * Spike 625 (docs/v3/concepts/skills-agent-layer.md section 8, S2 S5 S6). Throwaway harness, no tests.
 *
 *   S2  hook semantics: the stub shim run through /bin/sh with event JSON on stdin (exit 2 text, a
 *       subdirectory cwd, a missing bin, a Stop loop under each guard, output size).
 *   S5  render-then-compare sync over six workspace shapes, oxfmt, bun's isolated linker, a roots
 *       change and the settings.json merge.
 *   S6  static scan of the shadcn skill (pinned) and the basalt skills for contradicting instructions.
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "hypothesis held"). Progress
 * goes to stderr. Deterministic: two runs print byte-identical output. Verdict doc:
 * docs/v3/spikes/hook-sync.md.
 *
 *   bun tools/spikes/hook-sync/run.ts
 *   bun tools/spikes/hook-sync/run.ts --owner-fixture <dir>   # scaffold the real-session repro, then exit
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runS2, writeOwnerFixture } from './s2'
import { runS5 } from './s5'
import { PRECEDENCE, runS6 } from './s6'
import { progress } from './util'

const OWNER_RUN = {
  question:
    'S2 model-acts: does the model act on PostToolUse exit-2 text, and does a Stop block bring it back exactly once',
  why: 'Claude Code decides what the model sees; no headless `claude -p` is allowed here, so only an interactive session can show it',
  setup: [
    'bun tools/spikes/hook-sync/run.ts --owner-fixture ~/basalt-hook-fixture',
    'cd ~/basalt-hook-fixture && git init -q && claude   # interactive; accept the project-hooks trust prompt',
  ],
  steps: [
    {
      prompt:
        'Create packages/app/src/pages/c.tsx exporting a component that renders <Section className="p-4">hello</Section>. Do nothing else.',
      pass: 'the transcript shows the basalt/class-policy line as hook feedback after the Write, and the next tool call edits c.tsx to drop p-4 without a further prompt',
    },
    {
      prompt:
        'Run `cd packages/app` in Bash, then add <Section className="p-4" /> to src/pages/ok.tsx. Ignore any hook feedback about p-4 and say "done".',
      pass: 'cat .basalt/hook.log shows a post-edit line whose cwd ends in packages/app; the agent still ends its turn after Stop re-engages it once',
    },
  ],
  readOut: 'cat .basalt/hook.log',
  expectInLog:
    'per prompt: post-edit lines; stop active=false once, then stop active=true once (flag present) or stop active=absent at most twice (flag missing: the counter alone bounds it)',
  refutedIf:
    'the model never reacts to the exit-2 text, or Stop re-engages it more than twice in one turn',
}

const argv = process.argv.slice(2)
const at = argv.indexOf('--owner-fixture')
if (at !== -1) {
  const dir = resolve(argv[at + 1] ?? '')
  if (argv[at + 1] === undefined) throw new Error('--owner-fixture needs a directory')
  mkdirSync(dir, { recursive: true })
  writeOwnerFixture(dir)
  progress(`owner fixture written to ${dir}`)
  process.exit(0)
}

progress('start')
const s2 = runS2()
const s5 = await runS5()
const s6 = await runS6()
const verdicts = [s2.verdict, s5.verdict, s6.verdict]
const verdict = verdicts.includes('refuted')
  ? 'refuted'
  : verdicts.every((v) => v === 'pass')
    ? 'pass'
    : 'pending'

console.log(
  JSON.stringify(
    { spike: 'hook-sync', s2, s5, s6, precedence: PRECEDENCE, ownerRun: OWNER_RUN, verdict },
    null,
    2,
  ),
)
