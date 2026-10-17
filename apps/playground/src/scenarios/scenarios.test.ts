/**
 * The scenario registry and the `shot-state` search contract `basalt-ui shot` depends on.
 */
import { describe, expect, it } from 'bun:test'
import { SCENARIO_NAMES, findScenario } from './registry'
import { SCENARIO_INFO } from './scenario-info'
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

describe('SCENARIO_INFO', () => {
  it('describes every registered scenario except the calibration probes, and nothing else', () => {
    const human = SCENARIO_NAMES.filter((n) => !n.startsWith('probe-'))
    expect(SCENARIO_INFO.map((s): string => s.id).toSorted()).toEqual(human.toSorted())
    expect(SCENARIO_INFO.every((s) => s.title !== '' && s.blurb !== '')).toBe(true)
  })
})

describe('findScenario', () => {
  it('finds every registered name', () => {
    for (const name of SCENARIO_NAMES) expect(findScenario(name)).toBeDefined()
  })

  it('registers S1, S4 and the six calibration seeds', () => {
    expect(SCENARIO_NAMES).toContain('s1-ops')
    expect(SCENARIO_NAMES).toContain('s4-spend')
    expect(SCENARIO_NAMES.filter((n) => n.startsWith('probe-')).toSorted()).toEqual([
      'probe-1',
      'probe-2',
      'probe-3',
      'probe-4',
      'probe-5',
      'probe-6',
    ])
  })

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'nope'])(
    'treats %s as unknown',
    (name) => {
      expect(findScenario(name)).toBeUndefined()
    },
  )
})
