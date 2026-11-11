/** The helpers `sync` (v3-prim-p8) imports for an ejected file: header, seed, merge, formatter. */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatText, resolveFormatter } from './formatter'
import { ejectHeader, parseHeader, stripHeader, withHeader } from './header'
import { mergeFile } from './merge-file'
import { ejectedGuard, ejectedSource, readSeed, seedDigest, seedNames } from './seed'

const PKG_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const OXFMT = fileURLToPath(new URL('../../../../../node_modules/.bin/oxfmt', import.meta.url))

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('header', () => {
  it('round-trips and splits off line 1 only when it is a header', () => {
    const header = ejectHeader('button', '3.1.0', 'marketing CTA needs 56px')
    expect(parseHeader(header)).toEqual({
      name: 'button',
      version: '3.1.0',
      reason: 'marketing CTA needs 56px',
    })
    expect(stripHeader(withHeader(header, 'a\nb\n'))).toEqual({ header, body: 'a\nb\n' })
    expect(stripHeader('// plain comment\nx\n')).toEqual({
      header: null,
      body: '// plain comment\nx\n',
    })
  })
})

describe('seed', () => {
  it('lists the shipped primitives and digests seed plus guard', () => {
    expect(seedNames(PKG_ROOT)).toContain('button')
    expect(seedNames(PKG_ROOT)).not.toContain('button.test')
    const seed = readSeed(PKG_ROOT, 'button')
    const raw = readFileSync(join(PKG_ROOT, 'src/ui/button.tsx'), 'utf8')
    const guard = readFileSync(join(PKG_ROOT, 'src/ui/button.guard.ts'), 'utf8')
    expect(seed?.digest).toBe(seedDigest(raw, guard))
    expect(seedDigest(raw, guard)).not.toBe(seedDigest(raw, `${guard} `))
    expect(seedDigest(raw, null)).not.toBe(seedDigest(raw, ''))
    expect(readSeed(PKG_ROOT, '../core/cn')).toBeNull()
  })

  it('moves sibling and cn imports to published specifiers and names the rest', () => {
    const seed =
      "import { cn } from '../core/cn'\nimport { Input } from './input'\nimport x from 'react'\n"
    expect(ejectedSource(seed)).toEqual({
      text: "import { cn } from 'basalt-ui'\nimport { Input } from 'basalt-ui/ui/input'\nimport x from 'react'\n",
    })
    expect(ejectedSource("import { a } from '../core/phase'\n")).toEqual({
      error: "imports '../core/phase', which no published specifier exports",
    })
  })

  it('drops the closed half of a guard and keeps its own relative import', () => {
    const guard =
      "import type { P } from './button'\n// basalt:guard requires\nexport const r = 1\n\n// basalt:guard closed\n// @ts-expect-error\nexport const c = 2\n"
    expect(ejectedGuard(guard, 'button')).toEqual({
      text: "import type { P } from './button'\n// basalt:guard requires\nexport const r = 1\n",
    })
  })
})

describe('mergeFile', () => {
  const labels = { local: 'local', base: 'base@1', shipped: 'shipped@2' }

  it('merges disjoint edits cleanly', () => {
    const result = mergeFile({
      local: 'a\nB\nc\nd\n',
      base: 'a\nb\nc\nd\n',
      shipped: 'a\nb\nc\nD\n',
      labels,
    })
    expect(result).toEqual({ text: 'a\nB\nc\nD\n', conflicts: 0 })
  })

  it('counts a conflict and writes diff3 markers with the labels', () => {
    const result = mergeFile({ local: 'x\n', base: 'a\n', shipped: 'y\n', labels })
    expect('conflicts' in result && result.conflicts).toBe(1)
    expect('text' in result && result.text).toContain('||||||| base@1')
  })
})

describe('formatter', () => {
  it('resolves the declared oxfmt bin and formats through stdin', () => {
    const dir = mkdtempSync(join(tmpdir(), 'basalt-fmt-'))
    scratch.push(dir)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { oxfmt: '*' } }))
    mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
    symlinkSync(OXFMT, join(dir, 'node_modules/.bin/oxfmt'))
    const formatter = resolveFormatter(dir)
    expect(formatter?.name).toBe('oxfmt')
    expect(
      formatter === null ? null : formatText(formatter, 'const a = {b:1}\n', 'src/x.tsx'),
    ).toStartWith('const a = { b: 1 }')
  })

  it('is null when the project declares no formatter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'basalt-fmt-'))
    scratch.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    expect(resolveFormatter(dir)).toBeNull()
  })
})
