import { expect, test } from 'bun:test'
import type { Highlight } from './highlighter'

const CODE = 'const x: number = 1'

/** A highlighter module of its own, so the first call really is the first on a cold grammar. */
async function coldHighlight(): Promise<(code: string, lang: string) => Promise<string | null>> {
  const mod: typeof import('./highlighter') = await import(`./highlighter.ts?cold=${Date.now()}`)
  return mod.highlightCode
}

test('the first highlight of a cold highlighter equals every later one', async () => {
  const highlight = await coldHighlight()
  const first = await highlight(CODE, 'ts')
  expect(first).not.toBeNull()
  expect(await highlight(CODE, 'ts')).toBe(first)
})

test('a partial prefix highlighted first does not change the final highlight', async () => {
  const highlight = await coldHighlight()
  await highlight('const x: n', 'ts')
  const final = await highlight(CODE, 'ts')
  expect(final).toBe(await highlight(CODE, 'ts'))
  // `:` and `=` are keyword-colored in github-light-high-contrast, not the variable blue
  expect(final).toMatch(/--shiki-light:#A0111F;--shiki-dark:#F97583">:</)
})

/** A highlighter module of its own with the cache API; "cobol" has no grammar, so each entry settles as plain once the highlighter has loaded. */
let instances = 0

async function coldCache(): Promise<(code: string) => Highlight> {
  const mod: typeof import('./highlighter') = await import(`./highlighter.ts?cache=${instances++}`)
  return (code) => mod.getHighlight(code, 'cobol')
}

const BLOCK = 49_000
const block = (n: number): string => String(n).padEnd(BLOCK, 'x')

test('the cache asks for one highlight per source and reads settled ones as taken', async () => {
  const get = await coldCache()
  const first = get(block(0))
  expect(get(block(0))).toBe(first)
  await first.promise
  expect(get(block(0)).read).toBe(true)
})

test('past its budget the cache drops the oldest settled entries that a render has read', async () => {
  const get = await coldCache()
  const old = get(block(0))
  await old.promise
  get(block(0)) // a render read it
  for (let n = 1; n <= 11; n++) await get(block(n)).promise
  expect(get(block(0))).not.toBe(old)
})

test('an entry no render has read yet outlives the budget: its boundary retries it', async () => {
  const get = await coldCache()
  const unread = get(block(0))
  await unread.promise
  for (let n = 1; n <= 11; n++) await get(block(n)).promise
  expect(get(block(0))).toBe(unread)
})

test('a pending entry is never dropped', async () => {
  const get = await coldCache()
  const pending = get(block(0))
  for (let n = 1; n <= 25; n++) get(block(n))
  expect(pending.settled).toBeUndefined()
  expect(get(block(0))).toBe(pending)
})

test('an unread settled entry is dropped once the cache is twice over its budget', async () => {
  const get = await coldCache()
  const unread = get(block(0))
  await unread.promise
  for (let n = 1; n <= 25; n++) await get(block(n)).promise
  expect(get(block(0))).not.toBe(unread)
})

test('a hit moves its entry to the newest end, so the hot block outlives a colder one', async () => {
  const get = await coldCache()
  const hot = get(block(0))
  const cold = get(block(1))
  await Promise.all([hot.promise, cold.promise])
  get(block(0))
  get(block(1))
  get(block(0)) // the hot block was asked for last
  for (let n = 2; n <= 10; n++) await get(block(n)).promise // 11 blocks: one over the budget
  expect(get(block(0))).toBe(hot)
  expect(get(block(1))).not.toBe(cold)
})
