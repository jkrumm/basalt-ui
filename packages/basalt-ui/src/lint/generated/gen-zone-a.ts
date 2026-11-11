#!/usr/bin/env bun
/**
 * Emit `zone-a.ts` beside this file: the earned colour names and the outright-denied utilities zone
 * A (app code) may not use, read from `zoneADenial()` so `emit.ts` stays the one source.
 * `bun gen-zone-a.ts --write` regenerates; `zone-a.test.ts` fails on drift.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { zoneADenial } from '../../tokens/emit'

export const ZONE_A_PATH = resolve(import.meta.dirname, 'zone-a.ts')

const list = (items: readonly string[]): string => items.map((i) => `  '${i}',\n`).join('')

export function renderZoneA(): string {
  const { names, deniedOutright } = zoneADenial()
  return (
    '// Generated from src/tokens/emit.ts by gen-zone-a.ts. Do not edit.\n' +
    `export const zoneANames = [\n${list(names)}] as const\n\n` +
    `export const deniedCurrent = [\n${list(deniedOutright)}] as const\n`
  )
}

if (import.meta.main && process.argv.includes('--write')) writeFileSync(ZONE_A_PATH, renderZoneA())
