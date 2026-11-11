/**
 * Renders what `sync` places, in memory, as bytes the engine compares with the tree: the managed
 * agent files, the AGENTS block and (through the `presetFiles` seam) generated preset files.
 *
 * Shipped layout, relative to the package root:
 *   agent/rules/basalt-*.md                              -> .claude/rules/
 *   agent/skills/basalt-<name>/ (every file)             -> .claude/skills/
 *   agent/agents/basalt-*.md, agent/reviewer/basalt-*.md -> .claude/agents/
 *   agent/templates/AGENTS-block.md.tpl                  -> the block in AGENTS.md
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { renderRulePaths } from '../index'
import type { Manifest } from '../manifest'

/** A file `sync` places. `generated` files are overwritten; the rest are digest-guarded. */
export type Unit = { path: string; content: string; generated?: boolean }
export type PresetFiles = (manifest: Manifest) => Unit[]

/** The seam v3-sk-3 fills: no preset content ships with the sync engine. */
export const noPresetFiles: PresetFiles = () => []

/** Rule roots: every declared non-`tokens` root, sorted so a reorder is no drift; `src` if none. */
export function ruleRoots(manifest: Manifest): string[] {
  const roots = Object.entries(manifest.roots)
    .filter(([, profile]) => profile !== 'tokens')
    .map(([root]) => root.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.')
  return roots.length > 0 ? [...new Set(roots)].toSorted() : ['src']
}

/** Files under `dir`, relative and POSIX, sorted; a `basalt-` name at the top, no dot-segments. */
function basaltFiles(dir: string, nested: boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((rel) => rel.startsWith('basalt-') && rel.includes('/') === nested)
    .filter((rel) => !rel.split('/').some((part) => part.startsWith('.')))
    .toSorted()
}

/** The managed agent files, in path order. Empty when every root is `tokens`: no agent layer. */
export function renderManaged(pkgRoot: string, manifest: Manifest): Unit[] {
  const declared = Object.values(manifest.roots)
  if ((declared.length > 0 ? declared : [manifest.profile]).every((p) => p === 'tokens')) return []
  const roots = ruleRoots(manifest)
  const place = (from: string, dest: string, nested: boolean, rules = false): Unit[] =>
    basaltFiles(resolve(pkgRoot, from), nested).map((rel) => {
      const text = readFileSync(resolve(pkgRoot, from, rel), 'utf8')
      return {
        path: `.claude/${dest}/${rel}`,
        content: rules ? renderRulePaths(text, roots) : text,
      }
    })
  return [
    ...place('agent/rules', 'rules', false, true),
    ...place('agent/skills', 'skills', true),
    ...place('agent/agents', 'agents', false),
    ...place('agent/reviewer', 'agents', false),
  ].toSorted((a, b) => a.path.localeCompare(b.path))
}

/** The AGENTS block, markers included, or null when the package ships no template. */
export function renderBlock(pkgRoot: string, manifest: Manifest, version: string): string | null {
  const template = resolve(pkgRoot, 'agent/templates/AGENTS-block.md.tpl')
  if (!existsSync(template)) return null
  const vars: Record<string, string> = { BASALT_VERSION: version, PROFILE: manifest.profile }
  const fill = (_: string, key: string): string => vars[key] ?? `{{${key}}}`
  return readFileSync(template, 'utf8')
    .replace(/\{\{(\w+)\}\}/g, fill)
    .trim()
}
