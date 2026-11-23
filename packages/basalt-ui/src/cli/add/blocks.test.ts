/**
 * The shipped blocks (`blocks/<name>/`) hold the contract `add` relies on: a valid descriptor that
 * names every file, imports limited to published `basalt-ui` specifiers, declared peers and the
 * block's own files (so the installed bytes compile where they land, with no rewrite), and no waiver.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BLOCKS_DIR, DESCRIPTOR, blockNames, readBlock } from './catalog'
import type { Block } from './catalog'

const PKG_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>
  peerDependencies?: Record<string, string>
}

/**
 * App dependencies a block may import beyond the peers: the recommended icon set (basalt-ui.md, the
 * `IconComponent` rule) and the schema library a form's validators take. `add` names either when
 * the app's package.json lacks it.
 */
const APP_DEPS = new Set(['lucide-react', 'zod'])

/** The reference pages, one block per archetype (docs/v3/BENCHMARK-ACCORDEE-BLUEPRINT.md 7). */
const REFERENCE = [
  'assistant',
  'create-flow',
  'list-page',
  'mailbox',
  'notes-list',
  'record-page',
  'settings-page',
]

/** Static imports and re-exports at the start of a statement, side-effect imports and `import()`. */
const SPECIFIER =
  /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s*|^\s*import\s*|\bimport\(\s*)(['"])([^'"\n]+)\1/gm

function published(spec: string): boolean {
  if (spec === 'basalt-ui') return true
  if (!spec.startsWith('basalt-ui/')) return false
  const sub = `./${spec.slice('basalt-ui/'.length)}`
  return Object.keys(pkg.exports).some((key) =>
    key.endsWith('/*')
      ? sub.startsWith(key.slice(0, -1)) && sub.length > key.length - 1
      : key === sub,
  )
}

const packageOf = (spec: string): string =>
  spec
    .split('/')
    .slice(0, spec.startsWith('@') ? 2 : 1)
    .join('/')

const blocks = blockNames(PKG_ROOT).map((name) => {
  const block = readBlock(PKG_ROOT, name)
  if (block === null || 'error' in block) throw new Error(block?.error ?? `${name} vanished`)
  return block
})

describe('shipped blocks', () => {
  it('ship the reference pages', () => {
    expect(blocks.map((b) => b.name)).toEqual(REFERENCE)
  })

  it.each(blocks.map((b) => [b.name, b] as [string, Block]))(
    '%s names every file, imports only what it declares and may, and waives nothing',
    (name, block) => {
      const dir = join(PKG_ROOT, BLOCKS_DIR, name)
      const onDisk = readdirSync(dir).filter((f) => f !== DESCRIPTOR)
      expect(onDisk.toSorted()).toEqual([...block.files].toSorted())

      const used = new Set<string>()
      for (const [file, text] of block.sources) {
        for (const [, , spec = ''] of text.matchAll(SPECIFIER)) {
          if (spec.startsWith('.')) {
            const sibling = spec.replace(/^\.\//, '')
            expect(
              ['', '.ts', '.tsx'].some((ext) => block.files.includes(`${sibling}${ext}`)),
              `${file} imports ${spec}, which is not a file of the block`,
            ).toBe(true)
            continue
          }
          used.add(spec)
        }
        expect(text, `${file} carries a waiver`).not.toContain('oxlint-disable')
        expect(text, `${file} has a custom column`).not.toContain('c.custom(')
      }
      expect([...used].toSorted()).toEqual([...block.imports].toSorted())
      const peers = new Set(['react', ...APP_DEPS, ...Object.keys(pkg.peerDependencies ?? {})])
      for (const spec of block.imports) {
        expect(published(spec) || peers.has(packageOf(spec)), `${name} imports ${spec}`).toBe(true)
      }
      expect(block.ports.length).toBeGreaterThan(0)
    },
  )
})
