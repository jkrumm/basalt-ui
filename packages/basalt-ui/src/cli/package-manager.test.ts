import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  addCommand,
  execCommand,
  installAllCommand,
  packageManager,
  playwrightInstall,
} from './package-manager'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A repo (a `.git` marker) with `files` at its root and an app package below it. */
function repo(files: string[]): { root: string; app: string } {
  const root = mkdtempSync(join(tmpdir(), 'basalt-pm-'))
  dirs.push(root)
  mkdirSync(join(root, '.git'))
  mkdirSync(join(root, 'apps/web'), { recursive: true })
  for (const file of files) writeFileSync(join(root, file), '')
  return { root, app: join(root, 'apps/web') }
}

describe('the package manager a fix-it line names', () => {
  it('reads the lockfile at the install root or above it, npm without one', () => {
    expect(packageManager(repo([]).app)).toBe('npm')
    expect(packageManager(repo(['bun.lock']).app)).toBe('bun')
    expect(packageManager(repo(['pnpm-lock.yaml']).app)).toBe('pnpm')
    expect(packageManager(repo(['yarn.lock']).app)).toBe('yarn')
  })

  it('renders add, install and the bin runner for each', () => {
    const { app } = repo(['pnpm-lock.yaml', 'pnpm-workspace.yaml'])
    expect(addCommand(app, ['oxlint@1.93.0']).join(' ')).toBe(
      'pnpm add --save-dev --save-exact -w oxlint@1.93.0',
    )
    expect(installAllCommand(app)).toBe('pnpm install')
    expect(execCommand(app)).toBe('pnpm exec')
    expect(addCommand(repo([]).app, ['react'], false).join(' ')).toBe(
      'npm install --save --save-exact react',
    )
    expect(playwrightInstall(repo(['yarn.lock']).app)).toBe(
      'yarn add --dev --exact playwright && yarn playwright install chromium',
    )
  })
})
