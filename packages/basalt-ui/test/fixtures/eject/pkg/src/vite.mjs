// Stand-in for v3 `basalt()` (v3-prim-p9 builds the real one): with ejects in this app's root it
// aliases `basalt-ui/ui/<name>` to the local file and bundles basalt-ui for SSR; with none, nothing.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

export function basalt() {
  return {
    name: 'basalt-fixture',
    config(config) {
      const appRoot = resolve(config.root ?? process.cwd())
      let dir = appRoot
      while (!existsSync(join(dir, '.basalt/manifest.json'))) {
        const up = dirname(dir)
        if (up === dir) return undefined
        dir = up
      }
      const manifest = JSON.parse(readFileSync(join(dir, '.basalt/manifest.json'), 'utf8'))
      const prefix = relative(dir, appRoot)
      const alias = Object.entries(manifest.ejected ?? {})
        .filter(([, row]) => row.origin !== 'local')
        .filter(([, row]) => prefix === '' || row.path.startsWith(`${prefix}/`))
        .map(([key, row]) => ({
          find: `basalt-ui/ui/${key.slice(key.lastIndexOf('#') + 1)}`,
          replacement: join(dir, row.path),
        }))
      if (alias.length === 0) return undefined
      return { resolve: { alias }, ssr: { noExternal: ['basalt-ui'] } }
    },
  }
}
