import { expect, test } from 'bun:test'

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
  // `:` and `=` are keyword-coloured in github-light-default, not the variable blue
  expect(final).toMatch(/--shiki-light:#CF222E;--shiki-dark:#F97583">:</)
})
