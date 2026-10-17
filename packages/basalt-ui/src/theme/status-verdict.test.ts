/**
 * `StatusVerdict`'s word is the proportional sans (Wave 35 typography law: mono is for UPPERCASE
 * micro-captions, times and code), at the micro size and in muted ink.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./status-verdict.module.css', import.meta.url), 'utf8')
const verdict = /\.verdict\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''

describe('StatusVerdict typography', () => {
  test('the word is the sans, never the mono', () => {
    expect(verdict).toContain('font-family: var(--basalt-font-sans)')
    expect(verdict).not.toContain('mono')
  })

  test('keeps the micro size and muted ink', () => {
    expect(verdict).toContain('font-size: var(--vx-text-micro)')
    expect(verdict).toContain('color: var(--vx-muted)')
  })
})
