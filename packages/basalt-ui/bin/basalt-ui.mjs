#!/usr/bin/env bun
/**
 * basalt-ui CLI entry. Dispatches subcommands to the built CLI (../dist/cli/index.js) via `run()`,
 * which returns a number or Promise<number> — this entry is the ONLY place that calls process.exit,
 * so the exported command functions stay free of process side effects.
 */
import { run } from '../dist/cli/index.js'

const result = run(process.argv.slice(2))
if (typeof result === 'number') {
  process.exit(result)
} else {
  result.then((code) => process.exit(code))
}
