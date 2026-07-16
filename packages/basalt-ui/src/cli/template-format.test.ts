/**
 * Format-idempotency for every shipped template that lands in a consumer VERBATIM — the `copy` and
 * `block` managed-file strategies (see `./index.ts`'s `managedFiles()`). `seed` templates are
 * excluded: they are a one-time starting point the consumer immediately owns and may reformat
 * however they like, so their shipped formatting is not load-bearing.
 *
 * basalt-ui itself MANDATES oxfmt in the shipped lefthook/CI templates — so if a shipped `copy`/
 * `block` template's bytes are not already oxfmt-clean, the first thing a consumer does (run
 * `basalt sync`, or just commit) puts oxlint/oxfmt and `sync --check` in permanent disagreement:
 * `basalt sync` writes the drifted bytes, the lefthook pre-commit hook's own `oxfmt --check`
 * rejects the commit, running `oxfmt` to fix it re-drifts the file from what `sync --check`
 * expects. This is exactly how `CLAUDE-block.md.tpl` shipped: no blank line after
 * `<!-- basalt:begin -->`, which oxfmt's own block-HTML-comment rule then rewrites, re-triggering
 * drift forever. Assert every copy/block template round-trips through the exact oxfmt binary +
 * config basalt-ui ships, unchanged — this class of "basalt's own gates fighting each other" bug
 * must not recur.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { RULE_NAMES } from './index'

const PKG_ROOT = resolve(import.meta.dir, '../..')
const REPO_ROOT = resolve(PKG_ROOT, '../..')
const OXFMT_BIN = resolve(REPO_ROOT, 'node_modules/.bin/oxfmt')
const OXFMT_CONFIG = resolve(PKG_ROOT, 'configs/oxfmt.json')

/** Format `content` through the exact oxfmt binary + config basalt-ui ships; assert it is a no-op. */
function expectOxfmtNoop(fileName: string, content: string): void {
  const result = spawnSync(OXFMT_BIN, ['--stdin-filepath', fileName, '-c', OXFMT_CONFIG], {
    input: content,
    encoding: 'utf8',
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toBe(content)
}

describe('shipped copy/block templates are oxfmt-clean', () => {
  it('CLAUDE-block.md.tpl (block strategy) round-trips unchanged with placeholders filled', () => {
    const tpl = readFileSync(resolve(PKG_ROOT, 'agent/templates/CLAUDE-block.md.tpl'), 'utf8')
    const filled = tpl
      .replace(/\{\{BASALT_VERSION\}\}/g, '1.0.0')
      .replace(/\{\{APP_NAME\}\}/g, 'app')
    expectOxfmtNoop('CLAUDE.md', filled)
  })

  it.each(RULE_NAMES)('agent/rules/basalt-%s.md (copy strategy) round-trips unchanged', (name) => {
    const content = readFileSync(resolve(PKG_ROOT, `agent/rules/basalt-${name}.md`), 'utf8')
    expectOxfmtNoop(`basalt-${name}.md`, content)
  })

  it('configs/oxfmt.json (copy strategy, scaffolded as .oxfmtrc.json) round-trips unchanged', () => {
    const content = readFileSync(resolve(PKG_ROOT, 'configs/oxfmt.json'), 'utf8')
    expectOxfmtNoop('.oxfmtrc.json', content)
  })
})
