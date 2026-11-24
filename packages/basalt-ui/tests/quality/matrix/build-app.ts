/**
 * One app's bundle of the quality matrix (the playground's or the expression app's), built by a child process of the harness.
 *
 * `Bun.build` held the two bundles' working set (~600 MiB) in the `bun test` process for the whole
 * run, on top of the Chrome tree. Run here, as `bun build-app.ts <app> <outdir> [pseudo]`, that
 * memory is returned to the host when the child exits.
 *
 * `Bun.build` cannot run Tailwind or read `?inline`, so a build plugin does both for this one app:
 * `src/index.css` goes through the Tailwind CLI (the same compile the playground's Vite plugin does)
 * and `<css>?inline` becomes a string module. It applies `basalt()`'s one transform as well: a module that
 * imports `basalt-ui/table` gets the table tier sheet.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { withTableSheet } from '../../../src/vite/table-sheet'
import { APP_DIRS, REPO } from './routes'
import type { MatrixApp } from './routes'

const TAILWIND = join(REPO, 'node_modules/.bin/tailwindcss')

function compileTailwind(app: MatrixApp, entry: string): string {
  const result = Bun.spawnSync([TAILWIND, '--input', entry, '--output', '-'], {
    cwd: APP_DIRS[app],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`matrix: Tailwind failed on ${entry}:\n${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

const PSEUDO_FORMAT = join(import.meta.dirname, 'pseudo-format.ts')

/** `pseudo` swaps the app's `demo/page-format` for one that also carries the pseudo catalog. */
const appPlugin = (app: MatrixApp, pseudo: boolean): Bun.BunPlugin => ({
  name: `${app}-css`,
  setup(build) {
    if (pseudo) {
      build.onResolve({ filter: /\/demo\/page-format$/ }, () => ({ path: PSEUDO_FORMAT }))
    }
    // The fonts are basalt-ui's dependencies: their url() resolves from the package that imports them.
    build.onResolve({ filter: /^@fontsource-variable\// }, (args) => ({
      path: Bun.resolveSync(args.path, join(REPO, 'packages/basalt-ui')),
    }))
    // The Tailwind CLI inlines fonts.css without rebasing its url()s: `./files/<face>.woff2` is meant
    // relative to the sheet, which lives in basalt-ui's `src/css`.
    build.onResolve({ filter: /^\.\/files\/[^/]+\.woff2$/ }, (args) =>
      args.importer.endsWith(`apps/${app}/src/index.css`)
        ? { path: join(REPO, 'packages/basalt-ui/src/css', args.path) }
        : undefined,
    )
    build.onResolve({ filter: /\?inline$/ }, (args) => {
      const bare = args.path.slice(0, -'?inline'.length)
      return {
        path: Bun.resolveSync(bare, args.importer ? resolve(args.importer, '..') : APP_DIRS[app]),
        namespace: 'inline-css',
      }
    })
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => ({
      contents: `export default ${JSON.stringify(await Bun.file(args.path).text())}`,
      loader: 'js',
    }))
    // Authored `.mdx` is compiled at build time, as the playground's Vite plugin does.
    build.onLoad({ filter: /\.mdx$/ }, async (args) => {
      const { compile } = (await import(Bun.resolveSync('@mdx-js/mdx', APP_DIRS[app]))) as {
        compile: (source: string, options: { remarkPlugins: unknown[] }) => Promise<unknown>
      }
      const gfm = (await import(Bun.resolveSync('remark-gfm', APP_DIRS[app]))) as {
        default: unknown
      }
      const file = await compile(await Bun.file(args.path).text(), { remarkPlugins: [gfm.default] })
      return { contents: String(file), loader: 'js' }
    })
    // `basalt()` appends the table tier sheet to a module that imports `basalt-ui/table`; so does this build.
    build.onLoad(
      {
        filter:
          /(?:apps\/(?:playground|expression)\/src|packages\/basalt-ui\/blocks)\/.*\.[jt]sx?$/,
      },
      async (args) => {
        const code = await Bun.file(args.path).text()
        return {
          contents: withTableSheet(code, args.path) ?? code,
          loader: args.path.endsWith('x') ? 'tsx' : 'ts',
        }
      },
    )
    build.onLoad({ filter: /apps\/(?:playground|expression)\/src\/index\.css$/ }, (args) => ({
      contents: compileTailwind(app, args.path),
      loader: 'css',
    }))
  },
})

/** Generates the (gitignored) route tree the app imports, then bundles it. */
export async function buildApp(app: MatrixApp, outdir: string, pseudo: boolean): Promise<void> {
  const dir = APP_DIRS[app]
  // `src/index.css` imports the sources `basalt()` writes on a Vite run; this bundle runs no Vite.
  if (!existsSync(join(dir, '.basalt/sources.css'))) {
    throw new Error(
      `matrix: apps/${app}/.basalt/sources.css is missing: run \`bun --filter @basalt-ui/${app} build\` first`,
    )
  }
  const generate = Bun.spawnSync([join(dir, 'node_modules/.bin/tsr'), 'generate'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (generate.exitCode !== 0) {
    throw new Error(`matrix: tsr generate failed:\n${generate.stderr.toString()}`)
  }
  const build = await Bun.build({
    entrypoints: [join(dir, 'src/main.tsx')],
    outdir,
    naming: '[name].[ext]',
    target: 'browser',
    plugins: [appPlugin(app, pseudo)],
    // basalt source reads `process.env["NODE_ENV"]` in bracket form, which only a whole-object
    // define matches (tests/layout/harness/engine.ts).
    define: {
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false, PROD: true }),
    },
  })
  if (!build.success) {
    throw new Error(`matrix: the ${app} app did not bundle:\n${build.logs.map(String).join('\n')}`)
  }
}

if (import.meta.main) {
  const [app, outdir, mode] = process.argv.slice(2)
  if ((app !== 'playground' && app !== 'expression') || outdir === undefined)
    throw new Error('usage: bun build-app.ts <playground|expression> <outdir> [pseudo]')
  await buildApp(app, outdir, mode === 'pseudo')
}
