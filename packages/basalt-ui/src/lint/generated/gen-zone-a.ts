#!/usr/bin/env bun
/**
 * Emit `zone-a.ts` beside this file: the earned color names, the theme classes of the pre-mixed
 * tokens, the fill-only names, the utilities zone A (app code) may not use and the theme class each
 * renamed token is read through, from `zoneADenial()` and the `@theme inline` map
 * (`bridgeEntries()`), so `emit.ts` and the token table stay the one source.
 * `bun gen-zone-a.ts --write` regenerates; `zone-a.test.ts` fails on drift.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { zoneADenial } from '../../tokens/emit'
import { bridgeEntries, TOKENS } from '../../tokens/table'
import type { TokenDef } from '../../tokens/table'

export const ZONE_A_PATH = resolve(import.meta.dirname, 'zone-a.ts')

const PRINT_WIDTH = 100
const COLOR = '--color-'

/** One `export const` array, laid out as oxfmt prints it: on one line when it fits, else one item per line. */
function declare(name: string, items: readonly string[]): string {
  const inline = `export const ${name} = [${items.map((i) => `'${i}'`).join(', ')}] as const`
  if (inline.length <= PRINT_WIDTH) return inline
  return `export const ${name} = [\n${items.map((i) => `  '${i}',\n`).join('')}] as const`
}

/** One `export const` record of string values, one key per line, as oxfmt prints it. */
function declareRecord(name: string, entries: readonly (readonly [string, string])[]): string {
  const key = (k: string): string => (/^[a-z_$][\w$]*$/i.test(k) ? k : `'${k}'`)
  return `export const ${name} = {\n${entries.map(([k, v]) => `  ${key(k)}: '${v}',\n`).join('')}} as const`
}

/** The class a token's color is written through: the first `--color-*` the theme points at it. */
const themeNameOf = (token: string): string | undefined =>
  bridgeEntries()
    .find((e) => e.token === token && e.tw.startsWith(COLOR) && !e.tw.endsWith('-tint'))
    ?.tw.slice(COLOR.length)

/** The utility a token of this family is written with: ink is text, a line is a border, the rest a fill. */
const utilityOf = (token: TokenDef): string =>
  token.family === 'ink' ? 'text' : token.family === 'line' ? 'border' : 'bg'

/**
 * Tokens the theme reads under another name (`--color-accent: var(--basalt-hover)`), each with the
 * class an agent writes for it: `bg-hover` is no class, `bg-accent` is.
 */
function renamedTokens(): (readonly [string, string])[] {
  const themeNames = new Set(
    bridgeEntries()
      .filter((e) => e.tw.startsWith(COLOR))
      .map((e) => e.tw.slice(COLOR.length)),
  )
  return TOKENS.flatMap((token) => {
    const theme = themeNameOf(token.name)
    if (theme === undefined || theme === token.name || themeNames.has(token.name)) return []
    return [[token.name, `${utilityOf(token)}-${theme}`] as const]
  })
}

export function renderZoneA(): string {
  const { names, premixed, fillOnly, deniedOutright } = zoneADenial()
  const premixedClasses = premixed.map((token) => themeNameOf(token) ?? token)
  return (
    '// Generated from src/tokens/emit.ts by gen-zone-a.ts. Do not edit.\n' +
    [
      declare('zoneANames', names),
      declare('zoneAPremixed', premixedClasses),
      declare('zoneAFillOnly', fillOnly),
      declare('deniedCurrent', deniedOutright),
      declareRecord('zoneATokenClasses', renamedTokens()),
    ].join('\n\n') +
    '\n'
  )
}

if (import.meta.main && process.argv.includes('--write')) writeFileSync(ZONE_A_PATH, renderZoneA())
