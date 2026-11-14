/**
 * Node side of the `ai-block` layout suite: compiles `ai-block.css` with the Tailwind CLI, bundles a
 * fixture entry in memory and returns a self-contained document, so no shared fixture file carries
 * a line for these suites. Call `dispose` in `afterAll`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HERE = import.meta.dirname
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

/** `basalt-ui/<path>` resolves to the source, as the playground's Vite alias does (a recipe file imports it so). */
const basaltSource: Bun.BunPlugin = {
  name: 'basalt-ui-src',
  setup(build) {
    build.onResolve({ filter: /^basalt-ui\// }, ({ path }) => {
      const base = join(HERE, '..', '..', 'src', path.slice('basalt-ui/'.length))
      const hit = [
        `${base}.tsx`,
        `${base}.ts`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
      ].find(existsSync)
      return hit ? { path: hit } : undefined
    })
  },
}

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

export async function buildAiBlockDocument(
  entry: string,
  title: string,
): Promise<{ html: string; dispose(): void }> {
  const scratch = mkdtempSync(join(tmpdir(), 'ai-block-'))
  const cssOut = join(scratch, 'ai-block.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync([cli, '--input', join(HERE, 'ai-block.css'), '--output', cssOut], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (css.exitCode !== 0) throw new Error(`${title}: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(HERE, entry)],
    target: 'browser',
    plugins: [basaltSource],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`${title}: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<title>${title}</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
    `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`
  return { html, dispose: () => rmSync(scratch, { recursive: true, force: true }) }
}
