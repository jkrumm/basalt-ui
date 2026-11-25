/**
 * A motion `var(--basalt-dur-*|ease-*|spring*)` in the package's own source names a token basalt emits. An unknown name makes
 * the whole declaration invalid at computed-value time, so `transition: translate var(--basalt-spring),
 * opacity var(--basalt-dur-base) var(--basalt-ease-standard)` (the real name is `--basalt-ease`) is
 * no transition at all and the surface it sits on jumps instead of moving.
 */
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BASALT_NAMES } from './basalt-names'

const SRC = join(import.meta.dir, '..')
const KNOWN = new Set(BASALT_NAMES)
const SOURCE = /\.(?:ts|tsx)$/
const SKIPPED = /\.(?:test|generated|d)\.tsx?$|\.guard\.ts$/

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (SOURCE.test(entry) && !SKIPPED.test(entry)) yield path
  }
}

test('every motion var(--basalt-dur|ease|spring*) in the source names an emitted token', () => {
  const unknown: string[] = []
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/var\((--basalt-(?:dur|ease|spring)[a-z0-9-]*[a-z0-9])/g)) {
      const name = match[1]!
      if (!KNOWN.has(name)) unknown.push(`${file.slice(SRC.length + 1)}: ${name}`)
    }
  }
  expect(unknown).toEqual([])
})
