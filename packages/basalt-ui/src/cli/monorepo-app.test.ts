/**
 * Monorepo awareness: `resolveAppDir` picks the app package once.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { resolveAppDir } from './index'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-monorepo-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, content: string): void {
  const abs = join(dir, rel)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function pkg(rel: string, body: Record<string, unknown>): void {
  write(`${rel}package.json`, JSON.stringify(body))
}

/** Root + `apps/<name>` workspace packages; each listed app depends on basalt-ui with an entry. */
function monorepo(apps: string[], rootExtra: Record<string, unknown> = {}): void {
  pkg('', {
    name: 'root',
    workspaces: ['apps/*'],
    devDependencies: { 'basalt-ui': '*' },
    ...rootExtra,
  })
  for (const app of apps) {
    pkg(`apps/${app}/`, { name: app, dependencies: { 'basalt-ui': '*' } })
    write(`apps/${app}/src/main.tsx`, '// entry\n')
  }
  write(
    'node_modules/basalt-ui/package.json',
    JSON.stringify({ name: 'basalt-ui', version: '1.0.0' }),
  )
}

describe('resolveAppDir', () => {
  it('auto-detects the one workspace package that depends on basalt-ui and has a Vite entry', () => {
    monorepo(['web'])
    pkg('apps/lib/', { name: 'lib' })
    expect(resolveAppDir(dir)).toEqual({ dir: join(dir, 'apps/web'), rel: 'apps/web' })
  })

  it('basalt.app wins over detection', () => {
    monorepo(['web', 'admin'], { basalt: { app: 'apps/admin' } })
    expect(resolveAppDir(dir)).toEqual({ dir: join(dir, 'apps/admin'), rel: 'apps/admin' })
  })

  it('two candidates is an error that names basalt.app', () => {
    monorepo(['web', 'admin'])
    const result = resolveAppDir(dir)
    expect(result).toHaveProperty('error')
    expect('error' in result && result.error).toContain('basalt.app')
  })

  it('a basalt.app outside the root or without a package.json is an error', () => {
    monorepo(['web'], { basalt: { app: '../elsewhere' } })
    expect(resolveAppDir(dir)).toHaveProperty('error')
  })

  it('a single-package app resolves to itself', () => {
    pkg('', { name: 'solo', dependencies: { 'basalt-ui': '*' } })
    write('src/main.tsx', '// entry\n')
    expect(resolveAppDir(dir)).toEqual({ dir, rel: '' })
  })
})
