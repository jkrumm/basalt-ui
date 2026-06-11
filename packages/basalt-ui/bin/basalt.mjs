#!/usr/bin/env bun
/**
 * basalt-ui CLI entry. Dispatches `init | sync | check-theme` to the built CLI (../dist/cli/index.js)
 * via `run()`, which returns an exit code — this entry is the ONLY place that calls process.exit, so
 * the exported command functions stay free of process side effects.
 */
import { run } from '../dist/cli/index.js'

process.exit(run(process.argv.slice(2)))
