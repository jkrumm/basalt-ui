/**
 * The fixture's dependencies (`react`, `@tanstack/react-router`, `basalt-ui` …) are the playground's:
 * `scripts/` has no `node_modules` of its own. This plugin resolves every such bare import from the
 * playground package — through `Bun.resolveSync`, so the packages' `exports` conditions apply — for
 * both the server import (`Bun.plugin`) and the client bundle (`Bun.build`).
 */
import { resolve } from 'node:path'

const PLAYGROUND = resolve(import.meta.dirname, '../../../apps/playground')
const FIXTURE_DIR = import.meta.dirname
const BARE =
  /^(?:react|react-dom|basalt-ui|@mantine\/[\w-]+|@tanstack\/[\w-]+|isbot|seroval[\w-]*)(?:\/|$)|^(?:react|react-dom|basalt-ui|isbot)$/

export const playgroundResolver: Bun.BunPlugin = {
  name: 'ssr-fixture-playground-resolver',
  setup(build) {
    build.onResolve({ filter: BARE }, (args) => {
      if (!args.importer.startsWith(FIXTURE_DIR)) return undefined
      return { path: Bun.resolveSync(args.path, PLAYGROUND) }
    })
  },
}
