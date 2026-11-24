/**
 * The shipped skills carry code a consumer agent copies verbatim, so a snippet that stops
 * compiling must fail `bun test`. A ```tsx fence whose FIRST line is `// @check` is extracted,
 * written to a scratch directory inside the package (so `react`, `@base-ui/react` and TanStack resolve
 * from its `node_modules`), and type-checked together with the others under the shipped
 * `configs/tsconfig.react-app.json`, with `basalt-ui` and `basalt-ui/*` path-mapped to the built `dist/*.d.ts` — the declarations a consumer
 * gets. (Mapping to `src/` would type-check basalt's own source under the snippet's `Register`
 * augmentation, which `src` is not written against; `make check` builds before it tests.)
 *
 * The scratch directory also holds a stand-in for the `routeTree.gen.ts` the TanStack router
 * plugin generates: a `/dashboard` route, so a snippet may link to and declare it, and a `/live`
 * route whose loader returns an unawaited promise (the streaming snippet). Unmarked
 * fences (a fragment, a shell line) are not checked.
 */
import { describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const pkgRoot = join(import.meta.dirname, '..')
const MARKER = '// @check'

const ROUTE_TREE_STUB = `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard' })
const liveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live',
  loader: () => ({
    points: Promise.resolve<{ data: { t: number; v: number }[]; error?: unknown }>({ data: [] }),
  }),
})
export const routeTree = rootRoute.addChildren([dashboardRoute, liveRoute])

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/dashboard': {
      id: '/dashboard'
      path: '/dashboard'
      fullPath: '/dashboard'
      preLoaderRoute: typeof dashboardRoute
      parentRoute: typeof rootRoute
    }
    '/live': {
      id: '/live'
      path: '/live'
      fullPath: '/live'
      preLoaderRoute: typeof liveRoute
      parentRoute: typeof rootRoute
    }
  }
}
`

/** The `// @check` fences of one markdown file, in order. */
function checkedFences(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/^```tsx\n([\s\S]*?)^```/gm)]
    .map((match) => match[1] ?? '')
    .filter((code) => code.startsWith(`${MARKER}\n`))
}

/**
 * Every `// @check` fence in a skill's SKILL.md or `references/*.md`, and in a file under `docs/`
 * (a generated doc's example, copied from its JSDoc), with the file it came from.
 */
export function extractSnippets(): { name: string; code: string }[] {
  const skillsRoot = join(pkgRoot, 'agent/skills')
  const skillSnippets = readdirSync(skillsRoot).flatMap((skill) => {
    const refs = join(skillsRoot, skill, 'references')
    const files = [
      join(skillsRoot, skill, 'SKILL.md'),
      ...(existsSync(refs)
        ? readdirSync(refs)
            .filter((f) => f.endsWith('.md'))
            .map((f) => join(refs, f))
        : []),
    ]
    return files.flatMap(checkedFences).map((code, index) => ({ name: `${skill}-${index}`, code }))
  })
  const docsRoot = join(pkgRoot, 'docs')
  const docSnippets = readdirSync(docsRoot, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.md'))
    .toSorted()
    .flatMap((f) =>
      checkedFences(join(docsRoot, f)).map((code, index) => ({
        name: `doc-${f.replace(/\.md$/, '').replace(/[^\w-]+/g, '-')}-${index}`,
        code,
      })),
    )
  return [...skillSnippets, ...docSnippets]
}

describe('skill snippets', () => {
  const snippets = extractSnippets()

  test('the shipped references carry a marked snippet', () => {
    expect(snippets.length).toBeGreaterThanOrEqual(1)
  })

  test('every // @check snippet type-checks against src', async () => {
    expect(existsSync(join(pkgRoot, 'dist/index.d.ts')), 'run `bun run build` first').toBe(true)
    const cacheRoot = join(pkgRoot, 'node_modules/.cache')
    mkdirSync(cacheRoot, { recursive: true })
    const dir = mkdtempSync(join(cacheRoot, 'skill-snippets-'))
    try {
      writeFileSync(join(dir, 'routeTree.gen.ts'), ROUTE_TREE_STUB)
      writeFileSync(join(dir, 'css.d.ts'), "declare module '*.css'\n")
      for (const { name, code } of snippets) writeFileSync(join(dir, `${name}.tsx`), code)
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({
          extends: join(pkgRoot, 'configs/tsconfig.react-app.json'),
          compilerOptions: {
            types: ['bun'],
            paths: {
              'basalt-ui': [join(pkgRoot, 'dist/index.d.ts')],
              'basalt-ui/*': [join(pkgRoot, 'dist/*')],
            },
          },
          include: ['./*.ts', './*.tsx'],
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
  }, 120_000)
})
