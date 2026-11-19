/**
 * The playground bundle of the quality matrix, built by a child process of the harness.
 *
 * `Bun.build` held the two bundles' working set (~600 MiB) in the `bun test` process for the whole
 * run, on top of the Chrome tree. Run here, as `bun build-playground.ts <outdir> [pseudo]`, that
 * memory is returned to the host when the child exits.
 *
 * `Bun.build` cannot run Tailwind or read `?inline`, so a build plugin does both for this one app:
 * `src/index.css` goes through the Tailwind CLI (the same compile the playground's Vite plugin does)
 * and `<css>?inline` becomes a string module.
 */
import { join, resolve } from 'node:path'
import { PLAYGROUND, REPO } from './routes'

const TAILWIND = join(REPO, 'node_modules/.bin/tailwindcss')

function compileTailwind(entry: string): string {
  const result = Bun.spawnSync([TAILWIND, '--input', entry, '--output', '-'], {
    cwd: PLAYGROUND,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`matrix: Tailwind failed on ${entry}:\n${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

const PSEUDO_FORMAT = join(import.meta.dirname, 'pseudo-format.ts')

/** `pseudo` swaps the playground's `demo/page-format` for one that also carries the pseudo catalog. */
const playgroundPlugin = (pseudo: boolean): Bun.BunPlugin => ({
  name: 'playground-css',
  setup(build) {
    if (pseudo) {
      build.onResolve({ filter: /\/demo\/page-format$/ }, () => ({ path: PSEUDO_FORMAT }))
    }
    // The fonts are basalt-ui's dependencies: their url() resolves from the package that imports them.
    build.onResolve({ filter: /^@fontsource-variable\// }, (args) => ({
      path: Bun.resolveSync(args.path, join(REPO, 'packages/basalt-ui')),
    }))
    build.onResolve({ filter: /\?inline$/ }, (args) => {
      const bare = args.path.slice(0, -'?inline'.length)
      return {
        path: Bun.resolveSync(bare, args.importer ? resolve(args.importer, '..') : PLAYGROUND),
        namespace: 'inline-css',
      }
    })
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => ({
      contents: `export default ${JSON.stringify(await Bun.file(args.path).text())}`,
      loader: 'js',
    }))
    // Authored `.mdx` is compiled at build time, as the playground's Vite plugin does.
    build.onLoad({ filter: /\.mdx$/ }, async (args) => {
      const { compile } = (await import(Bun.resolveSync('@mdx-js/mdx', PLAYGROUND))) as {
        compile: (source: string, options: { remarkPlugins: unknown[] }) => Promise<unknown>
      }
      const gfm = (await import(Bun.resolveSync('remark-gfm', PLAYGROUND))) as { default: unknown }
      const file = await compile(await Bun.file(args.path).text(), { remarkPlugins: [gfm.default] })
      return { contents: String(file), loader: 'js' }
    })
    build.onLoad({ filter: /apps\/playground\/src\/index\.css$/ }, (args) => ({
      contents: compileTailwind(args.path),
      loader: 'css',
    }))
  },
})

/** Generates the (gitignored) route tree the playground imports, then bundles the app. */
export async function buildPlayground(outdir: string, pseudo: boolean): Promise<void> {
  const generate = Bun.spawnSync([join(PLAYGROUND, 'node_modules/.bin/tsr'), 'generate'], {
    cwd: PLAYGROUND,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (generate.exitCode !== 0) {
    throw new Error(`matrix: tsr generate failed:\n${generate.stderr.toString()}`)
  }
  const build = await Bun.build({
    entrypoints: [join(PLAYGROUND, 'src/main.tsx')],
    outdir,
    naming: '[name].[ext]',
    target: 'browser',
    plugins: [playgroundPlugin(pseudo)],
    // basalt source reads `process.env["NODE_ENV"]` in bracket form, which only a whole-object
    // define matches (tests/layout/harness/engine.ts).
    define: {
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false, PROD: true }),
    },
  })
  if (!build.success) {
    throw new Error(`matrix: the playground did not bundle:\n${build.logs.map(String).join('\n')}`)
  }
}

if (import.meta.main) {
  const [outdir, mode] = process.argv.slice(2)
  if (outdir === undefined) throw new Error('usage: bun build-playground.ts <outdir> [pseudo]')
  await buildPlayground(outdir, mode === 'pseudo')
}
