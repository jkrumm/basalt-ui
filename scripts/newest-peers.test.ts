import { describe, expect, it } from 'bun:test'

import { newestInRange } from './newest-peers'

const versions = ['4.3.4', '4.3.5', '4.3.6', '4.4.0', '5.0.0', '5.1.0-beta.1']

describe('newestInRange', () => {
  it('takes the newest version a caret admits', () => {
    expect(newestInRange(versions, '^4.3.5')).toBe('4.4.0')
  })

  it('stays inside a tilde', () => {
    expect(newestInRange(versions, '~4.3.5')).toBe('4.3.6')
  })

  it('holds an exact pin', () => {
    expect(newestInRange(versions, '4.3.5')).toBe('4.3.5')
  })

  it('skips a prerelease and reads an or-range', () => {
    expect(newestInRange(versions, '^4 || ^5')).toBe('5.0.0')
  })

  it('is null when nothing fits', () => {
    expect(newestInRange(versions, '^6.0.0')).toBeNull()
  })
})
