/** Bundles the fixture twice with `Bun.build`: the browser hydration entry and the Bun request handler. */
import { resolve } from 'node:path'
import { playgroundResolver } from './resolve'

const HERE = import.meta.dirname

export const SERVER_JS = 'server-entry.js'

async function bundle(entry: string, outdir: string, target: 'browser' | 'bun'): Promise<void> {
  const result = await Bun.build({
    entrypoints: [resolve(HERE, entry)],
    outdir,
    target,
    minify: target === 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [playgroundResolver],
  })
  if (!result.success) {
    throw new Error(`ssr fixture ${target} build failed:\n${result.logs.map(String).join('\n')}`)
  }
}

export async function buildFixture(outdir: string): Promise<void> {
  await Promise.all([
    bundle('client.tsx', outdir, 'browser'),
    bundle('server-entry.tsx', outdir, 'bun'),
  ])
}
