import { expect, test } from 'bun:test'
import { hashText, parseSweep } from './chat-profile'

test('hashText is deterministic, sensitive, and defined for empty text', () => {
  expect(hashText('abc')).toBe(hashText('abc'))
  expect(hashText('abc')).not.toBe(hashText('abd'))
  expect(hashText('')).toBe('811c9dc5')
})

test('parseSweep keeps valid values, drops junk, dedupes in order', () => {
  expect(parseSweep('0,50,100,200')).toEqual([0, 50, 100, 200])
  expect(parseSweep(' 50 ,, x,-1,50,0')).toEqual([50, 0])
})

test('parseSweep throws naming the raw value when nothing valid is left', () => {
  expect(() => parseSweep('')).toThrow('CHAT_THROTTLES=')
  expect(() => parseSweep('a,-5,,')).toThrow('CHAT_THROTTLES=a,-5,,')
})
