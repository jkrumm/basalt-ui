import { expect, test } from 'bun:test'
import type { PlannedColumn } from './core/plan'
import { tierAttributes } from './parts/head'

const planned = (place: PlannedColumn['place']): PlannedColumn =>
  ({ place, priority: null, pin: null, identity: false }) as unknown as PlannedColumn

test('a detail-placed column leaves the phone card when a derived sheet lists it', () => {
  expect(tierAttributes(planned('detail'), true)['data-card']).toBe('hidden')
})

test('a detail-placed column stays on the card under a custom detail render', () => {
  expect(tierAttributes(planned('detail'), false)['data-card']).toBeUndefined()
})

test('a hidden column is hidden either way', () => {
  expect(tierAttributes(planned('hidden'), false)['data-card']).toBe('hidden')
})
