/** `handle.label(value)`: the label `.labels()` declared for a member, else the member itself. */
import { afterEach, describe, expect, test } from 'bun:test'
import { defineControls, resetControlsOwnersForTests } from './define'
import { field } from './field'

afterEach(resetControlsOwnersForTests)

const store = defineControls({
  id: 'label-test',
  scope: 'page',
  fields: {
    status: field
      .enum(['all', 'rolled-back', 'failed'], 'all')
      .labels({ all: 'All outcomes', 'rolled-back': 'Rolled back' }),
    plain: field.enum(['a', 'b'], 'a'),
    record: field.string(''),
  },
})

describe('FieldHandle.label', () => {
  test('returns the label the field declared', () => {
    expect(store.field.status.label('rolled-back')).toBe('Rolled back')
    expect(store.field.status.label('all')).toBe('All outcomes')
  })

  test('a member with no declared label reads as its value', () => {
    expect(store.field.status.label('failed')).toBe('failed')
    expect(store.field.plain.label('b')).toBe('b')
  })

  test('agrees with the labels in `options`', () => {
    for (const option of store.field.status.options)
      expect(store.field.status.label(option.value)).toBe(option.label)
  })

  test('a field with no labels, a string among them, reads as the value it holds', () => {
    expect(store.field.record.label('deploy-7')).toBe('deploy-7')
  })
})
