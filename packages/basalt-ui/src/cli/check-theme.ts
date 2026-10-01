/**
 * `check-theme` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only.
 * Imports its shared plumbing (config/project resolution) back from `./index`, and its
 * `--audit-allows` mode from `./audit-allows`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import {
  checkSource,
  guardKindRemedy,
  TOKENS_ONLY_DISABLED_KINDS,
  unmatchedExemptPatterns,
} from '../guard'
import type { Finding } from '../guard'
import { auditAllows } from './audit-allows'
import { DEFAULT_ROOTS, resolveRoots } from './config'
import {
  basaltPresetEntry,
  conflictingProfileFlags,
  declaredProfile,
  hasBasaltKey,
  packageRoot,
  parseJsonc,
  readBasaltConfig,
  readIfExists,
  readSource,
  resolveGuardConfig,
  resolveProjectDir,
  scannableFiles,
  SERIES_MODULE_HINT_RE,
  waiverHintFor,
} from './index'

/**
 * One line when the nearest `.oxlintrc.json` (up to the repo root) neither extends the shipped
 * preset nor loads its plugin: the basalt/* rules — two of the 1.33.0 promotions among them — live only in that lane,
 * and a check-theme-only CI otherwise reads as the whole guard (emailgw r4). Doctor names the fix.
 */
function astLaneNotice(cwd: string): string | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const rc = parseJsonc(readIfExists(resolve(dir, '.oxlintrc.json')) ?? 'null')
    const plugin = [rc?.['jsPlugins']]
      .flat()
      .find((p) => `${p}`.endsWith('configs/oxlint-plugin.js'))
    // A plugin load alone enables no rule — it counts only beside a basalt/* rule of its own.
    const own = Object.keys((rc?.['rules'] ?? {}) as object).some((id) => id.startsWith('basalt/'))
    const entry =
      basaltPresetEntry(rc?.['extends']) ?? (own ? (plugin as string | undefined) : undefined)
    if (entry !== undefined && existsSync(resolve(dir, entry))) return null
    if (rc !== null || existsSync(resolve(dir, '.git')) || dirname(dir) === dir) break
  }
  const n = (readSource(packageRoot(), 'configs/oxlint-basalt.json') ?? '').match(
    /"basalt\/[\w-]+":/g,
  )
  return (
    `ℹ basalt-ui check-theme: AST lane not enforced — ${n?.length ?? 0} basalt/* rule ids unguarded ` +
    '(incl. the promoted control-outside-home, raw-breakpoint): no .oxlintrc.json up to the repo ' +
    'root extends basalt-ui/configs/oxlint.json (or the guards-only oxlint-basalt.json). `basalt-ui ' +
    'doctor` names the fix.'
  )
}

/**
 * Theme guard — thin FS walker over the headless `../guard` core. Reads BasaltConfig, builds a
 * GuardConfig, walks roots, calls checkSource per file, collects Finding[], groups/reports, returns
 * 0 (clean) / 1 (violations). A `theme-allow` comment exempts a line.
 *
 * Runs against `resolveProjectDir(cwd)`, not `cwd` — see that type's doc for why a root-invoked
 * hook or CI step has to find the package the config lives in rather than scan nothing and pass.
 */
export function checkTheme(
  invocationCwd: string = process.cwd(),
  flags: readonly string[] = [],
): number {
  if (conflictingProfileFlags(flags)) {
    console.error(
      'basalt-ui check-theme: --tokens-only and --framework are alternatives — pass one.',
    )
    return 1
  }
  const project = resolveProjectDir(invocationCwd)
  const cwd = project.dir
  if (project.relocatedFrom !== null) {
    console.log(
      `basalt-ui check-theme: BASALT_CWD relocated from ${project.relocatedFrom} to ${cwd}.`,
    )
  }
  const cfg = readBasaltConfig(cwd)
  const roots = resolveRoots(cfg)
  const profile = declaredProfile(cfg, flags)
  if (profile === 'tokens-only') {
    console.log(
      'basalt-ui check-theme: tokens-only profile — ' +
        `${TOKENS_ONLY_DISABLED_KINDS.size} Mantine-coupled kinds are off; the color and typography ` +
        'kinds still apply. Pass --framework to force the full set.',
    )
  }

  const guardCfg = resolveGuardConfig(cfg, profile)

  const findings: Finding[] = []
  const scanned = scannableFiles(cwd, cfg)
  for (const rel of scanned) {
    findings.push(...checkSource(readFileSync(resolve(cwd, rel), 'utf8'), rel, guardCfg))
  }

  if (scanned.length === 0) {
    // A configured-but-wrong root is never intentional, and silently scanning 0 files under the
    // built-in defaults (argo's pre-migration layout) is the same failure mode for every other
    // consumer — both cases fail loud instead of warn-plus-green.
    // The WRONG-DIRECTORY case leads, and since 1.29.0's single resolver it is the common one:
    // lefthook and GitHub Actions both run at the REPO ROOT while the config lives in a package
    // below it. Only the roots messages used to print, sending a consumer to edit `basalt.roots` in
    // a package.json that has no `basalt` block at all.
    if (!hasBasaltKey(cwd)) {
      console.error(
        `✖ basalt-ui check-theme: ${cwd}/package.json has no "basalt" key — very likely not the ` +
          'package you meant to scan (BASALT_CWD, else the invocation cwd; nothing is inferred). ' +
          'At a repo root? Give the command `root: <pkg>/` (lefthook) or `working-directory: ' +
          '<pkg>` (Actions), or set BASALT_CWD=<pkg>. If this directory IS it, run `basalt-ui init`.',
      )
    }
    if (cfg.roots === undefined) {
      console.error(
        `✖ basalt-ui check-theme: 0 files scanned — no "basalt.roots" configured in package.json, and ` +
          `the built-in default roots (${DEFAULT_ROOTS.join(', ')}) matched zero files. ` +
          'Set "basalt": { "roots": [...] } in package.json to point at your source directories.',
      )
    } else {
      console.error(
        `✖ basalt-ui check-theme: 0 files scanned — the configured "basalt.roots" (${roots.join(', ')}) ` +
          'matched zero files. Check the paths in "basalt.roots" in package.json.',
      )
    }
    return 1
  }

  // The audit is a REPORT over the same scan, not a second scan with different rules — it runs
  // after the 0-files gate so "every waiver is dead" can never mean "nothing was read".
  if (flags.includes('--audit-allows')) return auditAllows(cwd, cfg, guardCfg, scanned)

  // An exemption that matched nothing is reported, never silently honoured. A WARNING rather than a
  // failure: the entry enforced exactly nothing before this line existed, so failing on it would
  // break a green build at upgrade time over config that was already inert — `--audit-allows` is
  // the lane that exits non-zero on a dead waiver, for a consumer who opts into that gate.
  for (const unmatched of unmatchedExemptPatterns(guardCfg, scanned)) {
    console.error(
      `⚠ basalt-ui check-theme: "basalt.exemptRules" entry ${unmatched.kind}: ` +
        `"${unmatched.pattern}" ` +
        (unmatched.reason === 'unknown-kind'
          ? 'names no guard kind — it exempts nothing at all (a typo, or a kind that was renamed).'
          : 'matched none of the scanned files — it suppresses nothing, and reads as coverage in a ' +
            'config review while enforcing as much as an empty object.'),
    )
  }

  const notice = profile === 'tokens-only' ? null : astLaneNotice(cwd)
  if (notice !== null) console.error(notice)

  if (findings.length === 0) {
    console.log('✓ Theme guard: no off-palette colors.')
    return 0
  }

  // Errors and warnings are reported as two separate blocks, not one list with a column: a
  // consumer scanning the output needs "what breaks my build" answered before "what will later".
  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warn')

  const report = (group: Finding[], heading: string): void => {
    const byFile = new Map<string, Finding[]>()
    for (const f of group) {
      const list = byFile.get(f.relPath) ?? []
      list.push(f)
      byFile.set(f.relPath, list)
    }
    console.error(heading)
    for (const [file, vs] of [...byFile].toSorted()) {
      console.error(file)
      for (const v of vs.toSorted((a, b) => a.line - b.line)) {
        console.error(`  ${String(v.line).padStart(4)}  ${v.kind.padEnd(22)} ${v.text}`)
      }
      console.error('')
    }
  }

  if (warnings.length > 0) {
    report(
      warnings,
      // Deliberately neutral about WHY a kind is a warning. Two origins reach this block — a kind
      // in its grace minor, and a consumer's own `basalt.severity` override — and the finding
      // doesn't carry which. Promising promotion next minor would be wrong for the second.
      `⚠ Theme guard: ${warnings.length} warning(s) — reported, not fatal. A kind warns while it ` +
        'is in its grace minor, or because `basalt.severity` turned it down; fix on your own ' +
        'schedule.\n',
    )
  }
  if (errors.length > 0) {
    report(errors, `✖ Theme guard: ${errors.length} off-palette / off-identity violation(s)\n`)
  }

  // Remedies come from the guard's own rule registry, never from a copy kept here: the local table
  // this replaced had no entry for any of the five kinds 1.20.0 added, so exactly the new findings
  // — the ones whose whole argument is "this looks correct and is not" — printed no argument.
  const presentKinds = [...new Set(findings.map((f) => f.kind))].toSorted()
  // And the closer is per FILE CLASS: prescribing a `theme-allow` comment to a .webmanifest (which
  // has no comment syntax) is what pushed two consumers into a blanket exemption instead.
  const waiverHints = [
    ...new Set(findings.map((f) => waiverHintFor(f.relPath, profile))),
  ].toSorted()
  console.error(['Fix:', ...presentKinds.map(guardKindRemedy), ...waiverHints].join(' '))

  // A violation in a file that looks like the palette source itself is likely intentional — point
  // at the exempt escape hatch instead of leaving the author to search for it.
  if (findings.some((f) => SERIES_MODULE_HINT_RE.test(f.relPath))) {
    console.error(
      'Hint: if a flagged file IS your palette/series source, exempt it via ' +
        '"basalt": { "exempt": ["<path>"] } in package.json.',
    )
  }
  // Warnings alone pass. That is the whole point of the grace minor: a consumer takes the upgrade
  // on a green build and schedules the fix, instead of the release scheduling it for them.
  return errors.length > 0 ? 1 : 0
}
