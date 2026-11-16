/**
 * No shipped message names a fix another shipped rule reports (lint cycle 1, lint-1.16). The
 * messages are collected from every surface that writes one: the rule table's `fix` and `next`, the
 * `message` options the preset writes for each shipped profile, the generated no-restyle contracts
 * and the stylelint preset. The class-utility tokens they propose run through the class rules at the
 * app profile, where nothing stands down.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ESLint } from 'eslint'
import { Linter } from 'eslint'

import { createPlugin, tableOf } from './factory'
import plugin from './index'
import type { Contract } from './preset'
import { SHADCN_MESSAGES, SHIPPED_PROFILES, shippedPreset } from './preset'
import { CLASS_RULES } from './rules/class/table'
import { presetInput } from './rule-table'
import { stylelintConfig } from './stylelint/render'
import { SLOTS } from '../ui/slots'

const PKG = resolve(import.meta.dirname, '..', '..')
const table = tableOf(plugin)

const contracts = (
  JSON.parse(readFileSync(resolve(PKG, 'src/ui/no-restyle.generated.json'), 'utf8')) as {
    contracts: Contract[]
  }
).contracts

const preset = (profile: (typeof SHIPPED_PROFILES)[number]) =>
  shippedPreset(profile, {
    table,
    pins: { oxlint: '0', shadcnLint: '0' },
    contracts,
    uiSlots: SLOTS,
  })

type Message = { source: string; text: string }

const flatten = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value !== null && typeof value === 'object'
      ? Object.values(value).flatMap(flatten)
      : []

/** Every shipped message and where it comes from. */
function shippedMessages(): Message[] {
  const messages: Message[] = []
  for (const [id, entry] of Object.entries(table)) {
    for (const form of entry.forms) {
      messages.push({ source: `basalt/${id} ${form.id} fix`, text: form.fix })
      messages.push({ source: `basalt/${id} ${form.id} next`, text: form.next })
    }
  }
  for (const profile of SHIPPED_PROFILES) {
    const rules = preset(profile).rules
    for (const [name, value] of Object.entries(rules)) {
      if (!name.startsWith('shadcn/') || !Array.isArray(value)) continue
      const options = value[1] as { message?: unknown } | undefined
      for (const text of flatten(options?.message)) {
        messages.push({ source: `${profile} ${name} message`, text })
      }
    }
  }
  for (const c of contracts) messages.push({ source: `contract ${c.pattern}`, text: c.message })
  for (const [rule, value] of Object.entries(stylelintConfig().rules)) {
    const text = Array.isArray(value) ? (value[1] as { message?: string } | undefined)?.message : ''
    messages.push({ source: `stylelint ${rule}`, text: text ?? '' })
  }
  return messages
}

/** A class utility a message proposes: a known utility prefix, then a value or a `*` step. */
const UTILITY =
  /(?<![\w-])-?(?:gap|space-[xy]|[pm][xytrblse]?|[wh]|size|max-[wh]|min-[wh]|text|bg|border|rounded|shadow|flex|grid|col|row|justify|items|self|overflow|ring|outline|font|leading|tracking|z|inset|basis|grow|shrink|order)-[A-Za-z0-9*.[\]/%]+(?![\w-])/g

/** `gap-*` proposes a step: the `*` is any one value, tried as `4`. */
const proposedTokens = (text: string): string[] =>
  [...text.matchAll(UTILITY)].map(([token]) => token.replaceAll('*', '4'))

/**
 * A class a message names for a profile other than app, exempt from the app-profile check. Each
 * entry is `<source>: <token>` with the reason beside it.
 */
const NAMED_FOR_OTHER_PROFILES: ReadonlySet<string> = new Set([
  // "text-good or text-brand at bridge": app-colour rejects them at parts and app, and says so.
  'basalt/status-fill-as-text text-on-fill fix: text-good',
  'basalt/status-fill-as-text text-on-fill fix: text-brand',
])

const linter = new Linter()
const classIds = presetInput(CLASS_RULES).profiles.app
const classOptions = presetInput(CLASS_RULES).options.app
const classRules = Object.fromEntries(
  classIds.map((name) => [name, ['error', ...(classOptions[name] ?? [])]]),
) as Record<string, ['error', ...unknown[]]>

/** The class-rule findings on `<div className="token" />` at the app profile. */
const reported = (token: string): string[] =>
  linter
    .verify(
      `const a = <div className="${token}" />`,
      [
        {
          files: ['**/*.tsx'],
          plugins: { basalt: createPlugin(CLASS_RULES) as unknown as ESLint.Plugin },
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          rules: classRules,
        },
      ],
      'input.tsx',
    )
    .map((m) => m.ruleId ?? m.message)

describe('shipped messages', () => {
  const messages = shippedMessages()

  it('collects every surface', () => {
    const sources = messages.map((m) => m.source)
    expect(sources.some((s) => s.includes('fix'))).toBe(true)
    expect(sources.some((s) => s.startsWith('app shadcn/no-restyle'))).toBe(true)
    expect(sources.some((s) => s.startsWith('contract'))).toBe(true)
    expect(sources.some((s) => s.startsWith('stylelint'))).toBe(true)
  })

  it('writes the owned messages at parts and app, as the preset options', () => {
    for (const profile of ['parts', 'app'] as const) {
      const rules = preset(profile).rules as Record<string, [string, { message?: unknown }]>
      for (const rule of Object.keys(SHADCN_MESSAGES[profile] ?? {})) {
        expect(rules[`shadcn/${rule}`]?.[1]?.message, `${profile} ${rule}`).toBeDefined()
      }
    }
  })

  it('names no class another shipped rule reports', () => {
    const offenders = messages.flatMap(({ source, text }) =>
      proposedTokens(text)
        .filter((token) => !NAMED_FOR_OTHER_PROFILES.has(`${source}: ${token}`))
        .flatMap((token) => {
          const found = reported(token)
          return found.length > 0 ? [`${source}: ${token} -> ${found.join(', ')}`] : []
        }),
    )
    expect(offenders).toEqual([])
  })

  it('never says use margin, declares a --color-<name>, or proposes a fixed width', () => {
    for (const { source, text } of messages) {
      expect(text, source).not.toMatch(/use margin/i)
      expect(text, source).not.toContain('--color-<name>')
      expect(
        proposedTokens(text).filter((t) => /^w-\d+$/.test(t)),
        source,
      ).toEqual([])
    }
  })
})

// ── names a message proposes must be exported ────────────────────────────────────────────────────

type ExportsMap = Record<string, string | { types?: string }>
const EXPORTS = (
  JSON.parse(readFileSync(resolve(PKG, 'package.json'), 'utf8')) as {
    exports: ExportsMap
  }
).exports

/** The source file behind a path without its extension: `<path>.ts(x)` or `<path>/index.ts(x)`. */
const resolveSource = (base: string): string | undefined =>
  [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(existsSync)

/** The source of a built `./dist/<path>.d.ts`. */
const sourceOf = (types: string): string | undefined =>
  resolveSource(resolve(PKG, 'src', types.replace(/^\.\/dist\//, '').replace(/\.d\.ts$/, '')))

const DECLARATION =
  /^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|abstract\s+class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm
const NAMED = /^export\s+(?:type\s+)?\{([^}]*)\}(?:\s+from\s+['"]([^'"]+)['"])?/gm
const STAR = /^export\s+\*(?:\s+as\s+([A-Za-z_$][\w$]*))?\s+from\s+['"]([^'"]+)['"]/gm

/** Every name a module exports, following its relative re-exports (`export * from './x'`). */
function exportedNames(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>()
  if (seen.has(file)) return names
  seen.add(file)
  const text = readFileSync(file, 'utf8')
  const follow = (from: string): void => {
    if (!from.startsWith('.')) return
    const target = resolveSource(resolve(dirname(file), from))
    if (target) for (const n of exportedNames(target, seen)) names.add(n)
  }
  for (const [, name] of text.matchAll(DECLARATION)) if (name) names.add(name)
  for (const [, list, from] of text.matchAll(NAMED)) {
    for (const item of (list ?? '').split(',')) {
      const name = item
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .at(-1)
        ?.trim()
      if (name) names.add(name)
    }
    if (from) follow(from)
  }
  for (const [, ns, from] of text.matchAll(STAR)) {
    if (ns) names.add(ns)
    else if (from) follow(from)
  }
  return names
}

/** Every published subpath, `.` first, wildcards expanded to the files they stand for. */
function publishedSubpaths(): Map<string, string[]> {
  const subpaths = new Map<string, string[]>()
  for (const [key, value] of Object.entries(EXPORTS)) {
    if (typeof value === 'string' || !value.types) continue
    const specifier = key === '.' ? 'basalt-ui' : `basalt-ui/${key.slice(2)}`
    if (!key.endsWith('/*')) {
      const file = sourceOf(value.types)
      if (file) subpaths.set(specifier, [file])
      continue
    }
    const folder = value.types.replace(/^\.\/dist\//, '').replace(/\*\.d\.ts$/, '')
    for (const entry of readdirSync(resolve(PKG, 'src', folder))) {
      const name = entry.replace(/\.tsx?$/, '')
      if (name === entry || /\.(?:test|guard|gen|type-guard)$/.test(name)) continue
      const file = sourceOf(`./dist/${folder}${name}.d.ts`)
      if (file) subpaths.set(`${specifier.slice(0, -1)}${name}`, [file])
    }
  }
  return subpaths
}

const subpaths = publishedSubpaths()
const packageNames = new Set(
  [...subpaths.values()].flatMap((files) => files.flatMap((f) => [...exportedNames(f)])),
)

/** A call, `persisted(key)`: not a method (`.query(`) and not a CSS function (`color-mix(`). */
const CALL = /(?<![\w.$%-])([A-Za-z_$][\w$]*)\(/g
/** A component or hook name: two humps (`DeltaBadge`), or `use`/`create`/`define` + a name. */
const CAMEL =
  /(?<![\w.$@/-])((?:[A-Z][a-z0-9]+){2,}|(?:use|create|define)[A-Z][A-Za-z0-9]*)(?![\w-])/g
/** A backticked one-word name with a capital: `Page`, `useSizeClass`. */
const TICKED = /`([A-Za-z_$][\w$]*[A-Z][\w$]*|[A-Z][a-z0-9]+)`/g
const IMPORT_PATH = /\bbasalt-ui(?:\/[\w*/-]+)?/g

/**
 * Names a message writes that are not exports of this package, each with the reason it is allowed.
 * Every entry is a name another system owns: CSS, the web platform, a library the message bans or
 * the rule table's own vocabulary. A package API never belongs here: export it or fix the message.
 */
const NOT_PACKAGE_APIS: Readonly<Record<string, string>> = {
  calc: 'CSS function',
  minmax: 'CSS function',
  var: 'CSS function',
  rgb: 'CSS function',
  rgba: 'CSS function',
  hsl: 'CSS function',
  oklch: 'CSS function',
  localStorage: 'web platform global the message bans',
  sessionStorage: 'web platform global the message bans',
  EventSource: 'web platform class the message bans',
  WebSocket: 'web platform class the message bans',
  TanStack: 'the library name',
  ESLint: 'tool name',
  useState: 'React hook the message bans for URL state',
  useEffect: 'React hook named as the thing to avoid',
  useMemo: 'React hook named as the thing to avoid',
  useReactTable: 'the banned table-library hook',
  useChat: 'the AI SDK hook the import-boundary form constrains',
  navigate: 'the router call literal-search reads',
  QueryClientProvider: 'the TanStack Query component the app mounts the client in',
  useSearch: 'the router hook the message bans a literal `from` on',
}

/** The API names and import paths a message proposes. */
function proposedApis(text: string): { names: string[]; paths: string[] } {
  const plain = text.replace(/\{\{[^}]*\}\}/g, '')
  const names = new Set<string>()
  for (const re of [CALL, CAMEL, TICKED])
    for (const [, name] of plain.matchAll(re)) names.add(name ?? '')
  return {
    names: [...names].filter(Boolean),
    paths: [...plain.matchAll(IMPORT_PATH)].map(([p]) => p),
  }
}

/** A path ending in `/` is a wildcard folder (`basalt-ui/ui/<name>`): it holds when a subpath sits under it. */
const isPublishedPath = (path: string): boolean =>
  path.endsWith('/') ? [...subpaths.keys()].some((s) => s.startsWith(path)) : subpaths.has(path)

describe('shipped messages propose only exported APIs', () => {
  const messages = shippedMessages()

  it('reads the package exports', () => {
    expect(subpaths.has('basalt-ui')).toBe(true)
    expect(subpaths.has('basalt-ui/ui/scroll-area')).toBe(true)
    expect(packageNames.has('persisted')).toBe(true)
    expect(packageNames.has('DeltaBadge')).toBe(true)
    expect(packageNames.has('useSizeClass')).toBe(true)
  })

  it('names no function, component or hook the package does not export', () => {
    const offenders = messages.flatMap(({ source, text }) =>
      proposedApis(text)
        .names.filter((name) => !packageNames.has(name) && !(name in NOT_PACKAGE_APIS))
        .map((name) => `${source}: ${name}`),
    )
    expect(offenders).toEqual([])
  })

  it('names no basalt-ui import path the package does not publish', () => {
    const offenders = messages.flatMap(({ source, text }) =>
      proposedApis(text)
        .paths.filter((path) => !isPublishedPath(path))
        .map((path) => `${source}: ${path}`),
    )
    expect(offenders).toEqual([])
  })

  it('would flag a name the package does not export', () => {
    const { names } = proposedApis(
      'Persist through createLocalStore or persisted(key) from basalt-ui',
    )
    expect(names).toEqual(expect.arrayContaining(['createLocalStore', 'persisted']))
    expect(packageNames.has('createLocalStore')).toBe(false)
    expect(packageNames.has('persisted')).toBe(true)
  })

  it('keeps the allow list honest: no entry is a package export', () => {
    for (const name of Object.keys(NOT_PACKAGE_APIS))
      expect(packageNames.has(name), name).toBe(false)
  })
})
