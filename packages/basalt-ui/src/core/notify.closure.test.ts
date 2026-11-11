/**
 * Provider closure for `notify` (docs/v3/concepts/state-persistence-forms.md, acceptance): the
 * provider-only fixture's module graph holds neither the notify queue nor the toast host. The
 * positive control puts `notify` next to the provider and must go red, or green proves nothing.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BASE0, FIXTURE, bundleApp } from '../../scripts/check-budgets/provider-v3'

const NOTIFY = /(?:^|\/)(?:core\/notify|page\/toast-host|ui\/toast)(?:[./]|$)/

const scratch = mkdtempSync(join(tmpdir(), 'notify-closure-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
beforeAll(async () => {
  await bundleApp(BASE0)
}, 60_000)

const hits = (graph: readonly string[]): string[] =>
  graph.map((id) => id.replaceAll('\\', '/')).filter((id) => NOTIFY.test(id))

describe('notify closure', () => {
  test('the provider-only fixture reaches no notify module and no toast chunk', async () => {
    expect(hits((await bundleApp(FIXTURE)).graph)).toEqual([])
  }, 60_000)

  test('control: notify imported next to the provider is found', async () => {
    writeFileSync(
      join(scratch, 'entry.ts'),
      [
        `export { BasaltProvider } from ${JSON.stringify(join(FIXTURE, '../../../src/core/provider'))}`,
        `export { notify } from ${JSON.stringify(join(FIXTURE, '../../../src/core/notify'))}`,
      ].join('\n'),
    )
    expect(hits((await bundleApp(join(scratch, 'entry.ts'))).graph).length).toBeGreaterThan(0)
  }, 60_000)
})
