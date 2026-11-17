import { describe, expect, test } from 'bun:test'

import { MAX_PARALLEL, parallelism } from './unit-parallelism'

describe('parallelism', () => {
  test('no grant is the serial default', () => {
    expect(parallelism({})).toBe(1)
    expect(parallelism({ FACTORY_STEP_CORES: '', FACTORY_STEP_MEM_MIB: 'many' })).toBe(1)
    expect(parallelism({ FACTORY_STEP_CORES: '0', FACTORY_STEP_MEM_MIB: '-4' })).toBe(1)
  })

  test('the smaller of cores and memory sets it', () => {
    expect(parallelism({ FACTORY_STEP_CORES: '6', FACTORY_STEP_MEM_MIB: '10240' })).toBe(6)
    expect(parallelism({ FACTORY_STEP_CORES: '6', FACTORY_STEP_MEM_MIB: '3072' })).toBe(3)
    expect(parallelism({ FACTORY_STEP_CORES: '2', FACTORY_STEP_MEM_MIB: '10240' })).toBe(2)
  })

  test('one half of a grant sizes it alone', () => {
    expect(parallelism({ FACTORY_STEP_CORES: '4' })).toBe(4)
    expect(parallelism({ FACTORY_STEP_MEM_MIB: '2048' })).toBe(2)
  })

  test('a grant below one process still runs one, a large one is capped', () => {
    expect(parallelism({ FACTORY_STEP_CORES: '1', FACTORY_STEP_MEM_MIB: '512' })).toBe(1)
    expect(parallelism({ FACTORY_STEP_CORES: '64', FACTORY_STEP_MEM_MIB: '65536' })).toBe(
      MAX_PARALLEL,
    )
  })
})
