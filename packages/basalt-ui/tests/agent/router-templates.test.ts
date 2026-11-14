/**
 * The router templates (`agent/templates/{__root,main,nav,_app*}.tpl`) as a scratch app. A consumer's
 * first `tsc` must be green and `doctor` check 12 must see the three route defaults, so both are run
 * on the seeded files: the files are filled and written to their `init` destinations, type-checked
 * against the BUILT `dist` declarations (the harness of `scripts/skill-snippets.test.ts`), and
 * handed to the doctor check.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { cleanupTrees, makeTree, runCheck } from '../../src/cli/doctor/fixture.test'

afterEach(cleanupTrees)

const pkgRoot = join(import.meta.dirname, '../..')

/** Template → where `init` puts it, relative to the app root. */
const SEEDS = {
  '__root.tpl': 'src/routes/__root.tsx',
  '_app.tpl': 'src/routes/_app.tsx',
  'main.tpl': 'src/main.tsx',
  'nav.tpl': 'src/lib/nav.tsx',
  '_app-error.tpl': 'src/components/route-error.tsx',
  '_app-missing.tpl': 'src/components/route-missing.tsx',
  '_app-pending.tpl': 'src/components/route-pending.tsx',
} as const

const filled = (tpl: string): string =>
  readFileSync(join(pkgRoot, 'agent/templates', tpl), 'utf8').replaceAll('{{APP_NAME}}', 'Scratch')

/** What the TanStack router plugin writes for the `_app` layout and its index route. */
const ROUTE_TREE = `import { Route as rootRouteImport } from './routes/__root'
import { Route as AppRouteImport } from './routes/_app'
import { Route as AppIndexRouteImport } from './routes/_app.index'

const AppRoute = AppRouteImport.update({
  id: '/_app',
  getParentRoute: () => rootRouteImport,
} as any)
const AppIndexRoute = AppIndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => AppRoute,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof AppIndexRoute
}
export interface FileRoutesByTo {
  '/': typeof AppIndexRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/_app': typeof AppRouteWithChildren
  '/_app/': typeof AppIndexRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/'
  fileRoutesByTo: FileRoutesByTo
  to: '/'
  id: '__root__' | '/_app' | '/_app/'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  AppRoute: typeof AppRouteWithChildren
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_app': {
      id: '/_app'
      path: ''
      fullPath: '/'
      preLoaderRoute: typeof AppRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_app/': {
      id: '/_app/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof AppIndexRouteImport
      parentRoute: typeof AppRouteImport
    }
  }
}

interface AppRouteChildren {
  AppIndexRoute: typeof AppIndexRoute
}
const AppRouteChildren: AppRouteChildren = { AppIndexRoute }
const AppRouteWithChildren = AppRoute._addFileChildren(AppRouteChildren)

const rootRouteChildren: RootRouteChildren = { AppRoute: AppRouteWithChildren }
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
`

const INDEX_ROUTE = `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({ component: () => <p>Home</p> })
`

const write = (dir: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), text)
}

describe('router templates', () => {
  test('no template names a 2.x router symbol', () => {
    for (const tpl of Object.keys(SEEDS)) {
      const text = readFileSync(join(pkgRoot, 'agent/templates', tpl), 'utf8')
      expect(text).not.toMatch(/BasaltShell|createBasaltRouter|basaltRouterOptions|navGroup/)
    }
  })

  test('the seeded files type-check against the built dist', async () => {
    expect(existsSync(join(pkgRoot, 'dist/router/index.d.ts')), 'run `bun run build` first').toBe(
      true,
    )
    const cacheRoot = join(pkgRoot, 'node_modules/.cache')
    mkdirSync(cacheRoot, { recursive: true })
    const dir = mkdtempSync(join(cacheRoot, 'router-templates-'))
    try {
      for (const [tpl, dest] of Object.entries(SEEDS)) write(dir, dest, filled(tpl))
      write(dir, 'src/routes/_app.index.tsx', INDEX_ROUTE)
      write(dir, 'src/routeTree.gen.ts', ROUTE_TREE)
      write(dir, 'src/css.d.ts', "declare module '*.css'\n")
      write(
        dir,
        'tsconfig.json',
        JSON.stringify({
          extends: join(pkgRoot, 'configs/tsconfig.react-app.json'),
          compilerOptions: {
            types: ['bun'],
            paths: { 'basalt-ui/*': [join(pkgRoot, 'dist/*')] },
          },
          include: ['./src/**/*.ts', './src/**/*.tsx'],
        }),
      )
      const tsc = Bun.spawn([join(pkgRoot, 'node_modules/.bin/tsc'), '-p', dir], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const output = await new Response(tsc.stdout).text()
      expect(await tsc.exited, output).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 180_000)

  describe('doctor check 12 on the seeded app', () => {
    const seeded = (patch: (main: string) => string = (m) => m): string =>
      makeTree('app', { 'src/main.tsx': patch(filled('main.tpl')), 'src/router.tsx': null })

    test('reports all three route defaults set', async () => {
      const result = await runCheck(seeded(), 12)
      expect(result.detail).not.toContain('createRouter does not set')
      expect(result.status).toBe('pass')
    })

    test.each(['defaultPendingComponent', 'defaultErrorComponent', 'defaultNotFoundComponent'])(
      'fails when %s is removed',
      async (key) => {
        const result = await runCheck(
          seeded((main) => main.replace(new RegExp(`^\\s*${key}: .*\\n`, 'm'), '')),
          12,
        )
        expect(result.status).toBe('fail')
        expect(result.detail).toContain(`createRouter does not set ${key}`)
      },
    )
  })
})
