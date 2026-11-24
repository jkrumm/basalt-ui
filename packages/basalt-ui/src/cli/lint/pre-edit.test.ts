import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runStylelint } from './engine'
import type { Project } from './engine'
import { runHookEvent } from './hook'

const STYLELINT = resolve(
  fileURLToPath(new URL('../../../node_modules/.bin/stylelint', import.meta.url)),
)

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function app(files: Record<string, string>): Project {
  const root = mkdtempSync(join(tmpdir(), 'basalt-pre-edit-'))
  dirs.push(root)
  for (const [path, text] of Object.entries({ 'src/index.ts': 'export {}\n', ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return { root, manifest: null, roots: [['src', 'app']] }
}

/** The exit code and what the hook told the model for one Write of `content` to `file`. */
function preEdit(project: Project, file: string, content: string): { code: number; err: string } {
  const saved = console.error
  let err = ''
  console.error = (...args: unknown[]) => void (err += `${args.join(' ')}\n`)
  try {
    const code = runHookEvent('pre-edit', project, {
      cwd: project.root,
      tool_input: { file_path: join(project.root, file), content },
    })
    return { code, err }
  } finally {
    console.error = saved
  }
}

describe('pre-edit denies what doctor rejects', () => {
  it('denies ignorePatterns over a declared root', () => {
    const project = app({ 'src/features/f.tsx': 'export {}\n', '.oxlintrc.json': '{}' })
    const { code, err } = preEdit(
      project,
      '.oxlintrc.json',
      '{ "ignorePatterns": ["src/features/**"] }',
    )
    expect(code).toBe(2)
    expect(err).toContain('ignorePatterns')
    expect(err).toContain('src/features/f.tsx')
  })

  it('allows an ignorePatterns entry over a generated file doctor accepts, and denies a hand-written folder', () => {
    const project = app({
      'src/generated/api.gen.ts': 'export {}\n',
      'src/generated/handwritten.ts': 'export {}\n',
      '.oxlintrc.json': '{}',
    })
    expect(
      preEdit(project, '.oxlintrc.json', '{ "ignorePatterns": ["src/generated/api.gen.ts"] }').code,
    ).toBe(0)
    const denied = preEdit(project, '.oxlintrc.json', '{ "ignorePatterns": ["src/generated/**"] }')
    expect(denied.code).toBe(2)
    expect(denied.err).toContain('src/generated/handwritten.ts')
    expect(denied.err).toContain('*.gen.*')
  })

  it('denies a hand edit of budget.json naming the raise route, and the rest of .basalt naming its writers', () => {
    const project = app({ '.basalt/budget.json': '{ "waivers": 0 }\n' })
    const budget = preEdit(project, '.basalt/budget.json', '{ "waivers": 3 }\n')
    expect(budget.code).toBe(2)
    expect(budget.err).toContain('basalt-ui lint --raise <field> --consumer')
    const shim = preEdit(project, '.basalt/hook.mjs', '')
    expect(shim.code).toBe(2)
    expect(shim.err).toContain('`basalt-ui init`, `sync`')
  })

  it('denies a nested .oxlintrc.json without the basalt extends, and allows one that extends it', () => {
    const project = app({ 'src/features/f.tsx': 'export {}\n', '.oxlintrc.json': '{}' })
    const bare = preEdit(project, 'src/features/.oxlintrc.json', '{}')
    expect(bare.code).toBe(2)
    expect(bare.err).toContain('.oxlintrc.basalt.json')
    expect(
      preEdit(
        project,
        'src/features/.oxlintrc.json',
        '{ "extends": ["../../.oxlintrc.basalt.json"] }',
      ).code,
    ).toBe(0)
    expect(preEdit(project, 'tools/.oxlintrc.json', '{}').code).toBe(0)
  })

  it('allows an ignorePatterns entry outside the roots, and one already there', () => {
    const project = app({ '.oxlintrc.json': '{ "ignorePatterns": ["src/features/**"] }' })
    expect(preEdit(project, '.oxlintrc.json', '{ "ignorePatterns": ["dist/**"] }').code).toBe(0)
    expect(
      preEdit(project, '.oxlintrc.json', '{ "ignorePatterns": ["src/features/**", "dist/**"] }')
        .code,
    ).toBe(0)
  })

  it('denies a blanket file-level disable and allows a rule-named one', () => {
    const project = app({})
    expect(preEdit(project, 'src/a.tsx', '/* oxlint-disable */\nexport {}\n').code).toBe(2)
    expect(
      preEdit(project, 'src/a.tsx', '/* oxlint-disable basalt/color-literal -- why */\nexport {}\n')
        .code,
    ).toBe(0)
  })

  it('does not deny a blanket disable that is already in the file, or outside the roots', () => {
    const project = app({ 'src/a.tsx': '/* oxlint-disable */\nexport {}\n' })
    expect(preEdit(project, 'src/a.tsx', '/* oxlint-disable */\nexport const a = 1\n').code).toBe(0)
    expect(preEdit(project, 'scripts/a.ts', '/* oxlint-disable */\nexport {}\n').code).toBe(0)
  })

  it('denies a .stylelintignore over a stylesheet under a root', () => {
    const project = app({ 'src/features/f.module.css': '.a {}\n' })
    const { code, err } = preEdit(project, '.stylelintignore', 'src/features/\n')
    expect(code).toBe(2)
    expect(err).toContain('src/features/f.module.css')
    expect(preEdit(project, '.stylelintignore', 'dist/\n').code).toBe(0)
  })
})

describe('basalt-ui lint ignores a .stylelintignore', () => {
  it('still reports a stylesheet the file names', () => {
    const project = app({
      'src/features/f.module.css': '.list {\n  overflow-y: auto;\n}\n',
      '.stylelintrc.basalt.json': JSON.stringify({
        rules: { 'declaration-property-value-disallowed-list': { 'overflow-y': ['auto'] } },
      }),
      '.stylelintignore': 'src/features/\n',
    })
    mkdirSync(join(project.root, 'node_modules/.bin'), { recursive: true })
    symlinkSync(STYLELINT, join(project.root, 'node_modules/.bin/stylelint'))
    const findings = runStylelint(project, ['src/features/f.module.css'])
    expect(findings.map((f) => f.id)).toEqual([
      'stylelint/declaration-property-value-disallowed-list',
    ])
  })
})

describe('pre-edit leaves a path the lint config already ignores', () => {
  it('allows a blanket disable in an ignorePatterns path, and still denies its neighbour', () => {
    const project = app({ '.oxlintrc.json': '{ "ignorePatterns": ["src/gen/**"] }' })
    expect(preEdit(project, 'src/gen/api.ts', '/* eslint-disable */\nexport {}\n').code).toBe(0)
    expect(preEdit(project, 'src/a.ts', '/* eslint-disable */\nexport {}\n').code).toBe(2)
  })

  it('reads .oxlintignore the same way', () => {
    const project = app({ '.oxlintignore': 'generated/\n' })
    expect(preEdit(project, 'src/generated/api.ts', '/* eslint-disable */\nexport {}\n').code).toBe(
      0,
    )
  })
})
