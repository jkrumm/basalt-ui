/**
 * `lint`: registered before they are built (ARCHITECTURE 4.3), so the lanes
 * that build them edit these handlers and never `index.ts`. Each exits 1 saying so: a stub that
 * exited 0 would read as a passing gate. The flag schema is the contract's own.
 */
import { parseArgs } from 'node:util'

/** The flags each stubbed verb will accept (ARCHITECTURE 4.3). */
export const V3_VERB_OPTIONS = {
  lint: {
    file: { type: 'string', multiple: true },
    agent: { type: 'boolean' },
    changed: { type: 'boolean' },
    stats: { type: 'boolean' },
    hook: { type: 'string' },
  },
} as const

/** Exit 1 on an unknown flag, else exit 1 saying the verb is not built yet. */
export function runV3Stub(cmd: keyof typeof V3_VERB_OPTIONS, flags: readonly string[]): number {
  const options = V3_VERB_OPTIONS[cmd]
  try {
    parseArgs({ args: [...flags], options, strict: true, allowPositionals: false })
  } catch (err) {
    const accepted = Object.keys(options).map((k) => `--${k}`)
    console.error(`basalt-ui ${cmd}: ${(err as Error).message} Accepted: ${accepted.join(' ')}\n`)
    return 1
  }
  console.error(`basalt-ui ${cmd}: not implemented in this build.`)
  return 1
}
