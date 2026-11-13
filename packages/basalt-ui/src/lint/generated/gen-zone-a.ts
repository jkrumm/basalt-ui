#!/usr/bin/env bun
/**
 * Emit `zone-a.ts` beside this file: the earned colour names, the pre-mixed and fill-only names and the outright-denied utilities zone
 * A (app code) may not use, read from `zoneADenial()` so `emit.ts` stays the one source.
 * `bun gen-zone-a.ts --write` regenerates; `zone-a.test.ts` fails on drift.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { zoneADenial } from '../../tokens/emit'

export const ZONE_A_PATH = resolve(import.meta.dirname, 'zone-a.ts')

const PRINT_WIDTH = 100

/** One `export const` array, laid out as oxfmt prints it: on one line when it fits, else one item per line. */
function declare(name: string, items: readonly string[]): string {
  const inline = `export const ${name} = [${items.map((i) => `'${i}'`).join(', ')}] as const`
  if (inline.length <= PRINT_WIDTH) return inline
  return `export const ${name} = [\n${items.map((i) => `  '${i}',\n`).join('')}] as const`
}

export function renderZoneA(): string {
  const { names, premixed, fillOnly, deniedOutright } = zoneADenial()
  return (
    '// Generated from src/tokens/emit.ts by gen-zone-a.ts. Do not edit.\n' +
    [
      declare('zoneANames', names),
      declare('zoneAPremixed', premixed),
      declare('zoneAFillOnly', fillOnly),
      declare('deniedCurrent', deniedOutright),
    ].join('\n\n') +
    '\n'
  )
}

if (import.meta.main && process.argv.includes('--write')) writeFileSync(ZONE_A_PATH, renderZoneA())
