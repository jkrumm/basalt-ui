/**
 * The route tree and the scripts that read it. `src/routeTree.gen.ts` is written by TanStack
 * Router's generator, which the router plugin runs on the first `vite` run and on every route file
 * after it; a `tsc` that runs before that reads a missing or stale tree and fails on the nav and the
 * pages, not on the tree. `init` writes the first tree and swaps create-vite's `tsc -b && vite
 * build`; `doctor` check 12 flags a script that still type-checks first.
 */
import { createRequire } from 'node:module'

/** The router plugin's options `init` writes into the Vite config; the generator reads the same. */
export const ROUTER_PLUGIN_OPTIONS = { target: 'react', autoCodeSplitting: true } as const

const SEGMENT = /&&|\|\||;/
const TSC = /(?:^|[\s/])tsc(?:\s|$)/
/** A command that runs the generator: a Vite run (the plugin generates) or the generator CLI. */
const GENERATES = /(?:^|[\s/])(?:vite(?:\s+(?!preview\b)|$)|tsr\s+generate\b)/

/** True when a `tsc` command runs in `script` before any command that generates the route tree. */
export function typechecksBeforeTree(script: string): boolean {
  for (const raw of script.split(SEGMENT)) {
    const command = raw.trim()
    if (GENERATES.test(command)) return false
    if (TSC.test(command)) return true
  }
  return false
}

/** create-vite's `tsc -b && vite build`, with whatever flags each side carries. */
const STOCK_BUILD = /^(tsc(?:\s+[^&|;]*)?)\s*&&\s*(vite\s+build(?:\s+[^&|;]*)?)$/

/** The stock build script with the Vite run first, or null when the script is not that shape. */
export function swapStockBuild(script: string): string | null {
  const match = STOCK_BUILD.exec(script.trim())
  if (match === null) return null
  return `${match[2]?.trim()} && ${match[1]?.trim()}`
}

/**
 * Writes `src/routeTree.gen.ts` (and its code-split pieces) the way the router plugin would, by
 * running the plugin's own generator from the copy the plugin resolves. Returns null on success, or
 * why the tree could not be written.
 */
export async function generateRouteTree(appDir: string): Promise<string | null> {
  try {
    const fromApp = createRequire(`${appDir}/package.json`)
    const fromPlugin = createRequire(fromApp.resolve('@tanstack/router-plugin/vite'))
    const generator = fromPlugin('@tanstack/router-generator') as {
      Generator: new (opts: { config: unknown; root: string }) => { run: () => Promise<void> }
      getConfig: (inline: unknown, dir: string) => unknown
    }
    const config = generator.getConfig(ROUTER_PLUGIN_OPTIONS, appDir)
    await new generator.Generator({ config, root: appDir }).run()
    return null
  } catch (error) {
    return (error as Error).message
  }
}
