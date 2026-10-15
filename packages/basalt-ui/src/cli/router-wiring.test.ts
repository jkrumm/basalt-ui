import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { callOf, callsIn, isCodeRoutedApp, routerSeedSkip, routeTreeDirs } from './router-wiring'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'basalt-router-wiring-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, body: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), body)
}

const CREATE = 'const router = createBasaltRouter({ routeTree })\n'

describe('isCodeRoutedApp', () => {
  it('is true for createBasaltRouter with no plugin, generated tree or imported tree', () => {
    write('src/main.tsx', CREATE)
    expect(isCodeRoutedApp(dir, '')).toBe(true)
  })

  it('is false without a createBasaltRouter call (an import is not a call)', () => {
    write('src/main.tsx', "import { createBasaltRouter } from 'basalt-ui'\n")
    expect(isCodeRoutedApp(dir, '')).toBe(false)
  })

  it('is false with a routeTree.gen file, beside the entry or in src/', () => {
    write('src/main.tsx', CREATE)
    write('src/routeTree.gen.ts', 'export const routeTree = {}\n')
    expect(isCodeRoutedApp(dir, '')).toBe(false)
  })

  it('is false with a router plugin in the vite config', () => {
    write('src/main.tsx', CREATE)
    write(
      'vite.config.ts',
      "import { tanstackRouter } from '@tanstack/router-plugin/vite'\nexport default { plugins: [tanstackRouter()] }\n",
    )
    expect(isCodeRoutedApp(dir, '')).toBe(false)
  })

  it('is false when the entry imports the generated tree (a fresh seed, before the first vite run)', () => {
    write('src/main.tsx', `import { routeTree } from './routeTree.gen'\n${CREATE}`)
    expect(isCodeRoutedApp(dir, '')).toBe(false)
  })

  it('ignores a comment that mentions routeTree.gen, and still sees a real import', () => {
    write('src/main.tsx', `// the old routeTree.gen import is gone\n${CREATE}`)
    expect(isCodeRoutedApp(dir, '')).toBe(true)
    write(
      'src/main.tsx',
      `import { routeTree } from './routeTree.gen'\n// not code-routed\n${CREATE}`,
    )
    expect(isCodeRoutedApp(dir, '')).toBe(false)
  })

  it('follows a dynamic import, including inside lazy()', () => {
    write('src/main.tsx', "const Router = lazy(() => import('./router'))\n")
    write('src/router.ts', CREATE)
    expect(isCodeRoutedApp(dir, '')).toBe(true)
  })

  it('does not follow an import that is commented out', () => {
    write('src/main.tsx', "// import './router'\n/* import('./router') */\n")
    write('src/router.ts', CREATE)
    expect(isCodeRoutedApp(dir, '')).toBe(false)
  })

  it('finds createBasaltRouter in a module the entry imports', () => {
    write('src/main.tsx', "import './router'\n")
    write('src/router.ts', CREATE)
    expect(isCodeRoutedApp(dir, '')).toBe(true)
  })
})

describe('callsIn', () => {
  it('follows relative imports exactly three hops from the entry', () => {
    write('src/main.tsx', "import './a'\n")
    write('src/a.ts', "import './b'\n")
    write('src/b.ts', "import './c'\n")
    write('src/c.ts', "import './d'\n")
    write('src/d.ts', 'markerCall()\n')
    expect(callsIn(dir, 'src/main.tsx', callOf('markerCall'))).toBe(false)
    write('src/c.ts', 'markerCall()\n')
    expect(callsIn(dir, 'src/main.tsx', callOf('markerCall'))).toBe(true)
  })

  it('matches a call (generic or not), never an import line, comment or string', () => {
    write(
      'src/main.tsx',
      "import { markerCall } from 'x'\n// markerCall()\nconst s = 'markerCall()'\n",
    )
    expect(callsIn(dir, 'src/main.tsx', callOf('markerCall'))).toBe(false)
    write('src/main.tsx', 'markerCall<Ctx>()({})\n')
    expect(callsIn(dir, 'src/main.tsx', callOf('markerCall'))).toBe(true)
  })

  it('survives an import cycle', () => {
    write('src/main.tsx', "import './a'\n")
    write('src/a.ts', "import './main'\n")
    expect(callsIn(dir, 'src/main.tsx', callOf('markerCall'))).toBe(false)
  })
})

describe('routeTreeDirs', () => {
  it('is the entry directory, then src, without a duplicate', () => {
    expect(routeTreeDirs('app/main.tsx')).toEqual(['app', 'src'])
    expect(routeTreeDirs('src/main.tsx')).toEqual(['src'])
  })
})

describe('routerSeedSkip', () => {
  it('is start whenever Start applies, even for an app that also looks code-routed', () => {
    write('package.json', JSON.stringify({ dependencies: { '@tanstack/react-start': '*' } }))
    write('src/main.tsx', CREATE)
    expect(routerSeedSkip(dir, '')).toBe('start')
  })

  it('is code-routed for a code-routed app and null for a file-routed one', () => {
    write('src/main.tsx', CREATE)
    expect(routerSeedSkip(dir, '')).toBe('code-routed')
    write('src/routeTree.gen.ts', 'export const routeTree = {}\n')
    expect(routerSeedSkip(dir, '')).toBeNull()
  })
})
