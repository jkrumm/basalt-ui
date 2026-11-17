import { describe, expect, test } from 'bun:test'
import { couldNotLoad } from './could-not-load'

describe('couldNotLoad', () => {
  test('a plain capitalised first word lowercases', () => {
    expect(couldNotLoad('Revenue')).toBe('Could not load revenue')
    expect(couldNotLoad('Weekly minutes')).toBe('Could not load weekly minutes')
    expect(couldNotLoad('  Practice record ')).toBe('Could not load practice record')
  })

  test('a first word that is not a plain capitalised word keeps its case', () => {
    expect(couldNotLoad('Wi-Fi signal')).toBe('Could not load Wi-Fi signal')
    expect(couldNotLoad('iPhone battery')).toBe('Could not load iPhone battery')
    expect(couldNotLoad('eBay fees')).toBe('Could not load eBay fees')
    expect(couldNotLoad('KPI')).toBe('Could not load KPI')
    expect(couldNotLoad('MRR')).toBe('Could not load MRR')
    expect(couldNotLoad('2024 sales')).toBe('Could not load 2024 sales')
  })

  test('a missing or blank label is the bare title', () => {
    expect(couldNotLoad()).toBe('Could not load')
    expect(couldNotLoad('   ')).toBe('Could not load')
  })
})
