/**
 * `src/widget-header/**` must stay Mantine-free (docs/CONTROLS-SPEC.md §2.2) — so `ChartCard`
 * (inside the `charts/` boundary) can compose `WidgetHeader`/`DeltaBadge` without tripping
 * `basalt/token-layer-boundary` or `check-dist-layering.mjs`. Source-level regex check, same idiom
 * as `styles.floor.test.ts`'s direct read of shipped text — independent of oxlint, which only runs
 * over changed files locally and could be skipped.
 *
 * The pattern matches an actual import/re-export specifier, not any mention of "@mantine" in
 * prose — this module's own doc comments say "Mantine-free" and name `@mantine/*` on purpose.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const WIDGET_HEADER_DIR = dirname(fileURLToPath(import.meta.url))
const MANTINE_IMPORT = /(?:from|import)\s*\(?\s*['"]@mantine\//

const sourceFiles = readdirSync(WIDGET_HEADER_DIR).filter(
  (name) =>
    (name.endsWith('.ts') || name.endsWith('.tsx')) &&
    !name.endsWith('.test.ts') &&
    !name.endsWith('.test.tsx'),
)

describe('src/widget-header — Mantine-free', () => {
  for (const name of sourceFiles) {
    test(`${name} imports no '@mantine/*' module`, () => {
      const text = readFileSync(join(WIDGET_HEADER_DIR, name), 'utf8')
      expect(text).not.toMatch(MANTINE_IMPORT)
    })
  }
})
