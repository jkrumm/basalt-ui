/**
 * `basalt()` over the fixtures in test/fixtures/vite: programmatic Vite builds, no dev server.
 * Peer and seed gates at buildStart, the eject config (present only with ejects, and an SSR build
 * that resolves through it), sources.css and the head.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, resolveConfig } from 'vite'
import type { InlineConfig, ResolvedConfig } from 'vite'

import { themeScript } from '../css/theme-script'
import {
  EDIT,
  PARTS_PEERS,
  cleanup,
  eject,
  makeApp,
  read,
  readManifest,
  writeManifest,
} from '../../test/fixtures/vite/harness'
import type { App } from '../../test/fixtures/vite/harness'
import { basalt } from './index'

type BasaltOptions = Parameters<typeof basalt>[0]

afterEach(cleanup)

const config = (app: App, extra: InlineConfig = {}, options?: BasaltOptions): InlineConfig => ({
  root: app.dir,
  configFile: false,
  logLevel: 'silent',
  plugins: [basalt(options)],
  ...extra,
})

const failure = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run
  } catch (err) {
    return (err as Error).message
  }
  throw new Error('expected the build to fail')
}

/** The alias entries, `ssr.noExternal` and `optimizeDeps.exclude` that name basalt-ui. */
function basaltConfig(resolved: ResolvedConfig): {
  alias: string[]
  noExternal: unknown
  exclude: string[]
} {
  const alias = resolved.resolve.alias
    .map((entry) => String(entry.find))
    .filter((find) => find.includes('basalt-ui'))
  const noExternal = resolved.ssr.noExternal
  const exclude = (resolved.optimizeDeps.exclude ?? []).filter((id) => id.includes('basalt-ui'))
  return { alias, noExternal, exclude }
}

describe('peer gate', () => {
  it('a fixture importing basalt-ui/ui/date-picker without react-day-picker fails naming bun add', async () => {
    const app = makeApp('date-picker')
    const message = await failure(build(config(app)))
    expect(message).toContain('basalt-ui/ui/date-picker needs react-day-picker')
    expect(message).toContain('bun add react-day-picker')
  })

  it('names every missing peer of the closure in one command', async () => {
    const app = makeApp('parts', ['react', 'class-variance-authority', 'clsx'])
    const message = await failure(build(config(app)))
    expect(message).toContain('bun add @base-ui/react react-dom')
  })
})

describe('seed gate', () => {
  it('an unchanged digest builds; a bumped one fails naming basalt-ui sync', async () => {
    const app = makeApp('parts')
    eject(app, 'button')
    await build(config(app))

    const manifest = readManifest(app)
    const row = manifest.ejected['src#button'] as Record<string, unknown>
    manifest.ejected['src#button'] = { ...row, seedDigest: '0'.repeat(64) }
    writeManifest(app, manifest)
    const message = await failure(build(config(app)))
    expect(message).toContain('src/components/ui/button.tsx')
    expect(message).toContain('Run: basalt-ui sync')
  })

  it('skips origin local, which records no digest', async () => {
    const app = makeApp('parts')
    eject(app, 'button')
    const manifest = readManifest(app)
    const row = manifest.ejected['src#button'] as Record<string, unknown>
    manifest.ejected['src#button'] = { ...row, seedDigest: null, origin: 'local' }
    writeManifest(app, manifest)
    await build(config(app))
  })
})

describe('eject config', () => {
  it('a no-ejects fixture gets no alias, no ssr.noExternal and no optimizeDeps.exclude from basalt()', async () => {
    const app = makeApp('parts')
    const resolved = await resolveConfig(config(app), 'build')
    const without = await resolveConfig({ ...config(app), plugins: [] }, 'build')
    const seen = basaltConfig(resolved)
    expect(seen.alias).toEqual([])
    expect(seen.exclude).toEqual([])
    expect(seen.noExternal).toBeUndefined()
    expect(resolved.ssr.noExternal).toEqual(without.ssr.noExternal)
    expect(resolved.optimizeDeps.exclude).toEqual(without.optimizeDeps.exclude)
    expect(resolved.resolve.alias).toEqual(without.resolve.alias)
  })

  it('an ejected fixture gets the alias, ssr.noExternal and optimizeDeps.exclude; its SSR build resolves', async () => {
    const app = makeApp('parts')
    eject(app, 'button')
    const resolved = await resolveConfig(config(app), 'build')
    const seen = basaltConfig(resolved)
    expect(seen.alias).toEqual(['/^basalt-ui\\/ui\\/button$/'])
    expect(resolved.resolve.alias.find((a) => String(a.find).includes('button'))?.replacement).toBe(
      join(app.dir, 'src/components/ui/button.tsx'),
    )
    expect(seen.noExternal).toEqual(['basalt-ui'])
    expect(seen.exclude).toContain('basalt-ui/cards')
    expect(seen.exclude).toContain('basalt-ui/core/cn')
    expect(seen.exclude).toContain('basalt-ui/page')

    await build(config(app, { build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr' } }))
    const server = (await import(
      pathToFileURL(join(app.dir, 'dist-ssr/entry-server.js')).href
    )) as {
      render: () => string
    }
    const html = server.render()
    // The npm composite renders the LOCAL button: the alias reached code inside node_modules.
    const saveBar = /<div data-slot="save-bar">(.*?)<\/div>/.exec(html)?.[1] ?? ''
    expect(saveBar).toContain(EDIT)
    expect(html.split(EDIT).length - 1).toBe(2)
  }, 60_000)
})

describe('.basalt/sources.css', () => {
  it('is regenerated byte-identically and lists @source not for each unused ui module', async () => {
    const app = makeApp('parts')
    await build(config(app))
    const first = read(app.dir, '.basalt/sources.css')
    await build(config(app))
    expect(read(app.dir, '.basalt/sources.css')).toBe(first)

    const ui = '../node_modules/basalt-ui/src/ui'
    expect(first).toContain(`@source "${ui}";`)
    expect(first).toContain('@source "../node_modules/basalt-ui/src/cards";')
    expect(first).toContain('@source "../node_modules/basalt-ui/src/core";')
    expect(first).not.toContain(`@source not "${ui}/button.*";`)
    for (const unused of ['accordion', 'dialog', 'select', 'tabs']) {
      expect(first).toContain(`@source not "${ui}/${unused}.*";`)
    }
  })

  it('excludes the npm copy of an ejected module', async () => {
    const app = makeApp('parts')
    eject(app, 'button')
    await build(config(app))
    expect(read(app.dir, '.basalt/sources.css')).toContain(
      '@source not "../node_modules/basalt-ui/src/ui/button.*";',
    )
  })

  it('a stale file is rewritten', async () => {
    const app = makeApp('parts')
    await build(config(app))
    const fresh = read(app.dir, '.basalt/sources.css')
    writeManifest(app, readManifest(app))
    await Bun.write(join(app.dir, '.basalt/sources.css'), '@source "../stale";\n')
    await build(config(app))
    expect(read(app.dir, '.basalt/sources.css')).toBe(fresh)
  })
})

describe('head', () => {
  it('index.html carries the theme script once and no inline anti-FOUC style', async () => {
    const app = makeApp('parts')
    await build(config(app))
    const html = read(app.dir, 'dist/index.html')
    expect(html.split(themeScript()).length - 1).toBe(1)
    expect(html).not.toContain('<style')
    expect(html).not.toContain('data-basalt-boot')
    expect(html.indexOf('<meta charset="UTF-8"')).toBeLessThan(html.indexOf('<script'))
    expect(html).toContain('<meta name="theme-color" media="(prefers-color-scheme: light)"')
  })

  it('with app it emits the manifest, its link and the declared icons', async () => {
    const app = makeApp('parts')
    await build(
      config(
        app,
        {},
        {
          app: { name: 'Fixture', icons: [{ src: '/favicon.svg', sizes: 'any', rel: 'icon' }] },
        },
      ),
    )
    const html = read(app.dir, 'dist/index.html')
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest">')
    expect(html).toContain('<link rel="icon" sizes="any" href="/favicon.svg">')
    const manifest = JSON.parse(read(app.dir, 'dist/site.webmanifest')) as Record<string, unknown>
    expect(manifest['name']).toBe('Fixture')
    expect(manifest['icons']).toEqual([{ src: '/favicon.svg', sizes: 'any' }])
  })

  it('themeScript: false leaves the script out', async () => {
    const app = makeApp('parts', PARTS_PEERS)
    await build(config(app, {}, { themeScript: false, themeColor: false }))
    const html = read(app.dir, 'dist/index.html')
    expect(html).not.toContain(themeScript())
    expect(html).not.toContain('theme-color')
  })
})
