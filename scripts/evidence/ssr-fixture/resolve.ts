/**
 * The fixture's dependencies (`react`, `@tanstack/react-router`, `basalt-ui` …) are the playground's:
 * `scripts/` has no `node_modules` of its own. This plugin resolves every such bare import from the
 * playground package — through `Bun.resolveSync`, so the packages' `exports` conditions apply — for
 * both `Bun.build` bundles (client and server). A runtime `Bun.plugin` does not intercept bare
 * specifiers, which is why the server is bundled rather than imported from source.
 */
import { resolve } from 'node:path'

const PLAYGROUND = resolve(import.meta.dirname, '../../../apps/playground')
const FIXTURE_DIR = import.meta.dirname + '/'
const BARE = /^(?:react|react-dom|basalt-ui|isbot|@mantine\/[\w-]+|@tanstack\/[\w-]+)(?:\/|$)/

export const playgroundResolver: Bun.BunPlugin = {
  name: 'ssr-fixture-playground-resolver',
  setup(build) {
    build.onResolve({ filter: BARE }, (args) => {
      if (!args.importer.startsWith(FIXTURE_DIR)) return undefined
      return { path: Bun.resolveSync(args.path, PLAYGROUND) }
    })
  },
}
