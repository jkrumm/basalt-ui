// Spike stand-in for the PostToolUse hook (sk-4 builds the real one). Runs oxlint on the one
// edited file. Wired as a hook it reads the tool event on stdin; run by hand it takes a path.
//   hook: {"hooks":{"PostToolUse":[{"matcher":"Edit|Write","hooks":[{"type":"command","command":"bun hook-stub/post-tool-use.ts"}]}]}}
//   hand: bun hook-stub/post-tool-use.ts src/App.tsx
// Exit 0 clean (or not a source file), exit 2 with the findings on stderr.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const oxlint = join(here, '..', 'node_modules', '.bin', 'oxlint')

const fromArg = process.argv[2]
let file = fromArg
if (!file) {
  const event = JSON.parse(await Bun.stdin.text()) as { tool_input?: { file_path?: string } }
  file = event.tool_input?.file_path
}
if (!file || !/\.(ts|tsx)$/.test(file) || !existsSync(resolve(file))) process.exit(0)

const run = spawnSync(
  oxlint,
  ['-c', join(here, 'oxlintrc.json'), '--format', 'unix', '--disable-nested-config', resolve(file)],
  { encoding: 'utf8' },
)
const findings = run.stdout.split('\n').filter((line) => /: .+\[(Error|Warning)/.test(line))
if (findings.length === 0) process.exit(0)
process.stderr.write(`lint: ${findings.length} finding(s)\n${findings.join('\n')}\n`)
process.exit(2)
