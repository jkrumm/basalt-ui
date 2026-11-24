/**
 * Renders what `sync` places, in memory, as bytes the engine compares with the tree: the managed
 * agent files, the AGENTS block and (through the `presetFiles` seam) generated preset files.
 *
 * Shipped layout, relative to the package root:
 *   agent/rules/basalt-*.md                              -> .claude/rules/
 *   agent/skills/basalt-<name>/ (every file)             -> .claude/skills/
 *   agent/agents/basalt-*.md, agent/reviewer/basalt-*.md -> .claude/agents/
 *   agent/templates/AGENTS-block.md.tpl                  -> the block in AGENTS.md
 *   agent/templates/hook.mjs.tpl                         -> .basalt/hook.mjs (generated)
 * and, from the install itself, the merged hook entries of .claude/settings.json and every token
 * sheet the manifest records (`renderInstallUnits`), so a later release reaches each of them.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { renderRulePaths } from '../index'
import { hooksObject, mergeSettings, SETTINGS_PATH, SHIM } from '../lint/settings'
import type { Manifest } from '../manifest'
import { renderTokens } from '../tokens-css'
import { REPO, renameRefs, siblingName } from './sibling'
import type { Sibling } from './sibling'

/**
 * A file `sync` places. `generated` files are overwritten; the rest are digest-guarded. `source` is
 * the shipped file it renders from, relative to the package root (the tarball-parity gate reads it).
 */
export type Unit = { path: string; content: string; generated?: boolean; source?: string }
export type PresetFiles = (manifest: Manifest) => Unit[]

/** Rule roots: every declared non-`tokens` root, sorted so a reorder is no drift; `src` if none. */
export function ruleRoots(manifest: Manifest): string[] {
  const roots = Object.entries(manifest.roots)
    .filter(([, profile]) => profile !== 'tokens')
    .map(([root]) => root.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.')
  return roots.length > 0 ? [...new Set(roots)].toSorted() : ['src']
}

/** Every declared root is `tokens` (or none is declared at profile `tokens`): no agent layer, no lint, no hook. */
export function tokensOnly(manifest: Manifest): boolean {
  const declared = Object.values(manifest.roots)
  return (declared.length > 0 ? declared : [manifest.profile]).every((p) => p === 'tokens')
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

/** The shipped skill directory names (`basalt-design`, ...). */
function skillNames(pkgRoot: string): string[] {
  const dir = resolve(pkgRoot, 'agent/skills')
  return existsSync(dir) ? readdirSync(dir).filter((n) => n.startsWith('basalt-')) : []
}

/**
 * The managed agent files, in path order. Empty when every root is `tokens`: no agent layer. A
 * `sibling` install places its rules and skills at the repo root under its prefix (`repo:` paths),
 * with the rules' `paths:` keyed on the app directory; its subagents stay in the app.
 */
export function renderManaged(
  pkgRoot: string,
  manifest: Manifest,
  sibling: Sibling | null = null,
): Unit[] {
  if (tokensOnly(manifest)) return []
  const roots = ruleRoots(manifest).map((root) =>
    sibling === null || sibling.appRel === ''
      ? root
      : root === '.'
        ? sibling.appRel
        : `${sibling.appRel}/${root}`,
  )
  const place = (from: string, dest: string, nested: boolean, rules = false): Unit[] =>
    basaltFiles(resolve(pkgRoot, from), nested).map((rel) => {
      const text = readFileSync(resolve(pkgRoot, from, rel), 'utf8')
      const source = `${from}/${rel}`
      if (sibling === null || dest === 'agents') {
        return {
          path: `.claude/${dest}/${rel}`,
          content: rules ? renderRulePaths(text, roots) : text,
          source,
        }
      }
      const [head = '', ...tail] = rel.split('/')
      const renamed = [siblingName(head.replace(/\.md$/, ''), sibling.prefix), ...tail].join('/')
      const content = rules
        ? renderRulePaths(text, roots)
        : renameRefs(text, sibling.prefix, skillNames(pkgRoot))
      return {
        source,
        path: `${REPO}.claude/${dest}/${renamed}${rules ? '.md' : ''}`,
        content:
          rules || tail.join('/') !== 'SKILL.md'
            ? content
            : content.replace(/^name: .*$/m, `name: ${siblingName(head, sibling.prefix)}`),
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
export function renderBlock(
  pkgRoot: string,
  manifest: Manifest,
  version: string,
  sibling: Sibling | null = null,
): string | null {
  const template = resolve(pkgRoot, 'agent/templates/AGENTS-block.md.tpl')
  if (!existsSync(template)) return null
  const vars: Record<string, string> = { BASALT_VERSION: version, PROFILE: manifest.profile }
  const fill = (_: string, key: string): string => vars[key] ?? `{{${key}}}`
  const block = readFileSync(template, 'utf8')
    .replace(/\{\{(\w+)\}\}/g, fill)
    .trim()
  return sibling === null ? block : renameRefs(block, sibling.prefix, skillNames(pkgRoot))
}

export const HOOK_TEMPLATE = 'agent/templates/hook.mjs.tpl'
const BLOCK_TEMPLATE = 'agent/templates/AGENTS-block.md.tpl'

/**
 * What `init` places beside the agent files, rendered for `sync` so a later release reaches it: the
 * hook shim, the basalt entries merged into `.claude/settings.json` (every other byte as written)
 * and each token sheet the manifest records, rendered from its flags. All generated. A sibling
 * install registers no hook (its `check-v3` holds the line); an install that runs no lint neither.
 * `problems` names what could not be rendered: an unparseable settings file, a failing flag set.
 */
export function renderInstallUnits({
  root,
  pkgRoot,
  manifest,
  sibling,
  version,
}: {
  root: string
  pkgRoot: string
  manifest: Manifest
  sibling: Sibling | null
  version: string
}): { units: Unit[]; problems: string[] } {
  const units: Unit[] = []
  const problems: string[] = []
  if (sibling === null && !tokensOnly(manifest)) {
    const shim = resolve(pkgRoot, HOOK_TEMPLATE)
    if (existsSync(shim)) {
      units.push({
        path: SHIM,
        content: readFileSync(shim, 'utf8'),
        generated: true,
        source: HOOK_TEMPLATE,
      })
    } else problems.push(`${pkgRoot} ships no ${HOOK_TEMPLATE}`)
    const settings = resolve(root, SETTINGS_PATH)
    const merged = mergeSettings(existsSync(settings) ? readFileSync(settings, 'utf8') : null)
    if ('text' in merged) units.push({ path: SETTINGS_PATH, content: merged.text, generated: true })
    else {
      const entries = JSON.stringify({ hooks: hooksObject() }, null, 2)
      problems.push(`${merged.error}; merge these hook entries into it by hand:\n${entries}`)
    }
  }
  for (const entry of manifest.tokens) {
    const emitted = renderTokens([...entry.flags, '--out', entry.out], root, version)
    if ('error' in emitted) problems.push(`${entry.out}: ${emitted.error}`)
    else if ('files' in emitted) {
      for (const { out, content } of emitted.files)
        units.push({ path: out, content, generated: true })
    }
  }
  return { units, problems }
}

/**
 * Every shipped file `sync` and `init` read, relative to the package root: what each profile's
 * render takes its bytes from, the block template, the hook template and the lint presets. The
 * tarball-parity gate asserts each is in the packed artifact.
 */
export function shippedSources(pkgRoot: string): string[] {
  const profiles = ['site', 'bridge', 'parts', 'app'] as const
  const sources = profiles.flatMap((profile) =>
    renderManaged(pkgRoot, {
      profile,
      version: '',
      roots: { src: profile },
      ejected: {},
      managed: {},
      deepRender: [],
      authoredContent: [],
      viewports: [],
      tokens: [],
      rest: {},
    }).flatMap((unit) => (unit.source === undefined ? [] : [unit.source])),
  )
  const presets = profiles.map((profile) => `configs/oxlint-${profile}.json`)
  return [...new Set([...sources, BLOCK_TEMPLATE, HOOK_TEMPLATE, ...presets])].toSorted()
}
