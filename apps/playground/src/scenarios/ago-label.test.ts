import { describe, expect, it } from 'bun:test'
import { agoLabel } from './ago-label'

const NOW = new Date(Date.UTC(2026, 9, 16, 12, 0))
const ago = (minutes: number): string => agoLabel(new Date(NOW.getTime() - minutes * 60_000), NOW)

describe('agoLabel', () => {
  it.each([
    [0, 'just now'],
    [1, '1 min ago'],
    [59, '59 min ago'],
    [60, '1 hour ago'],
    [120, '2 hours ago'],
    [23 * 60 + 59, '23 hours ago'],
    [24 * 60, 'yesterday'],
    [47 * 60, 'yesterday'],
    [48 * 60, '2 days ago'],
    [13 * 24 * 60, '13 days ago'],
    [14 * 24 * 60, '2 weeks ago'],
    [21 * 24 * 60, '3 weeks ago'],
  ])('%i min before the reading time reads %s', (minutes, label) => {
    expect(ago(minutes)).toBe(label)
  })
})
