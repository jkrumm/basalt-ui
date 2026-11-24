/**
 * Fast tarball-parity approximation: every shipped file `sync` renders from (`shippedSources`: the
 * agent files of each profile, the block and hook templates, the lint presets) must exist on disk
 * AND be covered by a package.json `files` entry, or `init` and `sync` silently skip it for every
 * npm consumer while working fine in this repo (exactly how the skills shipped outside the tarball
 * at 1.0.0). The authoritative check renders from the real packed artifact in scripts/pack-test.sh
 * (check-tarball-parity.mjs); this one runs on every `bun test`.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { shippedSources } from './sync/render'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as {
  files: string[]
  bin: Record<string, string>
}

/** True when `path` is matched by one of the `files` entries (dir prefix or exact file). */
function coveredByFilesField(path: string): boolean {
  return pkg.files.some((entry) => {
    const dir = entry.endsWith('/') ? entry : `${entry}/`
    return path === entry || path.startsWith(dir)
  })
}

const sources = shippedSources(PKG_ROOT)

describe('tarball parity (files-field approximation)', () => {
  it('names the hook template, the block template and every rule', () => {
    expect(sources).toContain('agent/templates/hook.mjs.tpl')
    expect(sources).toContain('agent/templates/AGENTS-block.md.tpl')
    expect(sources.filter((s) => s.startsWith('agent/rules/')).length).toBeGreaterThan(0)
  })

  it.each(sources)('CLI-read source %s exists and is covered by the files field', (source) => {
    expect(existsSync(resolve(PKG_ROOT, source))).toBe(true)
    expect(coveredByFilesField(source)).toBe(true)
  })

  it('every bin entry points at a shipped file', () => {
    for (const binPath of Object.values(pkg.bin)) {
      const rel = binPath.replace(/^\.\//, '')
      expect(existsSync(resolve(PKG_ROOT, rel))).toBe(true)
      expect(coveredByFilesField(rel)).toBe(true)
    }
  })
})
