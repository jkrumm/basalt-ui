import { readFileSync } from 'node:fs'
import { Generator, getConfig } from '@tanstack/router-generator'

/**
 * Runs the TanStack file-route generator over `src/routes` and writes the route tree to
 * `generatedRouteTree`. `bun codegen.ts` regenerates the committed `src/route-tree.gen.ts`;
 * `run.ts` regenerates it in place and reports whether the bytes changed. The file is not named
 * `routeTree.gen.ts` because the repo's root .gitignore ignores that name.
 */
export async function generateRouteTree(root: string, generatedRouteTree: string): Promise<string> {
  const config = getConfig(
    {
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree,
      disableLogging: true,
      quoteStyle: 'single',
      semicolons: false,
    },
    root,
  )
  await new Generator({ config, root }).run()
  return readFileSync(`${root}/${generatedRouteTree}`, 'utf8')
}
