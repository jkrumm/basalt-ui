/**
 * The waiver budget in an app, on the real app preset: the first reasoned waiver passes `lint` and
 * its count lands in `.basalt/budget.json` (the record follows the count, so the diff shows it);
 * an unreasoned one is a `waiver-needs-reason` finding and fails. Needs the built plugin (dist).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { run } from '../index'

const PKG = fileURLToPath(new URL('../../../', import.meta.url))
const OXLINT = join(PKG, '../../node_modules/.bin/oxlint')

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function put(dir: string, rel: string, text: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), text)
}

/** An app install on the shipped app preset with the seeded budget (waivers 0). */
function app(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-waiver-'))
  dirs.push(dir)
  spawnSync('git', ['init', '-q'], { cwd: dir })
  put(dir, 'package.json', '{"name":"app","private":true}\n')
  put(
    dir,
    '.basalt/manifest.json',
    JSON.stringify({ format: 1, profile: 'app', version: '3.0.0', roots: { src: 'app' } }),
  )
  put(
    dir,
    '.basalt/budget.json',
    JSON.stringify({
      format: 1,
      ejects: 3,
      adopted: 0,
      waivers: 0,
      escapes: 3,
      profileFloor: 'app',
      raises: [],
    }),
  )
  mkdirSync(join(dir, 'node_modules/@shadcn'), { recursive: true })
  mkdirSync(join(dir, 'node_modules/.bin'))
  symlinkSync(PKG, join(dir, 'node_modules/basalt-ui'))
  symlinkSync(join(PKG, 'node_modules/@shadcn/lint'), join(dir, 'node_modules/@shadcn/lint'))
  symlinkSync(OXLINT, join(dir, 'node_modules/.bin/oxlint'))
  put(dir, '.oxlintrc.json', readFileSync(join(PKG, 'configs/oxlint-app.json'), 'utf8'))
  for (const [rel, text] of Object.entries(files)) put(dir, rel, text)
  return dir
}

async function lint(dir: string): Promise<{ code: number; log: string }> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  console.log = console.error = (...args: unknown[]) => void (log += `${args.join(' ')}\n`)
  try {
    return { code: await run(['lint'], dir), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const waivers = (dir: string): number =>
  (JSON.parse(readFileSync(join(dir, '.basalt/budget.json'), 'utf8')) as { waivers: number })
    .waivers

describe('the waiver budget in an app', () => {
  it('passes a first reasoned waiver and records its count', async () => {
    const dir = app({
      'src/brand.ts':
        "// oxlint-disable-next-line basalt/color-literal -- the brand mark keeps its print hex\nexport const BRAND_MARK = '#ff0000'\n",
    })
    const first = await lint(dir)
    expect(first.code, first.log).toBe(0)
    expect(first.log).toContain('waivers 0 -> 1, recorded')
    expect(waivers(dir)).toBe(1)
    const second = await lint(dir)
    expect(second.code).toBe(0)
    expect(second.log).not.toContain('recorded')
  })

  it('fails an unreasoned waiver', async () => {
    const dir = app({
      'src/bare.ts':
        "// oxlint-disable-next-line basalt/color-literal\nexport const BARE = '#00ff00'\n",
    })
    const out = await lint(dir)
    expect(out.code).toBe(1)
    expect(out.log).toContain('src/bare.ts:1 basalt/waiver-needs-reason')
  })
})
