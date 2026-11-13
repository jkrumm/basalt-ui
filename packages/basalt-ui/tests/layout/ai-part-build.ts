/**
 * Node side of the `ai-part` layout suites: compiles `ai-part.css` with the Tailwind CLI, bundles a
 * fixture entry in memory and returns a self-contained document, so no shared fixture file carries
 * a line for these suites. Call `dispose` in `afterAll`.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HERE = import.meta.dirname
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

export async function buildAiPartDocument(
  entry: string,
  title: string,
): Promise<{ html: string; dispose(): void }> {
  const scratch = mkdtempSync(join(tmpdir(), 'ai-part-'))
  const cssOut = join(scratch, 'ai-part.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync([cli, '--input', join(HERE, 'ai-part.css'), '--output', cssOut], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (css.exitCode !== 0) throw new Error(`${title}: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(HERE, entry)],
    target: 'browser',
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
