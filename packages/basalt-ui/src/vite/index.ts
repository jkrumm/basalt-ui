/**
 * `basalt-ui/vite`: `basalt()`, the v3 Vite plugin (docs/v3/ARCHITECTURE.md 4.3). It runs where CI
 * does not, in deploy builds:
 *
 * - At build start it fails naming the exact command on a missing peer of an imported subpath
 *   (`bun add …`) and on an ejected file whose recorded seed digest differs from the installed
 *   seed (`basalt-ui sync`).
 * - With ejects in this app it aliases `basalt-ui/ui/<name>` to the local file, bundles basalt-ui
 *   for SSR (`ssr.noExternal`) and keeps the composite subpaths out of the dep optimizer; with none
 *   it sets none of these.
 * - It regenerates `<root>/.basalt/sources.css` each run.
 * - It owns the head: the theme script, the theme-color pair and, with an app config, the manifest.
 *
 * `basalt()` replaces the 2.x head plugin on this entry (src/vite.ts keeps the 2.x source); the
 * 2.x `basaltViteConfig` stays exported until its migration row retires it.
 */
import { relative, resolve } from 'node:path'
import type { Plugin, PluginOption, UserConfig } from 'vite'

import { ALLOTMENT } from './allotment.gen'
import { appEjects, staleEjects } from './ejects'
import type { AppEjects } from './ejects'
import {
  closureOf,
  hasPackage,
  installedPackage,
  packageGraph,
  requiredPeers,
  scanImports,
  shippedPrimitives,
} from './graph'
import { headPlugin, serviceWorkerPlugins } from './head'
import type { HeadOptions } from './head'
import { renderSources, writeSources } from './sources'

export { basaltViteConfig } from '../vite'

/** Not exported (the type budget is full): read it as `Parameters<typeof basalt>[0]`. */
type BasaltOptions = HeadOptions & {
  /** Write `.basalt/sources.css`. Default `true`; `false` for an app that lists its own sources. */
  sources?: boolean
}

/** The `basalt-ui` specifier of each composite subpath: what the dep optimizer must not pre-bundle. */
const COMPOSITE_SPECIFIERS = ALLOTMENT.composites.map((dir) => `basalt-ui/${dir}`)

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** What `basalt()` adds to the config for the app's ejects; nothing at all when there are none. */
function ejectConfig(ejects: AppEjects): UserConfig | null {
  if (ejects.ejected.length === 0) return null
  return {
    resolve: {
      alias: ejects.ejected.map(({ name, file }) => ({
        find: new RegExp(`^${escape(`basalt-ui/ui/${name}`)}$`),
        replacement: file,
      })),
    },
    ssr: { noExternal: ['basalt-ui'] },
    optimizeDeps: { exclude: [...COMPOSITE_SPECIFIERS] },
  }
}

/** The peer failure text: the imports that need each missing peer, then the one command. */
function missingPeersMessage(missing: ReadonlyMap<string, string>): string {
  const lines = [...missing].map(([peer, via]) => `  ${via} needs ${peer}`)
  return (
    `basalt-ui: an imported subpath's peer is not installed.\n${lines.join('\n')}\n` +
    `Run: bun add ${[...missing.keys()].join(' ')}`
  )
}

/** The seed failure text; `where` is the install root relative to the Vite root, '' when equal. */
function staleSeedsMessage(stale: AppEjects['ejected'], where: string): string {
  const lines = stale.map(
    ({ name, row }) =>
      `  ${row.path} (${name}@${row.fromVersion}): recorded seedDigest ` +
      `${row.seedDigest?.slice(0, 12)}…, the installed seed differs`,
  )
  return (
    `basalt-ui: an ejected primitive's seed changed in the installed basalt-ui.\n${lines.join('\n')}\n` +
    `Run: basalt-ui sync${where === '' ? '' : ` (in ${where})`}`
  )
}

/**
 * The v3 Vite plugin: fails the build on a missing peer (`bun add …`) or a stale ejected seed
 * (`basalt-ui sync`), aliases ejected primitives, writes `.basalt/sources.css` and owns the head
 * (theme script, theme-color, manifest). Full contract: `docs/vite.md`.
 *
 * @useWhen a Vite app imports basalt-ui v3 subpaths, at profile `parts` or `app`
 * @neverWhen the app is not built with Vite; it then lists its own Tailwind sources
 *
 * @example
 * ```ts
 * export default { plugins: [react(), tailwindcss(), basalt({ app: { name: 'Argo' } })] }
 * ```
 */
export function basalt(options: BasaltOptions = {}): PluginOption[] {
  let root = process.cwd()
  let ejects: AppEjects = { installRoot: null, ejected: [] }

  const main: Plugin = {
    name: 'basalt',
    enforce: 'pre',
    config(config) {
      root = resolve(config.root ?? process.cwd())
      ejects = appEjects(root)
      return ejectConfig(ejects)
    },
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      const pkgRoot = installedPackage(root)
      const imports = scanImports(root)
      const graph = packageGraph(pkgRoot)
      const closure = closureOf(imports, graph)

      const missing = new Map(
        [...requiredPeers(closure)].filter(([peer]) => !hasPackage(root, peer)).toSorted(),
      )
      if (missing.size > 0) this.error(missingPeersMessage(missing))

      const stale = staleEjects(ejects.ejected, pkgRoot)
      if (stale.length > 0) {
        this.error(staleSeedsMessage(stale, relative(root, ejects.installRoot ?? root)))
      }

      if (options.sources === false) return
      const css = renderSources({
        appRoot: root,
        pkgRoot,
        closure,
        shipped: shippedPrimitives(pkgRoot),
        ejected: ejects.ejected.map((e) => e.name),
      })
      writeSources(root, css)
    },
  }

  const plugins: PluginOption[] = [main, headPlugin(options)]
  const serviceWorker = options.app?.serviceWorker
  if (serviceWorker !== undefined && serviceWorker !== false) {
    plugins.push(serviceWorkerPlugins(serviceWorker))
  }
  return plugins
}
