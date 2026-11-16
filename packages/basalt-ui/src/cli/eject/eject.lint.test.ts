/**
 * Every shipped primitive, ejected unedited, lints clean (v3-lint-2-eject-clean's acceptance, which no
 * test held until lint cycle 3). A scratch app at profile `app` loads both JS plugins, `eject --all`
 * writes zone E into its preset, then the real `basalt-ui lint` must exit 0 with nothing under
 * `src/components/ui/`. Runs the built CLI (`bin` reads `dist`), as a consumer does.
 *
 * The second test keeps `require-static-classes` honest outside zone E: the rule stays on in app code.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { PKG_ROOT } from '../../../test/fixtures/eject/harness'

const BIN = join(PKG_ROOT, 'bin/basalt-ui.mjs')
const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const nodeModule = (name: string): string => {
  const own = join(PKG_ROOT, 'node_modules', name)
  return existsSync(own) ? own : resolve(PKG_ROOT, '../../node_modules', name)
}

function sh(cwd: string, command: string, args: string[]): { code: number; out: string } {
  const run = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(cwd, 'node_modules/.bin')}:${process.env['PATH']}` },
  })
  return { code: run.status ?? 1, out: `${run.stdout}${run.stderr}` }
}

/** A fresh app at profile `app`, initialised by the CLI, with oxlint and both JS plugins linked in. */
function scratchApp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-eject-lint-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'node_modules/@shadcn'), { recursive: true })
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'eject-lint-scratch',
      private: true,
      type: 'module',
      dependencies: { 'basalt-ui': '*', react: '*' },
      devDependencies: { oxlint: '*', '@shadcn/lint': '*', stylelint: '*' },
    }),
  )
  symlinkSync(PKG_ROOT, join(dir, 'node_modules/basalt-ui'))
  for (const dep of ['oxlint', 'stylelint', 'postcss', 'postcss-html', 'react']) {
    symlinkSync(nodeModule(dep), join(dir, 'node_modules', dep))
  }
  symlinkSync(nodeModule('@shadcn/lint'), join(dir, 'node_modules/@shadcn/lint'))
  symlinkSync('../oxlint/bin/oxlint', join(dir, 'node_modules/.bin/oxlint'))
  symlinkSync('../stylelint/bin/stylelint.mjs', join(dir, 'node_modules/.bin/stylelint'))
  sh(dir, 'git', ['init', '-q', '.'])
  const init = sh(dir, 'bun', [BIN, 'init', '--profile', 'app', '--root', 'src', '--no-install'])
  expect(init.code).toBe(0)
  writeFileSync(join(dir, 'src/index.css'), "@import 'basalt-ui/tailwind.css';\n")
  writeFileSync(join(dir, 'src/index.ts'), 'export const ok = 1\n')
  // eject aliases the file through `basalt()` in the app's vite config.
  writeFileSync(
    join(dir, 'vite.config.ts'),
    "import { defineConfig } from 'vite'\nimport { basalt } from 'basalt-ui/vite'\nexport default defineConfig({ plugins: [basalt()] })\n",
  )
  writeFileSync(
    join(dir, 'tsconfig.json'),
    '{ "compilerOptions": { "jsx": "react-jsx", "strict": true } }\n',
  )
  sh(dir, 'git', ['add', '-A'])
  sh(dir, 'git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'])
  return dir
}

describe('eject --all, then basalt-ui lint (scratch app, profile app, both JS plugins)', () => {
  it('lints every unedited ejected primitive clean', () => {
    const dir = scratchApp()
    const ejected = sh(dir, 'bun', [
      BIN,
      'eject',
      '--all',
      '--reason',
      'every primitive',
      '--raise',
      'lint cycle 3',
    ])
    expect(ejected.out).toContain('button -> src/components/ui/button.tsx')
    expect(ejected.code).toBe(0)

    const lint = sh(dir, 'bun', [BIN, 'lint'])
    const underUi = lint.out.split('\n').filter((line) => line.includes('src/components/ui/'))
    expect(underUi).toEqual([])
    expect(lint.out).toContain('no findings')
    expect(lint.code).toBe(0)
  }, 180_000)

  it('still reports a dynamic className in app code outside zone E', () => {
    const dir = scratchApp()
    expect(sh(dir, 'bun', [BIN, 'eject', 'button', '--reason', 'x', '--raise', 'y']).code).toBe(0)
    writeFileSync(
      join(dir, 'src/page.tsx'),
      "import { Button } from 'basalt-ui/ui/button'\nexport const Page = ({ tone }: { tone: string }) => <Button className={`bg-${tone}`}>x</Button>\n",
    )
    const lint = sh(dir, 'bun', [BIN, 'lint'])
    expect(lint.out).toContain('require-static-classes')
    expect(lint.out).toContain('src/page.tsx')
    expect(lint.code).toBe(1)
  }, 180_000)
})
