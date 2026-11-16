/**
 * What `lint --hook pre-edit` denies beyond the managed paths: the edits `doctor`'s weakened-config
 * check (check 3) would reject afterwards, caught before they land. An `ignorePatterns` entry or a
 * `.stylelintignore` line that covers a file under a declared root, and a file-level disable that
 * reaches every rule. Only what the edit adds counts, so a file that already has one can be edited.
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { parseJsonc } from '../cli/source-text'
import { findBlanketDisables } from './blanket-disable'
import { ignoreFilePatterns, ignoreMatcher, rootFilesNamedBy, STYLELINTIGNORE } from './weakened'

const SCRIPT = /\.[cm]?[jt]sx?$/
const GENERATED_TREE = /^routeTree\.gen\.[cm]?[jt]sx?$/

const ignorePatternsIn = (text: string | null): string[] => {
  const patterns = text === null ? undefined : parseJsonc(text)?.['ignorePatterns']
  return [patterns].flat().filter((p): p is string => typeof p === 'string')
}

const readIfPresent = (dir: string, name: string): string | null =>
  existsSync(resolve(dir, name)) ? readFileSync(resolve(dir, name), 'utf8') : null

const added = (before: readonly string[], after: readonly string[]): string[] =>
  after.filter((p) => !before.includes(p))

const some = (files: readonly string[]): string =>
  `${files.slice(0, 3).join(', ')}${files.length > 3 ? ` and ${files.length - 3} more` : ''}`

/** The reason the edit is denied, or null. */
export function weakeningDenial(
  project: { root: string; roots: readonly (readonly [string, unknown])[] },
  rel: string,
  current: string | null,
  next: string | null,
): string | null {
  const dir = project.root
  const roots = project.roots.map(([root]) => root)
  if (next === null) return null
  if (/^\.oxlintrc\.jsonc?$/.test(rel)) {
    const hidden = rootFilesNamedBy(
      dir,
      roots,
      added(ignorePatternsIn(current), ignorePatternsIn(next)),
      'script',
    )
    return hidden.length === 0
      ? null
      : `${rel} would add an ignorePatterns entry over ${some(hidden)}, which the lint run then skips; waive the line with a reasoned directive instead.`
  }
  if (rel === STYLELINTIGNORE) {
    const hidden = rootFilesNamedBy(
      dir,
      roots,
      added(ignoreFilePatterns(current ?? ''), ignoreFilePatterns(next)),
      'style',
    )
    return hidden.length === 0
      ? null
      : `${STYLELINTIGNORE} would name ${some(hidden)}, which stylelint then skips; waive the line with \`/* stylelint-disable-next-line <rule> -- <why> */\` instead.`
  }
  const inRoot = roots.some((r) => r === '.' || rel === r || rel.startsWith(`${r}/`))
  if (!inRoot || !SCRIPT.test(rel) || GENERATED_TREE.test(basename(rel))) return null
  // A path the lint config already ignores is where doctor sends a generated file's disable.
  const ignored = [
    ...ignorePatternsIn(readIfPresent(dir, '.oxlintrc.json')),
    ...ignoreFilePatterns(readIfPresent(dir, '.oxlintignore') ?? ''),
  ]
  if (ignored.map(ignoreMatcher).some((matches) => matches(rel))) return null
  const before = current === null ? 0 : findBlanketDisables(current).length
  const blanket = findBlanketDisables(next)
  return blanket.length > before
    ? `${rel} would add a file-level disable that reaches ${blanket[0]?.reach ?? 'every rule'}; waive the line with \`// oxlint-disable-next-line <id> -- <why>\`, or name the rules a manifest.deepRender path waives, never every rule.`
    : null
}
