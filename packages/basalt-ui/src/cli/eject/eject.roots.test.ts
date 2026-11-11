/**
 * eject.roots on the argo-shaped (nested root) and two-app shutterflow-shaped fixtures: `--app` is
 * required with 2+ roots, and the file, base, paths row, alias and ceiling all stay per root.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveConfig } from 'vite'
import type { Alias } from 'vite'

import {
  cleanup,
  commitAll,
  makeConsumer,
  read,
  run,
  snapshot,
} from '../../../test/fixtures/eject/harness'

afterEach(cleanup)

const aliasOf = async (appDir: string): Promise<string[]> => {
  const config = await resolveConfig(
    { root: appDir, configFile: join(appDir, 'vite.config.mjs'), logLevel: 'silent' },
    'build',
  )
  return (config.resolve.alias as Alias[])
    .map((a) => (typeof a.find === 'string' ? `${a.find} -> ${a.replacement}` : ''))
    .filter((a) => a.startsWith('basalt-ui/'))
}

describe('eject.roots (shutterflow, two apps)', () => {
  it('without --app exits 1 listing the roots, writing nothing', () => {
    const fx = makeConsumer('shutterflow')
    const before = snapshot(fx.dir)
    const result = run(fx, ['button', '--reason', 'r'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('apps/desktop/src, apps/gallery/src')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('an --app that is not a root exits 1 listing the roots', () => {
    const fx = makeConsumer('shutterflow')
    const result = run(fx, ['button', '--reason', 'r', '--app', 'apps/web/src'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('Roots: apps/desktop/src, apps/gallery/src')
  })

  it('keeps file, base, paths, alias and ceiling per root', async () => {
    const fx = makeConsumer('shutterflow')
    for (const name of ['button', 'input', 'switch', 'tabs']) {
      expect(run(fx, [name, '--reason', 'desktop chrome', '--app', 'apps/desktop/src']).code).toBe(
        0,
      )
    }
    const gallery = run(fx, ['button', '--reason', 'gallery CTA', '--app', 'apps/gallery/src/'])
    expect(gallery.code).toBe(0)
    // desktop is over its 3 (counted, not refused, before 3.0.0); gallery counts on its own.
    expect(gallery.log).toContain('ejects in apps/gallery/src: 1 of 3')
    const fourth = run(fx, ['field', '--reason', 'r', '--app', 'apps/desktop/src'])
    expect(fourth.log).toContain('ejects in apps/desktop/src: 5 of 3')
    expect(fourth.log).toContain('Over the ceiling')

    expect(existsSync(join(fx.dir, 'apps/desktop/src/components/ui/button.tsx'))).toBe(true)
    expect(existsSync(join(fx.dir, 'apps/gallery/src/components/ui/button.tsx'))).toBe(true)
    expect(existsSync(join(fx.dir, '.basalt/base/apps-desktop-src/button.tsx'))).toBe(true)
    expect(existsSync(join(fx.dir, '.basalt/base/apps-gallery-src/button.tsx'))).toBe(true)
    expect(read(fx.dir, 'apps/gallery/src/components/ui/button.tsx')).toContain('gallery CTA')

    const desktopTs = read(fx.dir, 'apps/desktop/tsconfig.app.json')
    const galleryTs = read(fx.dir, 'apps/gallery/tsconfig.app.json')
    expect(desktopTs).toContain('"basalt-ui/ui/tabs": ["./src/components/ui/tabs.tsx"]')
    expect(galleryTs).toContain('"basalt-ui/ui/button": ["./src/components/ui/button.tsx"]')
    expect(galleryTs).not.toContain('basalt-ui/ui/tabs')

    expect(await aliasOf(join(fx.dir, 'apps/gallery'))).toEqual([
      `basalt-ui/ui/button -> ${join(fx.dir, 'apps/gallery/src/components/ui/button.tsx')}`,
    ])
    expect(await aliasOf(join(fx.dir, 'apps/desktop'))).toHaveLength(5)
  })

  it('--undo in one root leaves the other root as it was', () => {
    const fx = makeConsumer('shutterflow', { git: true })
    expect(run(fx, ['button', '--reason', 'r', '--app', 'apps/desktop/src']).code).toBe(0)
    expect(run(fx, ['button', '--reason', 'r', '--app', 'apps/gallery/src']).code).toBe(0)
    commitAll(fx.dir, 'ejects')
    const gallery = read(fx.dir, 'apps/gallery/tsconfig.app.json')
    expect(run(fx, ['button', '--undo']).code).toBe(1)
    expect(run(fx, ['button', '--undo', '--app', 'apps/desktop/src']).code).toBe(0)
    expect(existsSync(join(fx.dir, 'apps/desktop/src/components'))).toBe(false)
    expect(read(fx.dir, 'apps/gallery/tsconfig.app.json')).toBe(gallery)
    expect(existsSync(join(fx.dir, '.basalt/base/apps-gallery-src/button.tsx'))).toBe(true)
  })
})

describe('eject.roots (argo, nested root)', () => {
  it('writes under the declared root, the base under its dashed name and paths in tsconfig.app.json', () => {
    const fx = makeConsumer('argo')
    const result = run(fx, ['button', '--reason', 'dense toolbar'], join(fx.dir, 'apps/dashboard'))
    expect(result.code).toBe(0)
    expect(existsSync(join(fx.dir, 'apps/dashboard/src/components/ui/button.tsx'))).toBe(true)
    expect(existsSync(join(fx.dir, '.basalt/base/apps-dashboard-src/button.tsx'))).toBe(true)
    const app = read(fx.dir, 'apps/dashboard/tsconfig.app.json')
    expect(app).toContain("// the dashboard's own alias; an eject row goes beside it")
    expect(app).toContain(
      '"paths": {\n      "basalt-ui/ui/button": ["./src/components/ui/button.tsx"], "@/*": ["./src/*"] }',
    )
    expect(read(fx.dir, 'apps/dashboard/tsconfig.json')).not.toContain('basalt-ui')
  })

  it('a tsconfig that extends another and sets no paths exits 1 printing the line', () => {
    const fx = makeConsumer('argo')
    writeFileSync(
      join(fx.dir, 'apps/dashboard/tsconfig.app.json'),
      '{ "extends": "../../tsconfig.base.json", "compilerOptions": { "jsx": "react-jsx" } }\n',
    )
    const before = snapshot(fx.dir)
    const result = run(fx, ['button', '--reason', 'r'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('"basalt-ui/ui/button": ["./src/components/ui/button.tsx"]')
    expect(snapshot(fx.dir)).toEqual(before)
  })
})
