/** Pins the bottom-anchored toast inset in styles.css (docs/CONTROLS-SPEC.md §2). */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'styles.css'), 'utf8')

describe('styles.css — toasts sit above the shell bottom inset', () => {
  const rule = css.match(/\.mantine-Notifications-root\[data-position\^='bottom'\]\s*\{([^}]+)\}/)

  it('targets only bottom positions', () => {
    expect(rule).not.toBeNull()
  })

  it('adds footer offset and safe-area inset to the normal margin', () => {
    const body = (rule?.[1] ?? '').replaceAll(/\s+/g, ' ')
    expect(body).toContain('var(--app-shell-footer-offset, 0px)')
    expect(body).toContain('env(safe-area-inset-bottom, 0px)')
    expect(body).toContain('var(--mantine-spacing-md)')
  })
})
