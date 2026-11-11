import { describe, expect, test } from 'bun:test'
import { checkPrimitive, primitiveModules } from './primitive.contract'
import { SLOTS } from './slots'

const modules = primitiveModules()

describe('primitive contract', () => {
  test('enlists every src/ui/*.tsx module, the seeds among them', () => {
    for (const seed of ['button', 'input', 'field', 'card']) expect(modules).toContain(seed)
  })

  for (const name of modules) {
    test(`${name}: renders without a provider, slots match, hydrates clean`, async () => {
      const exports = (await import(`./${name}`)) as Record<string, unknown>
      const slots = (SLOTS as Record<string, readonly string[]>)[name]
      expect(await checkPrimitive({ name, exports, slots })).toEqual([])
    })
  }
})
