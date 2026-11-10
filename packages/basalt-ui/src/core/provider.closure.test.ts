/**
 * Provider closure (docs/v3/concepts/state-persistence-forms.md: "`BasaltProvider` closure excludes
 * `persisted` and Base UI Toast"). The fixture's whole module graph, tree-shaken modules included,
 * holds neither. The positive control imports a stub `persisted.ts` and a Base UI Toast path next to
 * the real provider: the closure test must go red on it, or a green result proves nothing.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BASE0, FIXTURE, bannedIn, bundleApp } from '../../scripts/check-budgets/provider-v3'
import type { AppBundle } from '../../scripts/check-budgets/provider-v3'

const CLOSURE = /^(?:persisted|base-ui-toast): /

const scratch = mkdtempSync(join(tmpdir(), 'provider-closure-'))
let base0: AppBundle

beforeAll(async () => {
  base0 = await bundleApp(BASE0)
}, 60_000)
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const closureOf = (app: AppBundle): string[] => bannedIn(app, base0).filter((l) => CLOSURE.test(l))

describe('provider closure', () => {
  test('the real fixture reaches no persisted module and no Base UI Toast', async () => {
    expect(closureOf(await bundleApp(FIXTURE))).toEqual([])
  })

  test('control: a stub persisted.ts imported next to the provider is found', async () => {
    writeFileSync(join(scratch, 'persisted.ts'), 'export const persisted = () => 1\n')
    writeFileSync(
      join(scratch, 'entry.ts'),
      [
        `export { BasaltProvider } from ${JSON.stringify(join(FIXTURE, '../../../src/core/provider'))}`,
        `export { persisted } from './persisted'`,
      ].join('\n'),
    )
    const hits = closureOf(await bundleApp(join(scratch, 'entry.ts')))
    expect(hits.some((l) => l.startsWith('persisted: ') && l.endsWith('/persisted.ts'))).toBe(true)
  }, 60_000)

  test('control: a Base UI Toast module in the graph is found', async () => {
    const toast = join(scratch, 'node_modules/@base-ui/react/toast')
    mkdirSync(toast, { recursive: true })
    writeFileSync(join(toast, 'index.js'), 'export const Toast = 1\n')
    writeFileSync(
      join(scratch, 'toast-entry.ts'),
      `export { Toast } from './node_modules/@base-ui/react/toast/index.js'\n`,
    )
    const hits = closureOf(await bundleApp(join(scratch, 'toast-entry.ts')))
    expect(hits.some((l) => l.startsWith('base-ui-toast: '))).toBe(true)
  }, 60_000)
})
