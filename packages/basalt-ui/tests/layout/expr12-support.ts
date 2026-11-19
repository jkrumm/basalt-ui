/**
 * The document of one expression cycle 12 kit-fix fixture: the shared Tailwind entry compiled into a
 * temp directory, the fixture bundled in memory, the table tier sheet inlined beside them. Used by
 * the `kit-expr12-*.layout.test.ts` files.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serveDocument } from './harness'

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

export type Expr12Document = { path: string; cleanup: () => void }

export async function buildExpr12Document(name: string): Promise<Expr12Document> {
  const scratch = mkdtempSync(join(tmpdir(), `kit-expr12-${name}-`))
  const cssOut = join(scratch, 'kit-expr12.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'kit-expr12.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0)
    throw new Error(`kit-expr12 ${name}: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, `kit-expr12-${name}-fixture.tsx`)],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`kit-expr12 ${name}: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )
  const path = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>kit-expr12 ${name}</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style><style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  return { path, cleanup: () => rmSync(scratch, { recursive: true, force: true }) }
}
