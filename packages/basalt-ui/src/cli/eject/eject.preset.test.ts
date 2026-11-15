/**
 * eject rewrites the consumer's `.oxlintrc.basalt.json`, so the zone E block for an ejected file is
 * there the moment the file exists (lint cycle 1, lint-1.3); `--undo` takes it out again.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  PKG_ROOT,
  cleanup,
  commitAll,
  makeConsumer,
  read,
  run,
} from '../../../test/fixtures/eject/harness'
import { OXLINT_PRESET_FILE } from '../presets'

afterEach(cleanup)

type Override = { files: string[]; rules: Record<string, unknown> }
const overridesOf = (dir: string): Override[] =>
  (JSON.parse(read(dir, OXLINT_PRESET_FILE)) as { overrides: Override[] }).overrides

describe('eject and the oxlint preset', () => {
  it('writes zone E for the ejected file and removes it on --undo', () => {
    const fx = makeConsumer('linewatch', { git: true })
    mkdirSync(join(fx.pkg, 'configs'), { recursive: true })
    for (const profile of ['bridge', 'parts', 'app']) {
      const file = `configs/oxlint-${profile}.json`
      cpSync(join(PKG_ROOT, file), join(fx.pkg, file))
    }
    writeFileSync(join(fx.dir, OXLINT_PRESET_FILE), '{}\n')

    expect(run(fx, ['button', '--reason', 'pill size']).code).toBe(0)
    const path = 'src/components/ui/button.tsx'
    const zone = overridesOf(fx.dir).find((o) => o.files.includes(path))
    expect(zone?.rules).toMatchObject({ 'shadcn/no-restyle': 'off', 'basalt/app-spacing': 'off' })
    expect(overridesOf(fx.dir).some((o) => 'basalt/import-boundary' in o.rules)).toBe(true)

    commitAll(fx.dir, 'eject button')
    expect(run(fx, ['button', '--undo']).code).toBe(0)
    expect(overridesOf(fx.dir)).toEqual([])
  })
})
