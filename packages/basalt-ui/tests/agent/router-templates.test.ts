/**
 * The router templates (`agent/templates/{__root,main,nav,_app*}.tpl`) as a scratch app. A consumer's
 * first `tsc` must be green and `doctor` check 12 must see the three route defaults, so both are run
 * on the seeded files: the files are filled and written to their `init` destinations, type-checked
 * against the BUILT `dist` declarations (the harness of `scripts/skill-snippets.test.ts`), and
 * handed to the doctor check.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { seedPlan } from '../../src/cli/init/router-seeds'
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
  '_app-index.tpl': 'src/routes/_app/index.tsx',
} as const

const START_VITE =
  'export default { plugins: [tanstackStart({ router: { autoCodeSplitting: true } })] }\n'

const filled = (tpl: string): string =>
  readFileSync(join(pkgRoot, 'agent/templates', tpl), 'utf8')
    .replaceAll('{{APP_NAME}}', 'Scratch')
    .replaceAll('{{CSS_ENTRY}}', '../index.css')

/** What `init --start` writes instead of `main` and `root`: the Start host seeds. */
const START_SEEDS = {
  '__root.start.tpl': 'src/routes/__root.tsx',
  'router.start.tpl': 'src/router.tsx',
} as const
const SHARED_SEEDS = Object.fromEntries(
  Object.entries(SEEDS).filter(([tpl]) => tpl !== '__root.tpl' && tpl !== 'main.tpl'),
)

/** What the TanStack router plugin writes for the `_app` layout and its index route. */
const ROUTE_TREE = `import { Route as rootRouteImport } from './routes/__root'
import { Route as AppRouteImport } from './routes/_app'
import { Route as AppIndexRouteImport } from './routes/_app/index'

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

const write = (dir: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), text)
}

describe('router templates', () => {
  test('a route file keeps its component unexported, so the router splits it', () => {
    for (const tpl of ['__root.tpl', '_app.tpl']) {
      const exported = [...filled(tpl).matchAll(/^export (?:function|const) (\w+)/gm)].map(
        (m) => m[1],
      )
      expect(exported, tpl).toEqual(['Route'])
    }
    expect(filled('_app.tpl')).not.toContain('only-export-components')
  })

  test('init seeds every template to the destination the others import from', () => {
    const seeds = new Map(seedPlan('', false).map(([, dest, tpl]) => [tpl, dest]))
    for (const [tpl, dest] of Object.entries(SEEDS)) expect(seeds.get(tpl), tpl).toBe(dest)
  })

  test('the start page is the `/` route under the layout and is a Page', () => {
    const page = filled('_app-index.tpl')
    expect(page).toContain("createFileRoute('/_app/')")
    expect(page).toMatch(/<Page>[\s\S]*<PageBar title="[^"]+" \/>[\s\S]*<\/Page>/)
    expect(page).toContain('Scratch')
    const exported = [...page.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1])
    expect(exported).toEqual(['Route'])
  })

  test('the start page lints clean on the app preset, which still flags an offender beside it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'basalt-start-page-'))
    try {
      mkdirSync(join(dir, 'node_modules/@shadcn'), { recursive: true })
      symlinkSync(pkgRoot, join(dir, 'node_modules/basalt-ui'))
      symlinkSync(
        join(pkgRoot, 'node_modules/@shadcn/lint'),
        join(dir, 'node_modules/@shadcn/lint'),
      )
      write(dir, '.oxlintrc.json', readFileSync(join(pkgRoot, 'configs/oxlint-app.json'), 'utf8'))
      write(dir, 'src/routes/_app/index.tsx', filled('_app-index.tpl'))
      write(
        dir,
        'src/routes/_app/bad.tsx',
        "export function Bad() { return <div style={{ color: '#ff0000' }}>x</div> }\n",
      )
      const oxlint = join(pkgRoot, '../../node_modules/.bin/oxlint')
      const lint = (path: string): { code: number; out: string } => {
        const run = Bun.spawnSync([oxlint, '-c', '.oxlintrc.json', path], { cwd: dir })
        return { code: run.exitCode, out: `${run.stdout}${run.stderr}` }
      }
      const page = lint('src/routes/_app/index.tsx')
      expect(page.code, page.out).toBe(0)
      expect(page.out).not.toMatch(/\berror\b|\b[1-9]\d* warnings?\b/)
      expect(lint('src/routes/_app/bad.tsx').out).toContain('basalt(color-literal)')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the Start root route keeps its components unexported and the shell runs the scheme script', () => {
    const root = filled('__root.start.tpl')
    const exported = [...root.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1])
    expect(exported).toEqual(['Route'])
    expect(root).toMatch(/shellComponent: RootDocument/)
    expect(root).toMatch(/<html lang="en" suppressHydrationWarning>/)
    expect(root).toMatch(/<ScriptOnce>\{themeScript\(\)\}<\/ScriptOnce>/)
    expect(root).toContain("from 'basalt-ui/theme-script'")
    // The provider wraps the outlet in the app component, not in the document shell.
    expect(root).toMatch(/function RootLayout\(\)[\s\S]*<BasaltProvider[\s\S]*<Outlet \/>/)
    expect(filled('router.start.tpl')).toMatch(/export function getRouter\(\)/)
    expect(filled('router.start.tpl')).toMatch(
      /const queryClient = createQueryClient\(\)\n  const defaults/,
    )
  })

  test('the icon defaults mount once per React root: in main for an SPA, in the Start root for a Start app', () => {
    const mounts = (tpls: string[]): number =>
      tpls.reduce((n, tpl) => n + (filled(tpl).match(/<LucideProvider[\s>]/g)?.length ?? 0), 0)
    const mount = '<LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>'
    expect(mounts(Object.keys(SEEDS))).toBe(1)
    expect(filled('main.tpl')).toContain("import { LucideProvider } from 'lucide-react'")
    expect(filled('main.tpl')).toMatch(
      /<BasaltProvider link=\{defaults\.link\}>\s*<LucideProvider[\s\S]*<\/LucideProvider>\s*<\/BasaltProvider>/,
    )
    expect(mounts([...Object.keys(SHARED_SEEDS), ...Object.keys(START_SEEDS)])).toBe(1)
    expect(filled('__root.start.tpl')).toContain(mount)
  })

  test('no template names a 2.x router symbol', () => {
    for (const tpl of [...Object.keys(SEEDS), ...Object.keys(START_SEEDS)]) {
      const text = readFileSync(join(pkgRoot, 'agent/templates', tpl), 'utf8')
      expect(text).not.toMatch(/BasaltShell|createBasaltRouter|basaltRouterOptions|navGroup/)
    }
  })

  test('the error template retries by invalidating the router, not by reset alone', () => {
    const text = readFileSync(join(pkgRoot, 'agent/templates/_app-error.tpl'), 'utf8')
    expect(text).toMatch(/router\.invalidate\(\)/)
    expect(text).toMatch(/onClick: retry/)
    expect(text).not.toMatch(/onClick: reset/)
  })

  test('the missing screen takes its message and link from notFound data, else links home', async () => {
    const src = filled('_app-missing.tpl').replace(
      "'basalt-ui/page'",
      JSON.stringify(join(pkgRoot, 'src/page/index')),
    )
    const dir = mkdtempSync(join(pkgRoot, 'tests/agent/.missing-'))
    try {
      const file = join(dir, 'route-missing.tsx')
      writeFileSync(file, src)
      const { RouteMissing } = (await import(file)) as {
        RouteMissing: (props: Record<string, unknown>) => ReactElement
      }
      const { render, cleanup } = await import('@testing-library/react')
      const shown = render(createElement(RouteMissing, {}))
      expect(shown.container.textContent).toContain('This address does not match any page.')
      expect(shown.container.querySelector('a')?.getAttribute('href')).toBe('/')
      // The screen names itself once, like every page: one h1.
      expect([...shown.container.querySelectorAll('h1')].map((h) => h.textContent)).toEqual([
        'Not found',
      ])
      cleanup()
      const data = { message: 'No run "r9".', link: { to: '/runs', label: 'All runs' } }
      const named = render(
        createElement(RouteMissing, { data, isNotFound: true, routeId: '__root__' }),
      )
      expect(named.container.textContent).toContain('No run "r9".')
      const link = named.container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/runs')
      expect(link?.textContent).toBe('All runs')
      cleanup()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the error screen names itself with one h1 and hands focus to main after a retry', async () => {
    const src = filled('_app-error.tpl')
      .replace("'basalt-ui/page'", JSON.stringify(join(pkgRoot, 'src/page/index')))
      .replace(
        "import { useRouter } from '@tanstack/react-router'",
        'const useRouter = () => ({ invalidate: async () => {} })',
      )
    const dir = mkdtempSync(join(pkgRoot, 'tests/agent/.error-'))
    try {
      const file = join(dir, 'route-error.tsx')
      writeFileSync(file, src)
      const { RouteError } = (await import(file)) as {
        RouteError: (props: Record<string, unknown>) => ReactElement
      }
      const { render, cleanup, fireEvent, screen, act } = await import('@testing-library/react')
      const main = document.createElement('main')
      main.id = 'shell-main'
      main.tabIndex = -1
      document.body.append(main)
      let resets = 0
      const shown = render(
        createElement(RouteError, {
          error: new Error('boom'),
          reset: () => {
            resets += 1
          },
        }),
      )
      expect([...shown.container.querySelectorAll('h1')].map((h) => h.textContent)).toEqual([
        'Something went wrong',
      ])
      const retry = screen.getByRole('button', { name: 'Try again' })
      retry.focus()
      await act(async () => {
        fireEvent.click(retry)
        // The retry replaces this screen: the button, and the focus on it, go.
        shown.unmount()
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
        )
      })
      expect(resets).toBe(1)
      expect(document.activeElement).toBe(main)
      main.remove()
      cleanup()
    } finally {
      rmSync(dir, { recursive: true, force: true })
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

  test('the Start seeds type-check against the built dist', async () => {
    expect(existsSync(join(pkgRoot, 'dist/router/index.d.ts')), 'run `bun run build` first').toBe(
      true,
    )
    const cacheRoot = join(pkgRoot, 'node_modules/.cache')
    mkdirSync(cacheRoot, { recursive: true })
    const dir = mkdtempSync(join(cacheRoot, 'router-templates-start-'))
    try {
      for (const [tpl, dest] of Object.entries({ ...SHARED_SEEDS, ...START_SEEDS })) {
        write(dir, dest, filled(tpl))
      }
      write(dir, 'src/routeTree.gen.ts', ROUTE_TREE)
      write(
        dir,
        'src/css.d.ts',
        "declare module '*.css'\ndeclare module '*.css?url' {\n  const href: string\n  export default href\n}\n",
      )
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

  describe('doctor check 12 on the seeded Start app', () => {
    const seeded = (patch: (root: string) => string = (r) => r): string =>
      makeTree('app', {
        'index.html': null,
        'src/main.tsx': null,
        'src/router.tsx': filled('router.start.tpl'),
        'src/routes/__root.tsx': patch(filled('__root.start.tpl')),
        'vite.config.ts': START_VITE,
      })

    test('passes: the router defaults, the Register interface, the document and its scheme script', async () => {
      const result = await runCheck(seeded(), 12)
      expect(result.detail).toBe('app wiring is complete')
      expect(result.status).toBe('pass')
    })

    test('fails when the shell no longer runs the scheme script', async () => {
      const result = await runCheck(
        seeded((root) => root.replace('<ScriptOnce>{themeScript()}</ScriptOnce>', '')),
        12,
      )
      expect(result.status).toBe('fail')
      expect(result.detail).toContain('no boot script sets data-theme before paint')
    })
  })

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
