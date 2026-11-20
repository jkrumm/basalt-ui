import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { BasaltProvider } from '../core/provider'
import { checkPrimitive, primitiveModules } from './primitive.contract'
import { SLOTS } from './slots'

const modules = primitiveModules()

/** An island's root: locale and scheme set, no `link`, no router, no query client, no shell. */
const routerless = (node: ReactElement): ReactElement =>
  createElement(BasaltProvider, { locale: 'de-DE', scheme: 'dark' }, node)

describe('primitive contract', () => {
  test('the wrap reaches every part: a wrap that throws fails the check', async () => {
    const exports = (await import('./button')) as Record<string, unknown>
    const violations = await checkPrimitive(
      { name: 'button', exports, slots: SLOTS.button },
      () => {
        throw new Error('wrapped')
      },
    )
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.every((v) => v.endsWith('wrapped'))).toBe(true)
  })

  test('enlists every src/ui/*.tsx module, the seeds among them', () => {
    for (const seed of ['button', 'input', 'field', 'card']) expect(modules).toContain(seed)
  })

  for (const name of modules) {
    test(`${name}: renders without a provider, slots match, hydrates clean`, async () => {
      const exports = (await import(`./${name}`)) as Record<string, unknown>
      const slots = (SLOTS as Record<string, readonly string[]>)[name]
      expect(await checkPrimitive({ name, exports, slots })).toEqual([])
    })

    test(`${name}: renders inside a BasaltProvider with no router, hydrates clean`, async () => {
      const exports = (await import(`./${name}`)) as Record<string, unknown>
      const slots = (SLOTS as Record<string, readonly string[]>)[name]
      expect(await checkPrimitive({ name, exports, slots }, routerless)).toEqual([])
    })
  }
})
