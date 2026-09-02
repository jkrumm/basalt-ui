/**
 * `dashboard/widget-header.tsx` and `dashboard/delta-badge.tsx` must stay Mantine-free
 * (docs/CONTROLS-SPEC.md §2.2) — so `ChartCard` (inside the `charts/` boundary) can compose
 * `WidgetHeader`/`DeltaBadge` without tripping `basalt/token-layer-boundary` or
 * `check-dist-layering.mjs`. Source-level regex check, same idiom as `styles.floor.test.ts`'s
 * direct read of shipped text — independent of oxlint, which only runs over changed files locally
 * and could be skipped.
 *
 * Named explicitly, not scanned off the containing directory — `dashboard/` also holds Mantine-
 * coupled siblings (StatCard, QueryState, SettingsSection, Section, …) since the C1 consolidation
 * merged `section/` + `widget-header/` into it, so a directory-wide scan would false-positive on
 * every one of them.
 *
 * The pattern matches an actual import/re-export specifier, not any mention of "@mantine" in
 * prose — these modules' own doc comments say "Mantine-free" and name `@mantine/*` on purpose.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const DASHBOARD_DIR = dirname(fileURLToPath(import.meta.url))
const MANTINE_IMPORT = /(?:from|import)\s*\(?\s*['"]@mantine\//

const MANTINE_FREE_FILES = ['widget-header.tsx', 'delta-badge.tsx']

describe('dashboard — WidgetHeader/DeltaBadge stay Mantine-free', () => {
  for (const name of MANTINE_FREE_FILES) {
    test(`${name} imports no '@mantine/*' module`, () => {
      const text = readFileSync(join(DASHBOARD_DIR, name), 'utf8')
      expect(text).not.toMatch(MANTINE_IMPORT)
    })
  }
})
