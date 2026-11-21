import { afterEach, describe, expect, it } from 'bun:test'

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { cleanupTrees, editManifest, makeTree, runCheck } from './fixture.test'
import { buildContext } from './index'
import { playwrightNote } from './app'

afterEach(cleanupTrees)

const router = (
  defaults: string[],
): string => `import { createRouter } from '@tanstack/react-router'
export const router = createRouter({ routeTree, ${defaults.map((d) => `${d}: X`).join(', ')} })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
`

const DEFAULTS = ['defaultErrorComponent', 'defaultNotFoundComponent', 'defaultPendingComponent']

describe('check 12: app wiring', () => {
  it('passes on a healthy app tree', async () => {
    expect((await runCheck(makeTree('app'), 12)).status).toBe('pass')
  })

  it.each(DEFAULTS)(
    'a profile app tree missing %s fails, and passes with all three',
    async (missing) => {
      const kept = DEFAULTS.filter((d) => d !== missing)
      const r = await runCheck(makeTree('app', { 'src/router.tsx': router(kept) }), 12)
      expect(r.status).toBe('fail')
      expect(r.detail).toContain(`createRouter does not set ${missing}`)
      expect(
        (await runCheck(makeTree('app', { 'src/router.tsx': router(DEFAULTS) }), 12)).status,
      ).toBe('pass')
    },
  )

  it('does not ask a bridge profile for router defaults', async () => {
    expect((await runCheck(makeTree('bridge'), 12)).status).toBe('pass')
  })

  it('fails without a Register declaration', async () => {
    const source = router(DEFAULTS).replace(/declare module[\s\S]*$/, '')
    const r = await runCheck(makeTree('app', { 'src/router.tsx': source }), 12)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('`Register` interface is not declared')
  })

  it.each(['tsc -b && vite build', 'tsc && echo ok', 'tsc -b'])(
    'fails a build script that runs tsc before the route tree is generated: %s',
    async (script) => {
      const pkg = JSON.stringify({ name: 'app', scripts: { build: script } })
      const r = await runCheck(makeTree('app', { 'package.json': pkg }), 12)
      expect(r.status).toBe('fail')
      expect(r.detail).toContain('script "build"')
      expect(r.detail).toContain('vite build && tsc -b')
      expect(r.detail.split('script "build"')).toHaveLength(2)
    },
  )

  it.each(['vite build && tsc -b', 'tsr generate && tsc -b', 'vite build', 'echo done'])(
    'passes a script that generates the tree first or never runs tsc: %s',
    async (script) => {
      const pkg = JSON.stringify({ name: 'app', scripts: { build: script } })
      expect((await runCheck(makeTree('app', { 'package.json': pkg }), 12)).status).toBe('pass')
    },
  )

  it('fails without autoCodeSplitting in the vite config', async () => {
    const r = await runCheck(
      makeTree('app', { 'vite.config.ts': 'export default { plugins: [] }\n' }),
      12,
    )
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('autoCodeSplitting')
  })

  it('fails notify without a ToastHost, and passes with one', async () => {
    const notifying = "import { notify } from 'basalt-ui'\nnotify({ message: 'x' })\n"
    const r = await runCheck(makeTree('app', { 'src/toast.tsx': notifying }), 12)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('no ToastHost')
    const host = `${notifying}export const App = () => <ToastHost />\n`
    expect((await runCheck(makeTree('app', { 'src/toast.tsx': host }), 12)).status).toBe('pass')
  })

  it('fails an <html> with no lang', async () => {
    const html = '<!doctype html>\n<html data-theme="dark">\n<body></body>\n</html>\n'
    const r = await runCheck(makeTree('app', { 'index.html': html }), 12)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('<html> has no lang')
  })

  it('fails a legacy scheme-attribute selector', async () => {
    const css = '[data-mantine-color-scheme="dark"] .a { color: red }\n'
    const r = await runCheck(makeTree('app', { 'src/legacy.css': css }), 12)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('src/legacy.css')
  })

  describe('the boot script', () => {
    const page = (tag: string, head = ''): string =>
      `<!doctype html>\n${tag}\n<head>${head}</head>\n<body></body>\n</html>\n`

    it('fails when <html> has no literal data-theme and nothing boots the scheme', async () => {
      const r = await runCheck(makeTree('app', { 'index.html': page('<html lang="en">') }), 12)
      expect(r.status).toBe('fail')
      expect(r.detail).toContain('no boot script')
    })

    it('passes a literal data-theme on <html> with no boot script (a dark-only app)', async () => {
      const r = await runCheck(
        makeTree('app', { 'index.html': page('<html lang="en" data-theme="dark">') }),
        12,
      )
      expect(r.status).toBe('pass')
    })

    it('passes when basalt() from basalt-ui/vite injects the boot script', async () => {
      const config = (options: string): string =>
        `import { basalt } from 'basalt-ui/vite'\nexport default { plugins: [basalt(${options}), tanstackRouter({ autoCodeSplitting: true })] }\n`
      const html = page('<html lang="en">')
      const on = await runCheck(
        makeTree('app', { 'index.html': html, 'vite.config.ts': config('{}') }),
        12,
      )
      expect(on.status).toBe('pass')
      const off = await runCheck(
        makeTree('app', { 'index.html': html, 'vite.config.ts': config('{ themeScript: false }') }),
        12,
      )
      expect(off.status).toBe('fail')
    })
  })

  it('never fails a missing Playwright, declared viewports included: it is a note', async () => {
    const dir = makeTree('app')
    editManifest(dir, (m) => void (m.viewports = ['1440x900']))
    expect((await runCheck(dir, 12)).status).toBe('pass')
    const note = playwrightNote(buildContext(dir, {}))
    expect(note).toContain('bun add -d playwright && bunx playwright install chromium')
    expect(note).toMatch(/^note: /)
  })

  it('names no Playwright note once it is declared, and none for a tokens or site profile', () => {
    const declared = makeTree('app', {
      'package.json': JSON.stringify({ name: 'app', devDependencies: { playwright: '1.60.0' } }),
    })
    expect(playwrightNote(buildContext(declared, {}))).toBeNull()
    expect(playwrightNote(buildContext(makeTree('tokens'), {}))).toBeNull()
    expect(playwrightNote(buildContext(makeTree('site'), {}))).toBeNull()
  })

  describe('a nav link needs a route file', () => {
    const NAV = (...to: string[]): string =>
      `import { linkOptions } from '@tanstack/react-router'
export const NAV = defineNav({ sections: [{ id: 'm', label: 'M', items: [${to
        .map((t, i) => `{ id: 'i${i}', label: 'I', link: linkOptions({ to: '${t}' }) }`)
        .join(', ')}] }] })
`
    const LAYOUT = "export const Route = createFileRoute('/_app')({})\n"
    const PAGE = "export const Route = createFileRoute('/_app/x')({})\n"
    const tree = (nav: string[], routes: Record<string, string>): string =>
      makeTree('app', { 'src/lib/nav.tsx': NAV(...nav), ...routes })

    it('fails a link to / when only the layout exists, naming the file and the path', async () => {
      const r = await runCheck(tree(['/'], { 'src/routes/_app.tsx': LAYOUT }), 12)
      expect(r.status).toBe('fail')
      expect(r.detail).toContain('src/lib/nav.tsx links to / but no route file')
    })

    it.each([
      ['src/routes/_app/index.tsx', '/'],
      ['src/routes/_app.index.tsx', '/'],
      ['src/routes/index.tsx', '/'],
      ['src/routes/_app/runs.tsx', '/runs'],
      ['src/routes/_app.runs.index.tsx', '/runs'],
      ['src/routes/_app/runs/index.tsx', '/runs'],
      ['src/routes/_app/runs/$id.tsx', '/runs/$id'],
      ['src/routes/_app/runs/$id.tsx', '/runs/42'],
      ['src/routes/(admin)/users.tsx', '/users'],
      ['src/routes/_app/docs/$.tsx', '/docs/a/b'],
    ])('passes %s for a link to %s', async (route, to) => {
      const r = await runCheck(tree([to], { 'src/routes/_app.tsx': LAYOUT, [route]: PAGE }), 12)
      expect(r.detail).not.toContain('no route file')
      expect(r.status).toBe('pass')
    })

    it('reports each unserved link once and only those', async () => {
      const r = await runCheck(
        tree(['/', '/runs', '/gone'], {
          'src/routes/_app.tsx': LAYOUT,
          'src/routes/_app/index.tsx': PAGE,
          'src/routes/_app/runs.tsx': PAGE,
        }),
        12,
      )
      expect(r.status).toBe('fail')
      expect(r.detail).toContain('links to /gone but')
      expect(r.detail).not.toContain('links to / but')
      expect(r.detail).not.toContain('links to /runs but')
    })

    it('does not judge a code-routed app, which has no routes directory', async () => {
      expect((await runCheck(tree(['/anything'], {}), 12)).status).toBe('pass')
    })

    it('ignores a route file in an ignored (-) path and the root route', async () => {
      const r = await runCheck(
        tree(['/'], { 'src/routes/__root.tsx': LAYOUT, 'src/routes/-index.tsx': PAGE }),
        12,
      )
      expect(r.status).toBe('fail')
    })
  })

  describe('a generated .basalt/sources.css', () => {
    const config =
      "import { basalt } from 'basalt-ui/vite'\nexport default { plugins: [tanstackRouter({ autoCodeSplitting: true }), basalt()] }\n"

    /** A tree on a real git repo, with the generated file added to the index. */
    function tracked(): string {
      const dir = makeTree('app', {
        'vite.config.ts': config,
        '.basalt/sources.css': '@source "../src";\n',
      })
      rmSync(join(dir, '.git'), { recursive: true })
      execFileSync('git', ['init', '-q'], { cwd: dir })
      execFileSync('git', ['add', '-f', '.basalt/sources.css'], { cwd: dir })
      return dir
    }

    it('is reported when git tracks it', async () => {
      const r = await runCheck(tracked(), 12)
      expect(r.status).toBe('fail')
      expect(r.detail).toContain('.basalt/sources.css is tracked by git')
      expect(r.detail).toContain('git rm --cached .basalt/sources.css')
    })

    it('passes once it is untracked', async () => {
      const dir = tracked()
      execFileSync('git', ['rm', '-q', '--cached', '.basalt/sources.css'], { cwd: dir })
      expect((await runCheck(dir, 12)).status).toBe('pass')
    })
  })
})
