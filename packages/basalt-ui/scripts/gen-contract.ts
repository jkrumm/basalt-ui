#!/usr/bin/env bun
/**
 * Renders the generated sections of `docs/v3/CONTRACT.md`: what 3.0 freezes, read from the tree.
 *
 * A section sits between `<!-- generated:<name> -->` and `<!-- /generated -->`; every line outside a
 * marker pair is prose a person owns. `gen-contract.test.ts` regenerates each section and fails on drift,
 * on a file at or over 25 KB, and on any script or source that reads `docs/v3/ARCHITECTURE.md`.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-contract.ts [--check]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { ADD_HELP } from '../src/cli/add/help'
import { BUDGET_FORMAT, BUDGET_PATH, seedBudget } from '../src/cli/budget'
import { COMMAND_OPTIONS } from '../src/cli/help'
import { CLI_OWNED_KEYS, MANIFEST_FORMAT, MANIFEST_PATH, PROFILES } from '../src/cli/manifest'
import { EJECT_HELP } from '../src/cli/eject/help'
import { basaltFamilyOf } from '../src/common/basalt-family'
import plugin from '../src/lint/index'
import { tableOf } from '../src/lint/factory'
import { BASALT_NAMES } from '../src/tokens/basalt-names'
import { SURFACES } from '../src/surfaces'

const PACKAGE = resolve(import.meta.dirname, '..')
export const CONTRACT_PATH = resolve(PACKAGE, '../../docs/v3/CONTRACT.md')
export const CONTRACT_LIMIT = 25_000

const list = (items: readonly string[]): string => items.map((i) => `\`${i}\``).join(', ')
const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`
const table = (head: readonly string[], rows: readonly (readonly string[])[]): string =>
  [row(head), `|${head.map(() => '-').join('|')}|`, ...rows.map(row)].join('\n')

function subpaths(): string {
  const rows = Object.entries(SURFACES)
    .filter(([key]) => key.startsWith('./') || key === '.')
    .map(([key, spec]): [string, string, string] => {
      const peers = 'optionalPeers' in spec ? (spec.optionalPeers ?? []) : []
      return [
        key === '.' ? 'basalt-ui' : `basalt-ui/${key.slice(2)}`,
        spec.layer,
        peers.length === 0 ? 'none' : list(peers),
      ]
    })
  return table(
    ['Subpath', 'Layer', 'Optional peers'],
    rows.map((r) => r.map((c, i) => (i === 0 ? `\`${c}\`` : c))),
  )
}

function tokens(): string {
  const counts = new Map<string, number>()
  for (const name of BASALT_NAMES) {
    const family = basaltFamilyOf(name)
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }
  const families = [...counts].toSorted(([a], [b]) => a.localeCompare(b))
  return [
    `${BASALT_NAMES.length} names in ${families.length} families, each \`--basalt-<family>-…\` (name count):`,
    '',
    families.map(([family, n]) => `${family || '(bare)'} ${n}`).join(', '),
  ].join('\n')
}

function rules(): string {
  const entries = Object.entries(tableOf(plugin))
  return [
    `${entries.length} ids, reported as \`basalt/<id>\`:`,
    '',
    table(
      ['Id', 'Family', 'Profiles'],
      entries.map(([id, e]) => [`\`${id}\``, e.family, e.profiles.join(', ')]),
    ),
  ].join('\n')
}

function formats(): string {
  return table(
    ['File', 'Format', 'Keys'],
    [
      [
        `\`${MANIFEST_PATH}\``,
        String(MANIFEST_FORMAT),
        `CLI-owned: ${list(CLI_OWNED_KEYS)}; profiles: ${list(PROFILES)}`,
      ],
      [
        `\`${BUDGET_PATH}\``,
        String(BUDGET_FORMAT),
        list(['format', ...Object.keys(seedBudget('app'))]),
      ],
    ],
  )
}

/** The usage lines of a help text: its first paragraph. */
const usageLines = (help: string): string[] =>
  help
    .split('\n\n')[0]
    ?.split('\n')
    .map((l) => l.trim().replace(/^Usage: /, '')) ?? []

function cli(): string {
  const verbs = Object.entries(COMMAND_OPTIONS).map(([verb, flags]) => {
    const names = Object.keys(flags).map((f) => `--${f}`)
    return `- \`${verb}\`: ${names.length === 0 ? 'no flags' : list(names)}`
  })
  return [
    ...verbs,
    '- `eject` and `add` parse their own flags; their usage lines:',
    '',
    '```text',
    ...usageLines(EJECT_HELP),
    ...usageLines(ADD_HELP),
    '```',
  ].join('\n')
}

/** Shipped `basalt-*` file or directory names under `dir`, without `.md`, sorted. */
const shippedNames = (dir: string): string[] =>
  readdirSync(join(PACKAGE, dir))
    .filter((n) => n.startsWith('basalt-'))
    .map((n) => n.replace(/\.md$/, ''))
    .toSorted()

function managed(): string {
  return table(
    ['Shipped', 'Placed by init and sync at', 'Names'],
    [
      ['`agent/rules`', '`.claude/rules/`', list(shippedNames('agent/rules'))],
      ['`agent/skills`', '`.claude/skills/`', list(shippedNames('agent/skills'))],
      ['`agent/reviewer`', '`.claude/agents/`', list(shippedNames('agent/reviewer'))],
      [
        '`agent/templates`',
        'the AGENTS.md block, `.basalt/hook.mjs`, the hook entries of `.claude/settings.json`',
        '-',
      ],
    ],
  )
}

export const SECTIONS: Record<string, () => string> = {
  subpaths,
  tokens,
  rules,
  formats,
  cli,
  managed,
}

const BLOCK = /<!-- generated:([a-z-]+) -->\n[\s\S]*?\n<!-- \/generated -->/g

/** `markdown` with every generated block replaced by a fresh render; a block with no renderer throws. */
export function renderContract(markdown: string): string {
  return markdown.replace(BLOCK, (_, name: string) => {
    const render = SECTIONS[name]
    if (render === undefined) throw new Error(`CONTRACT.md: no generator for section "${name}"`)
    return `<!-- generated:${name} -->\n${render()}\n<!-- /generated -->`
  })
}

if (import.meta.main) {
  const current = readFileSync(CONTRACT_PATH, 'utf8')
  const next = renderContract(current)
  if (process.argv.includes('--check')) {
    if (next !== current) {
      console.error(
        'docs/v3/CONTRACT.md: generated sections differ; run bun packages/basalt-ui/scripts/gen-contract.ts',
      )
      process.exit(1)
    }
  } else if (next !== current) writeFileSync(CONTRACT_PATH, next)
}
