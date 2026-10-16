/**
 * The scenario registry and the `shot-state` search contract `basalt-ui shot` depends on.
 */
import { describe, expect, it } from 'bun:test'
import { SCENARIO_NAMES, findScenario } from './registry'
import { isShotState, validateShotSearch } from './shot-state'

describe('validateShotSearch', () => {
  it.each(['empty', 'loading', 'error'])('keeps %s', (state) => {
    expect(validateShotSearch({ 'shot-state': state })).toEqual({ 'shot-state': state })
  })

  it('drops an unknown, mistyped or absent value', () => {
    expect(validateShotSearch({ 'shot-state': 'rest' })).toEqual({})
    expect(validateShotSearch({ 'shot-state': ['empty'] })).toEqual({})
    expect(validateShotSearch({})).toEqual({})
  })

  it('isShotState rejects inherited Object members', () => {
    expect(isShotState('constructor')).toBe(false)
  })
})

describe('findScenario', () => {
  it('finds every registered name', () => {
    for (const name of SCENARIO_NAMES) expect(findScenario(name)).toBeDefined()
  })

  it('registers S4 and the six calibration seeds', () => {
    expect(SCENARIO_NAMES).toContain('s4-spend')
    expect(SCENARIO_NAMES.filter((n) => n.startsWith('calibrate-'))).toHaveLength(6)
  })

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'nope'])(
    'treats %s as unknown',
    (name) => {
      expect(findScenario(name)).toBeUndefined()
    },
  )
})
