/**
 * StatGroup's one-column law (`docs/DESIGN-CORE.md` § Layout, elevation, shapes): a container under 260px stacks one
 * column and the divider rail draws no leading hairline on any cell. CSS-module hashes are
 * unavailable under `bun test`, so the rule is read from the file.
 */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(import.meta.dir, 'stat-group.module.css'), 'utf8')

test('below 260px: one column, and every cell drops the rail hairline', () => {
  const start = CSS.indexOf('@container basalt-stat-group (max-width: 259.9px)')
  expect(start).toBeGreaterThan(-1)
  const rule = CSS.slice(start, CSS.indexOf('\n}\n\n', start))
  expect(rule).toContain('grid-template-columns: minmax(0, 1fr)')
  expect(rule).toContain('.root[data-divided] > *:nth-child(n) {')
  expect(rule).toContain('border-inline-start: 0')
})
