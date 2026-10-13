import { describe, expect, test } from 'bun:test'
import { createUrlTransform } from './url-hardening'

const defaults = { allowedLinkPrefixes: ['https://', '/'], allowedImagePrefixes: ['https://', '/'] }

describe('createUrlTransform — remend sentinels', () => {
  test.each([
    ['href', 'streamdown:incomplete-link'],
    ['src', 'streamdown:incomplete-image'],
    ['href', 'streamdown:incomplete-image'],
    ['src', 'streamdown:incomplete-link'],
  ])('%s %s resolves to null', (key, url) => {
    expect(createUrlTransform(defaults)(url, key, {} as never)).toBeNull()
  })

  test('a permissive allowlist cannot admit the sentinels', () => {
    const open = createUrlTransform({ allowedLinkPrefixes: [''], allowedImagePrefixes: [''] })
    expect(open('streamdown:incomplete-image', 'src', {} as never)).toBeNull()
    expect(open('streamdown:incomplete-link', 'href', {} as never)).toBeNull()
    expect(open('https://example.com/a.png', 'src', {} as never)).toBe('https://example.com/a.png')
  })
})
