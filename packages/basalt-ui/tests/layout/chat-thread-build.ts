/**
 * Node side of the chat-thread layout suite: compiles `chat-thread.css` with the Tailwind CLI,
 * bundles the fixture with `basalt-ui/*` resolved to `src/` (the playground's own alias) and returns
 * one self-contained document. Call `dispose` in `afterAll`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HERE = import.meta.dirname
const PACKAGE = join(HERE, '..', '..')
const REPO_ROOT = join(PACKAGE, '..', '..')

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

/** `basalt-ui/ai` and `basalt-ui/ui/<name>` resolve to the source, as the playground's Vite alias does. */
const basaltSource: Bun.BunPlugin = {
  name: 'basalt-ui-src',
  setup(build) {
    build.onResolve({ filter: /^basalt-ui\// }, ({ path }) => {
      const base = join(PACKAGE, 'src', path.slice('basalt-ui/'.length))
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

export async function buildChatThreadDocument(): Promise<{ html: string; dispose(): void }> {
  const scratch = mkdtempSync(join(tmpdir(), 'chat-thread-'))
  const cssOut = join(scratch, 'chat-thread.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync([cli, '--input', join(HERE, 'chat-thread.css'), '--output', cssOut], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (css.exitCode !== 0) throw new Error(`chat-thread: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [
      join(REPO_ROOT, 'apps', 'playground', 'src', 'recipes', 'chat-thread-fixture.tsx'),
    ],
    target: 'browser',
    plugins: [basaltSource],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success) {
    throw new Error(`chat-thread: the fixture did not build:\n${build.logs.join('\n')}`)
  }
  const js = await build.outputs[0]!.text()

  const html =
    `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<title>chat-thread</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
    `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`
  return { html, dispose: () => rmSync(scratch, { recursive: true, force: true }) }
}
