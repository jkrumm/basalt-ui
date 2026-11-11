// Scratch-app build, copied next to the shared node_modules by `run.ts stage`. Bundles src/main.tsx
// and compiles src/app.css with the Tailwind CLI into dist/. Exit 1 prints what broke.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const app = resolve(process.argv[2] ?? '.')
const dist = join(app, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

const bundle = await Bun.build({
  entrypoints: [join(app, 'src', 'main.tsx')],
  outdir: dist,
  naming: 'app.js',
  target: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (!bundle.success) {
  for (const log of bundle.logs) console.error(String(log))
  process.exit(1)
}

const css = spawnSync(
  join(here, 'node_modules', '.bin', 'tailwindcss'),
  ['-i', join(app, 'src', 'app.css'), '-o', join(dist, 'app.css')],
  { cwd: app, encoding: 'utf8' },
)
if (css.status !== 0) {
  console.error(css.stderr || css.stdout)
  process.exit(1)
}
cpSync(join(app, 'index.html'), join(dist, 'index.html'))
console.log('build ok')
