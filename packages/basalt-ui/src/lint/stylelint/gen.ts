/**
 * Writes the shipped preset, `configs/stylelint.basalt.json`, from `renderStylelintConfig()`.
 *
 * Usage: bun packages/basalt-ui/src/lint/stylelint/gen.ts
 *        bun packages/basalt-ui/src/lint/stylelint/gen.ts --check  (drift gate: exit 1 when stale)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderStylelintConfig } from './render'

export const SHIPPED_CONFIG = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'configs',
  'stylelint.basalt.json',
)

if (import.meta.main) {
  const next = renderStylelintConfig()
  if (process.argv.includes('--check')) {
    const current = readFileSync(SHIPPED_CONFIG, 'utf8')
    if (current !== next) {
      process.stderr.write(
        'configs/stylelint.basalt.json is stale: run `bun packages/basalt-ui/src/lint/stylelint/gen.ts`\n',
      )
      process.exit(1)
    }
  } else {
    writeFileSync(SHIPPED_CONFIG, next)
  }
}
