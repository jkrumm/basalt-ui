/**
 * No shipped message names a fix another shipped rule reports (lint cycle 1, lint-1.16). The
 * messages are collected from every surface that writes one: the rule table's `fix` and `next`, the
 * `message` options the preset writes for each shipped profile, the generated no-restyle contracts
 * and the stylelint preset. The class-utility tokens they propose run through the class rules at the
 * app profile, where nothing stands down.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
