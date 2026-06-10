#!/usr/bin/env bun
/**
 * basalt-ui CLI entry. Dispatches `init | sync | check-theme` to the built CLI (../dist/cli/index.js).
 * In S0 dist exists after the orchestrator's tsup build.
 */
import { checkTheme, init, sync } from '../dist/cli/index.js'

const cmd = process.argv[2]

switch (cmd) {
  case 'init':
    init()
    break
  case 'sync':
    sync()
    break
  case 'check-theme':
    checkTheme()
    break
  default:
    console.error('Usage: basalt <init|sync|check-theme>')
    process.exit(1)
}
