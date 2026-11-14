import { afterEach, describe, expect, it } from 'bun:test'

import { cleanupTrees, editManifest, makeTree, runCheck } from './fixture.test'

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

  it('fails a legacy [data-mantine-color-scheme] selector', async () => {
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

    it('passes when the vite plugin injects the boot script', async () => {
      const files = {
        'index.html': page('<html lang="en">'),
        'vite.config.ts':
          'export default { plugins: [basaltAppPlugin({}), tanstackRouter({ autoCodeSplitting: true })] }\n',
      }
      expect((await runCheck(makeTree('app', files), 12)).status).toBe('pass')
    })
  })

  it('fails when the manifest declares viewports but Playwright is not a dependency', async () => {
    const dir = makeTree('app')
    editManifest(dir, (m) => void (m.viewports = ['1440x900']))
    const r = await runCheck(dir, 12)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('Playwright')
  })
})
