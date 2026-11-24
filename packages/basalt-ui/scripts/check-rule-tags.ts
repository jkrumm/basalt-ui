/**
 * Rule-tag law (docs/v3/concepts/skills-agent-layer.md sections 4.2, 6): skills teach, rules
 * guarantee. Every top-level bullet of an `agent/rules/*.md` file ends in at least one tag naming
 * what holds it, `[lint:<id>]` or `[type:<name>]`, or sits under a `not guarded:` line (the bullets
 * up to the next heading are honest about having no guard). Anything else is an instruction nothing
 * enforces and fails.
 *
 * - `[lint:<id>]` must be a key of the merged rule table (`src/lint`), the one source of lint ids.
 * - `[type:<name>]` must be exported from a published entry (`basalt-ui`, `basalt-ui/<subpath>` or
 *   `basalt-ui/ui/<name>`), read by the TypeScript checker from the entry files the exports map
 *   names (`entry-exports.ts`). A name only a `contract.ts` or `core/*` declares does not count: a
 *   consumer could not import it.
 * - `tests/types/rule-tags.type-test.ts` imports every tagged name from its entry by the published
 *   specifier, so the package typecheck compiles each one against the built `.d.ts`. It is generated
 *   here (`--write`) and the check fails when it is stale.
 *
 * Repo-local: `scripts/` is not shipped. Called from `check-agent-doc-drift.ts`; also runnable.
 *
 * Usage: bun packages/basalt-ui/scripts/check-rule-tags.ts [--write]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { tableOf } from '../src/lint/factory'
import plugin from '../src/lint/index'
import { entryExports, homesOf } from './entry-exports'

const PKG_ROOT = join(import.meta.dir, '..')
export const TYPE_TEST = 'tests/types/rule-tags.type-test.ts'

export type TagSources = {
  readonly lintIds: ReadonlySet<string>
  /** Every name a published entry exports. */
  readonly typeNames: ReadonlySet<string>
}

export type TagFailure = { line: number; message: string }
export type TagReport = { failures: TagFailure[]; typeNames: string[] }

const TAG = String.raw`\[(?:lint:[a-z][a-z0-9-]*|type:[A-Za-z_$][\w$]*)\]`
const TAG_RE = new RegExp(TAG, 'g')
/** A bullet ENDS in its tags: one or more tags, then nothing. */
const TRAILING_TAGS_RE = new RegExp(`(?:\\s*${TAG})+\\s*$`)
const BULLET_RE = /^[-*]\s+/
const NOT_GUARDED_RE = /^not guarded:\s*$/i

/** Failures of one rule document: untagged bullets, unresolved tags, prose outside bullets. */
export function checkRuleTags(markdown: string, sources: TagSources): TagReport {
  const failures: TagFailure[] = []
  const typeNames = new Set<string>()
  let inFrontmatter = false
  let inFence = false
  let inComment = false
  let introOpen = false
  let notGuarded = false
  let bullet: { line: number; text: string } | undefined

  const closeBullet = (): void => {
    if (bullet === undefined) return
    const { line } = bullet
    const text = bullet.text.replace(/\s+/g, ' ').trim()
    bullet = undefined
    const trailing = TRAILING_TAGS_RE.exec(text)
    if (trailing === null) {
      if (!notGuarded) {
        failures.push({
          line,
          message:
            "bullet does not end in [lint:<id>] or [type:<name>] and is not under 'not guarded:'",
        })
      }
      return
    }
    for (const tag of trailing[0].matchAll(TAG_RE)) {
      const [kind, name = ''] = tag[0].slice(1, -1).split(':')
      if (kind === 'lint') {
        if (!sources.lintIds.has(name)) {
          failures.push({ line, message: `[lint:${name}] is not a key of the lint rule table` })
        }
      } else if (!sources.typeNames.has(name)) {
        failures.push({ line, message: `[type:${name}] is not exported from a published entry` })
      } else {
        typeNames.add(name)
      }
    }
  }

  markdown.split('\n').forEach((raw, idx) => {
    const line = idx + 1
    if (idx === 0 && raw.trim() === '---') {
      inFrontmatter = true
      return
    }
    if (inFrontmatter) {
      if (raw.trim() === '---') inFrontmatter = false
      return
    }
    if (/^\s*(```|~~~)/.test(raw)) {
      closeBullet()
      inFence = !inFence
      return
    }
    if (inFence) return
    if (inComment || raw.trimStart().startsWith('<!--')) {
      inComment = !raw.includes('-->')
      return
    }
    if (raw.trim() === '') {
      closeBullet()
      return
    }
    if (raw.startsWith('#')) {
      closeBullet()
      notGuarded = false
      introOpen = /^#\s/.test(raw)
      return
    }
    if (BULLET_RE.test(raw)) {
      closeBullet()
      introOpen = false
      bullet = { line, text: raw }
      return
    }
    if (bullet !== undefined && /^\s/.test(raw)) {
      bullet.text += `\n${raw}`
      return
    }
    closeBullet()
    if (NOT_GUARDED_RE.test(raw)) {
      notGuarded = true
      introOpen = false
      return
    }
    if (introOpen) {
      introOpen = false // the allowance is ONE line under the H1
      return
    }
    failures.push({ line, message: 'prose outside a bullet (only the intro line under the H1)' })
  })
  closeBullet()
  return { failures, typeNames: [...typeNames].toSorted() }
}

/** The lint ids, and the names of every published entry (`entries`, by specifier). */
export function loadSources(
  entries: ReadonlyMap<string, ReadonlySet<string>> = entryExports(PKG_ROOT),
): TagSources {
  return {
    lintIds: new Set(Object.keys(tableOf(plugin))),
    typeNames: new Set([...entries.values()].flatMap((names) => [...names])),
  }
}

/** The rule files this law covers: `agent/rules/*.md`. */
export function ruleFiles(pkgRoot: string = PKG_ROOT): string[] {
  const dir = join(pkgRoot, 'agent/rules')
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .toSorted()
    .map((n) => join(dir, n))
}

/** Every rule file checked; returns printable failures and every tagged type name. */
export function checkAllRuleFiles(
  sources: TagSources = loadSources(),
  pkgRoot: string = PKG_ROOT,
): { messages: string[]; typeNames: string[] } {
  const messages: string[] = []
  const typeNames = new Set<string>()
  for (const file of ruleFiles(pkgRoot)) {
    const report = checkRuleTags(readFileSync(file, 'utf8'), sources)
    for (const f of report.failures)
      messages.push(`${relative(pkgRoot, file)}:${f.line}: ${f.message}`)
    for (const name of report.typeNames) typeNames.add(name)
  }
  return { messages, typeNames: [...typeNames].toSorted() }
}

/**
 * The type test: each tagged name re-exported from its home by the published specifier, so
 * `tsc` resolves it through the exports map and the built `.d.ts`, as a consumer's import does.
 */
export function typeTestSource(
  typeNames: readonly string[],
  entries: ReadonlyMap<string, ReadonlySet<string>>,
): string {
  const lines = typeNames.flatMap((name) => {
    // A root name a subpath also exports is the 2.x shadow; the subpath is its home.
    const homes = homesOf(entries, name)
    const home = homes.find((h) => h !== 'basalt-ui') ?? homes[0]
    return home === undefined ? [] : [`export type { ${name} } from '${home}'`]
  })
  return [
    '// Generated by scripts/check-rule-tags.ts --write; do not edit.',
    '// Every [type:X] of agent/rules, imported from its published entry: the package typecheck compiles it.',
    ...lines,
    '',
  ].join('\n')
}

if (import.meta.main) {
  const entries = entryExports(PKG_ROOT)
  const { messages, typeNames } = checkAllRuleFiles(loadSources(entries))
  const want = typeTestSource(typeNames, entries)
  const path = join(PKG_ROOT, TYPE_TEST)
  if (process.argv.includes('--write')) writeFileSync(path, want)
  else if (readFileSync(path, 'utf8') !== want) {
    messages.push(
      `${TYPE_TEST} is stale: run bun packages/basalt-ui/scripts/check-rule-tags.ts --write`,
    )
  }
  if (messages.length > 0) {
    console.error(`✖ check-rule-tags: ${messages.length} failure(s)`)
    for (const m of messages) console.error(`  ${m}`)
    process.exit(1)
  }
  console.log(
    `✓ check-rule-tags: 0 failures (${typeNames.length} type names, each from a published entry)`,
  )
}
