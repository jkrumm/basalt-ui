/**
 * The card inset is stated in four places that must agree: the token (`cardInsetY`/`cardInsetX`,
 * level 0), the fallback literal every reader of `--vx-space-card-inset-*` carries (a Mantine-free
 * chart layer or a head-injected palette renders before the var exists), and the `py`/`px` pair the
 * `basalt/card-inset` rule accepts. One scale, so one test.
 */
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CARD_INSET_PX, CARD_INSET_PY } from '../../configs/oxlint-plugin.js'
import { SPACE_SCALE, SPACE_STEP } from './palette'

const SRC = join(import.meta.dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

const toPx = (value: string, unit: string): number =>
  unit === 'rem' ? Number(value) * 16 : Number(value)

test('every --vx-space-card-inset-* fallback literal equals the level-0 inset', () => {
  const found: [string, string, number][] = []
  for (const file of sources(SRC)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/var\(--vx-space-card-inset-([xy]),\s*([\d.]+)(px|rem)\)/g)) {
      found.push([file.slice(SRC.length), m[1] as string, toPx(m[2] as string, m[3] as string)])
    }
  }
  expect(found.length).toBeGreaterThan(8)
  for (const [file, axis, px] of found) {
    expect([file, axis, px]).toEqual([
      file,
      axis,
      axis === 'x' ? SPACE_STEP.cardInsetX : SPACE_STEP.cardInsetY,
    ])
  }
})

test('every bare reader of --vx-space-card-inset-* carries a fallback', () => {
  for (const file of sources(SRC)) {
    if (/tokens\/core\.ts$|guard\/vx-names\.ts$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/var\(--vx-space-card-inset-[xy]\)/g)) {
      throw new Error(`${file.slice(SRC.length)}: ${m[0]} has no fallback`)
    }
  }
})

test("the rule's py/px pair names the scale steps the inset tokens are", () => {
  expect(SPACE_STEP.cardInsetY).toBe(SPACE_SCALE[CARD_INSET_PY as keyof typeof SPACE_SCALE])
  expect(SPACE_STEP.cardInsetX).toBe(SPACE_SCALE[CARD_INSET_PX as keyof typeof SPACE_SCALE])
})
