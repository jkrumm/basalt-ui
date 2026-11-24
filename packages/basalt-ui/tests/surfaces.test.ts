/**
 * SURFACES states facts llms.txt, `info` and `doctor` print: the rule names must be the shipped rule
 * files, and every doctrine row must name one. The peers each subpath reaches are held against the
 * built graph by the `surface-peers` budget row (`scripts/surface-gates.ts` `surfacePeerDrift`).
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

import { RULE_NAMES, SURFACES } from '../src/surfaces'

const RULES_DIR = join(import.meta.dir, '..', 'agent/rules')

describe('SURFACES', () => {
  test('RULE_NAMES and the site rule are exactly the shipped agent/rules/basalt-<name>.md files', () => {
    const onDisk = readdirSync(RULES_DIR)
      .filter((f) => /^basalt-[a-z]+\.md$/.test(f))
      .map((f) => f.slice('basalt-'.length, -'.md'.length))
      .toSorted()
    // `site` is the site profile's own rule (src/cli/sync/render.ts `SITE_AGENT_SET`), not a doctrine row's.
    expect<string[]>([...RULE_NAMES, 'site'].toSorted()).toEqual(onDisk)
  })

  test('no subpath is labelled headless while it renders React parts', () => {
    for (const key of ['./page', './cards', './ui/*', './core/*', './motion', './ai']) {
      expect(SURFACES[key as keyof typeof SURFACES].layer).toBe('ui')
    }
  })
})
