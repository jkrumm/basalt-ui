import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { run } from '../index'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function repo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-hook-step-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

async function init(dir: string, profile: string): Promise<{ code: number; log: string }> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  console.log = console.error = (...args: unknown[]) => void (log += `${args.join(' ')}\n`)
  try {
    return { code: await run(['init', '--no-install', '--profile', profile], dir), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8')

describe('init registers the hook', () => {
  it('places the shim and the three entries, and a second run changes nothing', async () => {
    const dir = repo()
    expect((await init(dir, 'app')).code).toBe(0)
    expect(read(dir, '.basalt/hook.mjs')).toContain('lint')
    const hooks = (JSON.parse(read(dir, '.claude/settings.json')) as { hooks: object }).hooks
    expect(Object.keys(hooks)).toEqual(['PostToolUse', 'Stop', 'PreToolUse'])
    const before = [read(dir, '.basalt/hook.mjs'), read(dir, '.claude/settings.json')]
    await init(dir, 'app')
    expect([read(dir, '.basalt/hook.mjs'), read(dir, '.claude/settings.json')]).toEqual(before)
  })

  it('keeps an existing settings.json entry byte-identical', async () => {
    const guard =
      '{\n  "hooks": {\n    "PreToolUse": [\n      {\n        "matcher": "Edit",\n        "hooks": [{ "type": "command", "command": "keep-me" }]\n      }\n    ]\n  }\n}\n'
    const dir = repo({ '.claude/settings.json': guard })
    await init(dir, 'bridge')
    expect(read(dir, '.claude/settings.json')).toContain(
      '      {\n        "matcher": "Edit",\n        "hooks": [{ "type": "command", "command": "keep-me" }]\n      }',
    )
  })

  it('leaves an unparseable settings.json alone and prints the entries to place', async () => {
    const broken = '{ "hooks": { "Stop": [ ], }\n'
    const dir = repo({ '.claude/settings.json': broken })
    const out = await init(dir, 'app')
    expect(read(dir, '.claude/settings.json')).toBe(broken)
    expect(out.log).toContain('is not valid JSON')
    expect(out.log).toContain('.basalt/hook.mjs')
  })

  it('a tokens install registers no hook', async () => {
    const dir = repo()
    await init(dir, 'tokens')
    expect(existsSync(join(dir, '.basalt/hook.mjs'))).toBe(false)
    expect(existsSync(join(dir, '.claude/settings.json'))).toBe(false)
  })
})
