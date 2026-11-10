import { describe, expect, test } from 'bun:test'
import { classifyUrl, safeRelativeUrl, safeUrl } from './url'

type Row = readonly [url: string, trusted: 'ok' | 'blocked', untrusted: 'ok' | 'blocked']

const ROWS: readonly Row[] = [
  ['https://h/p', 'ok', 'ok'],
  ['https://h', 'ok', 'ok'],
  ['HTTPS://h/p', 'ok', 'ok'],
  ['mailto:a@b', 'ok', 'ok'],
  ['tel:+1', 'ok', 'ok'],
  ['#a', 'ok', 'ok'],
  ['/a/b', 'ok', 'ok'],
  ['a/b', 'ok', 'ok'],
  ['./a', 'ok', 'ok'],
  ['../a', 'ok', 'ok'],
  ['?q=1', 'ok', 'ok'],
  ['/a?d=1#x', 'ok', 'ok'],
  ['', 'ok', 'ok'],
  ['http://h', 'blocked', 'blocked'],
  ['http://x.invalid/a', 'blocked', 'blocked'],
  ['//h', 'blocked', 'blocked'],
  ['//attacker.example/p?d=SECRET', 'blocked', 'blocked'],
  ['/\\h', 'blocked', 'blocked'],
  ['/\\attacker.example/x', 'blocked', 'blocked'],
  ['\\\\h', 'blocked', 'blocked'],
  ['\\h', 'ok', 'blocked'],
  ['/\t/h', 'blocked', 'blocked'],
  ['/\n/h', 'blocked', 'blocked'],
  ['/\r/h', 'blocked', 'blocked'],
  ['\u0000', 'blocked', 'blocked'],
  ['/a\u0000b', 'blocked', 'blocked'],
  ['/a\u007fb', 'blocked', 'blocked'],
  [' /x', 'blocked', 'blocked'],
  ['/x ', 'blocked', 'blocked'],
  [' /x', 'blocked', 'blocked'],
  ['data:text/html,x', 'blocked', 'blocked'],
  ['data:image/png;base64,AAAA', 'blocked', 'blocked'],
  ['javascript:alert(1)', 'blocked', 'blocked'],
  ['JaVaScRiPt:alert(1)', 'blocked', 'blocked'],
  ['jav\tascript:alert(1)', 'blocked', 'blocked'],
  ['vbscript:x', 'blocked', 'blocked'],
  ['blob:https://h/uuid', 'blocked', 'blocked'],
  ['file:///etc/passwd', 'blocked', 'blocked'],
  ['ftp://h/f', 'blocked', 'blocked'],
  ['streamdown:incomplete-image', 'blocked', 'blocked'],
  ['streamdown:incomplete-link', 'blocked', 'blocked'],
  ['STREAMDOWN:Incomplete-Link', 'blocked', 'blocked'],
  ['https://[::1', 'blocked', 'blocked'],
  ['a\\b', 'ok', 'blocked'],
  ['/a\\b', 'ok', 'blocked'],
  ['https://h/a\\b', 'ok', 'blocked'],
]

describe('classifyUrl', () => {
  test.each(ROWS)('%j trusted -> %s, untrusted -> %s', (url, trusted, untrusted) => {
    expect(classifyUrl(url, 'trusted')).toBe(trusted)
    expect(classifyUrl(url, 'untrusted')).toBe(untrusted)
  })
})

describe('safeUrl', () => {
  test('returns the original string, not the resolved one', () => {
    expect(safeUrl('/a/../b', 'trusted')).toBe('/a/../b')
    expect(safeUrl('HTTPS://H/p', 'untrusted')).toBe('HTTPS://H/p')
  })

  test('returns null when blocked', () => {
    expect(safeUrl('//h', 'trusted')).toBeNull()
    expect(safeUrl('javascript:alert(1)', 'untrusted')).toBeNull()
  })
})

describe('safeRelativeUrl', () => {
  test.each([
    ['/a', '/a'],
    ['a/b', 'a/b'],
    ['#f', '#f'],
    ['https://h/p', null],
    ['mailto:a@b', null],
    ['//h', null],
    ['data:text/html,x', null],
  ])('%j -> %j', (url, expected) => {
    expect(safeRelativeUrl(url, 'untrusted')).toBe(expected)
  })
})
