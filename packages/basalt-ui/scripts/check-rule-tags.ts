/**
 * Rule-tag law (docs/v3/concepts/skills-agent-layer.md sections 4.2, 6): skills teach, rules
 * guarantee. Every top-level bullet of an `agent/rules/*.md` file ends in at least one tag naming
 * what holds it, `[lint:<id>]` or `[type:<name>]`, or sits under a `not guarded:` line (the bullets
 * up to the next heading are honest about having no guard). Anything else is an instruction nothing
 * enforces and fails.
 *
 * - `[lint:<id>]` must be a key of the merged rule table (`src/lint`), the one source of lint ids.
 * - `[type:<name>]` must be a backticked name in docs/v3/ARCHITECTURE.md section 1, an export of
 *   `src/core/ports.ts` or an export of a `src/<dir>/contract.ts`. A name that has not landed yet
 *   is listed in {@link LANDS_LATER}: it passes, is printed, and fails once it resolves (a stale
 *   entry) so the list shrinks as the surface lands.
 *
 * Repo-local: `scripts/` is not shipped. Called from `check-agent-doc-drift.ts`; also runnable.
 *
 * Usage: bun packages/basalt-ui/scripts/check-rule-tags.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { tableOf } from '../src/lint/factory'
import plugin from '../src/lint/index'

const PKG_ROOT = join(import.meta.dir, '..')
const REPO_ROOT = join(PKG_ROOT, '../..')

/** `[type:<name>]` names whose export has not landed (G1 or later); each must still be unresolved. */
export const LANDS_LATER: ReadonlySet<string> = new Set(['setScheme'])

export type TagSources = {
  readonly lintIds: ReadonlySet<string>
  readonly typeNames: ReadonlySet<string>
}

export type TagFailure = { line: number; message: string }
export type TagReport = { failures: TagFailure[]; landsLater: string[] }

const TAG = String.raw`\[(?:lint:[a-z][a-z0-9-]*|type:[A-Za-z_$][\w$]*)\]`
const TAG_RE = new RegExp(TAG, 'g')
/** A bullet ENDS in its tags: one or more tags, then nothing. */
const TRAILING_TAGS_RE = new RegExp(`(?:\\s*${TAG})+\\s*$`)
const BULLET_RE = /^[-*]\s+/
const NOT_GUARDED_RE = /^not guarded:\s*$/i

/** Failures of one rule document: untagged bullets, unresolved tags, prose outside bullets. */
export function checkRuleTags(markdown: string, sources: TagSources): TagReport {
  const failures: TagFailure[] = []
  const landsLater = new Set<string>()
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
        if (LANDS_LATER.has(name)) landsLater.add(name)
        else {
          failures.push({
            line,
            message: `[type:${name}] is not named in ARCHITECTURE section 1, core/ports.ts or a contract.ts`,
          })
        }
      } else if (LANDS_LATER.has(name)) {
        failures.push({ line, message: `[type:${name}] resolves now: drop it from LANDS_LATER` })
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
  return { failures, landsLater: [...landsLater].toSorted() }
}

/** Names exported by a TypeScript source file, by declaration keyword. */
export function exportedNames(source: string): string[] {
  const re =
    /^export (?:declare )?(?:type|interface|const|function|class|enum) ([A-Za-z_$][\w$]*)/gm
  return [...source.matchAll(re)].map((m) => m[1] as string)
}

/** Backticked identifiers (an optional trailing `()`) inside ARCHITECTURE section 1. */
export function architectureNames(architecture: string): string[] {
  const start = architecture.search(/^## 1\. /m)
  const end = architecture.search(/^## 2\. /m)
  if (start === -1 || end === -1) {
    throw new Error('docs/v3/ARCHITECTURE.md: section 1 or 2 heading not found')
  }
  const section = architecture.slice(start, end)
  return [...section.matchAll(/`([A-Za-z_$][\w$]*)(?:\(\))?`/g)].map((m) => m[1] as string)
}

const read = (file: string): string => readFileSync(file, 'utf8')

export function loadSources(): TagSources {
  const src = join(PKG_ROOT, 'src')
  const files = [
    join(src, 'core/ports.ts'),
    ...readdirSync(src, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(src, e.name, 'contract.ts'))
      .filter((f) => existsSync(f)),
  ]
  return {
    lintIds: new Set(Object.keys(tableOf(plugin))),
    typeNames: new Set([
      ...architectureNames(read(join(REPO_ROOT, 'docs/v3/ARCHITECTURE.md'))),
      ...files.flatMap((f) => exportedNames(read(f))),
    ]),
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

/** Every rule file checked; returns printable failures and the names that land later. */
export function checkAllRuleFiles(
  sources: TagSources = loadSources(),
  pkgRoot: string = PKG_ROOT,
): { messages: string[]; landsLater: string[] } {
  const messages: string[] = []
  const landsLater = new Set<string>()
  for (const file of ruleFiles(pkgRoot)) {
    const report = checkRuleTags(readFileSync(file, 'utf8'), sources)
    for (const f of report.failures)
      messages.push(`${relative(pkgRoot, file)}:${f.line}: ${f.message}`)
    for (const name of report.landsLater) landsLater.add(name)
  }
  for (const name of LANDS_LATER) {
    if (!landsLater.has(name))
      messages.push(`LANDS_LATER['${name}'] is used by no rule bullet or resolves: drop it`)
  }
  return { messages, landsLater: [...landsLater].toSorted() }
}

if (import.meta.main) {
  const { messages, landsLater } = checkAllRuleFiles()
  if (messages.length > 0) {
    console.error(`✖ check-rule-tags: ${messages.length} failure(s)`)
    for (const m of messages) console.error(`  ${m}`)
    process.exit(1)
  }
  console.log(
    `✓ check-rule-tags: 0 failures${landsLater.length > 0 ? ` (types landing later: ${landsLater.join(', ')})` : ''}`,
  )
}
