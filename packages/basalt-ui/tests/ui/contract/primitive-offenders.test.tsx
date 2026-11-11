import { describe, expect, test } from 'bun:test'
import { checkPrimitive } from '../../../src/ui/primitive.contract'
import * as noSlot from './fixtures/no-slot'
import * as random from './fixtures/random'

describe('primitive contract offenders', () => {
  test('a part without data-slot fails', async () => {
    const violations = await checkPrimitive({
      name: 'no-slot',
      exports: noSlot,
      slots: ['no-slot'],
    })
    expect(violations.join('\n')).toContain('renders no element with data-slot="no-slot"')
  })

  test('a Math.random() render fails the hydration control', async () => {
    const violations = await checkPrimitive({ name: 'random', exports: random, slots: ['random'] })
    expect(violations.join('\n')).toContain('recoverable hydration error')
  })

  test('a slot missing from SLOTS fails', async () => {
    const violations = await checkPrimitive({ name: 'random', exports: random, slots: [] })
    expect(violations.join('\n')).toContain('not listed in SLOTS')
  })
})
