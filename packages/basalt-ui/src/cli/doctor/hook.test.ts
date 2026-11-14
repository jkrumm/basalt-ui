import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanupTrees, makeTree, runCheck, settingsJson, wrappedHook } from './fixture.test'

afterEach(cleanupTrees)

describe('check 8: the hook, run black-box from a subdirectory', () => {
  it('passes: the registered command returns the seeded offender from src/', async () => {
    const dir = makeTree('app')
    const r = await runCheck(dir, 8)
    expect(r.status).toBe('pass')
    expect(r.detail).toContain('from src')
    expect(existsSync(resolve(dir, 'src/__basalt_seeded_offender__.tsx'))).toBe(false)
  })

  it('fails when settings.json registers no hook', async () => {
    const r = await runCheck(makeTree('app', { '.claude/settings.json': '{}' }), 8)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('PostToolUse registers no .basalt/hook.mjs post-edit hook')
  })

  it('fails when the shim is registered bare, because the bare form fails open', async () => {
    const bare = (event: string): string => `node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" ${event}`
    const r = await runCheck(makeTree('app', { '.claude/settings.json': settingsJson(bare) }), 8)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('fails open')
  })

  it('fails loud when the shim file is missing, and says the shim did not run', async () => {
    const r = await runCheck(makeTree('app', { '.basalt/hook.mjs': null }), 8)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('the shim did not run')
  })

  it('fails when the hook lets the seeded offender through', async () => {
    const r = await runCheck(makeTree('app', { '.basalt/hook.mjs': 'process.exit(0)\n' }), 8)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('the guard is off')
  })

  it('fails when the bin does not resolve', async () => {
    const r = await runCheck(makeTree('app', { 'node_modules/basalt-ui/bin': null }), 8)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('bin does not exist')
  })

  it('is not required when no root runs lint (profile tokens)', async () => {
    expect((await runCheck(makeTree('tokens'), 8)).status).toBe('pass')
  })
})

describe('the wrapped command fails loud, never open', () => {
  const run = (
    dir: string,
    env: Record<string, string | undefined>,
  ): { status: number | null; err: string } => {
    const out = spawnSync('/bin/sh', ['-c', wrappedHook('post-edit')], {
      cwd: dir,
      env,
      input: '{}',
      encoding: 'utf8',
    })
    return { status: out.status, err: out.stderr }
  }

  it('a missing shim file exits 2 with the fix', () => {
    const dir = makeTree('app', { '.basalt/hook.mjs': null })
    const out = run(dir, { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: dir })
    expect(out.status).toBe(2)
    expect(out.err).toContain('basalt hook: the shim did not run')
  })

  it('a missing node exits 2 with the fix', () => {
    const dir = makeTree('app')
    const out = run(dir, { PATH: '/nonexistent', CLAUDE_PROJECT_DIR: dir })
    expect(out.status).toBe(2)
    expect(out.err).toContain('basalt hook: the shim did not run')
  })

  it('an unset CLAUDE_PROJECT_DIR exits 2 with the fix', () => {
    const dir = makeTree('app')
    const out = run(dir, { PATH: process.env['PATH'] })
    expect(out.status).toBe(2)
    expect(out.err).toContain('basalt hook: the shim did not run')
  })
})

describe('check 9: the formatter fence', () => {
  it('passes when oxfmt skips .basalt/, the presets and the managed .claude paths', async () => {
    const dir = makeTree('app')
    const r = await runCheck(dir, 9)
    expect(r.status).toBe('pass')
    expect(existsSync(resolve(dir, '.basalt/basalt-doctor-probe.json'))).toBe(false)
  })

  it('fails when .claude/** is not ignored', async () => {
    const config = {
      ignorePatterns: ['.basalt/**', '.oxlintrc.basalt.json', '.stylelintrc.basalt.json'],
    }
    const r = await runCheck(makeTree('app', { '.oxfmtrc.json': JSON.stringify(config) }), 9)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('.claude/rules/ is not in the formatter ignore list')
  })

  it('fails when .stylelintrc.basalt.json is not ignored (the one the brief names)', async () => {
    const config = { ignorePatterns: ['.basalt/**', '.claude/**', '.oxlintrc.basalt.json'] }
    const r = await runCheck(makeTree('app', { '.oxfmtrc.json': JSON.stringify(config) }), 9)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('.stylelintrc.basalt.json is not in the formatter ignore list')
  })

  it('is SKIPPED when oxfmt does not resolve', async () => {
    const r = await runCheck(makeTree('app', { 'node_modules/.bin/oxfmt': null }), 9)
    expect(r.status).toBe('skipped')
  })
})
