/**
 * `check-theme --audit-allows` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds
 * routing only. Imports its shared plumbing (config/project resolution) back from `./index`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  checkSource,
  findAllowAnnotations,
  neutralizeAllowAnnotation,
  unmatchedExemptPatterns,
} from '../guard'
import type { Finding, GuardConfig, GuardKind } from '../guard'
import type { BasaltConfig, ExemptRuleEntry } from './index'
import { exemptRulePaths, exemptRuleReason, resolveRoots } from './index'

// ── check-theme --audit-allows — every waiver, and whether it still suppresses anything ─────────

/** `relPath:line:kind` — a finding's identity for set arithmetic across two runs of the same file. */
function findingKey(f: Finding): string {
  return `${f.relPath}:${f.line}:${f.kind}`
}

/** One annotation the guard cannot judge, queued for the oxlint half of the audit. */
type PluginProbe = {
  /** Index into the report's line array, so the verdict lands where the placeholder sits. */
  readonly slot: number
  readonly rel: string
  /** 1-based line of the annotation, as {@link findAllowAnnotations} reports it. */
  readonly line: number
  readonly ids: readonly string[]
  readonly site: string
  readonly suffix: string
}

/** One oxlint diagnostic, as `--format=json` renders it — only the fields the audit reads. */
type OxlintDiagnostic = {
  code?: unknown
  filename?: unknown
  labels?: { span?: { line?: unknown } }[]
}

/** The nearest `node_modules/.bin/<name>` walking up from `dir`, else `name` if it is on PATH. */
function resolveToolBin(dir: string, name: string): string | null {
  let current = dir
  for (;;) {
    const candidate = resolve(current, 'node_modules/.bin', name)
    if (existsSync(candidate)) return candidate
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
  const probe = spawnSync(name, ['--version'], { stdio: 'ignore', timeout: 10_000 })
  return probe.error === undefined && probe.status === 0 ? name : null
}

/** `line:rule` counts for one file's diagnostics — a multiset, so two findings on a line differ. */
function diagnosticCounts(
  diagnostics: readonly OxlintDiagnostic[],
  filename: string,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const d of diagnostics) {
    if (d.filename !== filename) continue
    const code = typeof d.code === 'string' ? d.code : ''
    const rule = /^basalt\((.+)\)$/.exec(code)?.[1]
    if (rule === undefined) continue
    const line = d.labels?.[0]?.span?.line
    const key = `${typeof line === 'number' ? line : 0}:${rule}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * The oxlint half of the audit: what each plugin-rule annotation still suppresses.
 *
 * The `check-theme` half proves a verdict by re-running `checkSource` with one occurrence
 * neutralized. The `error`-severity design rules do not live there — they live in the oxlint
 * plugin — so the audit declined to judge them and printed "not a check-theme kind". In a
 * chart-heavy consumer that was 8 of 8 and 11 of 14: a CI gate that exited 0 having inspected
 * nothing. The method generalizes exactly, one level over: neutralize the annotation, re-run
 * oxlint over that file, and the findings that appear are what it covers.
 *
 * oxlint has no stdin mode, so a probe has to be a real file. It is written BESIDE the original —
 * same directory, so the same `.oxlintrc.json`, the same `charts/` path segment, the same nearest
 * `package.json` — and removed in a `finally`. Returns null when oxlint cannot be run at all, which
 * is a "cannot judge", never a "dead".
 */
function probePluginRules(
  cwd: string,
  guardCfg: GuardConfig,
  probes: readonly PluginProbe[],
  sources: ReadonlyMap<string, string>,
): Map<number, string[]> | null {
  if (probes.length === 0) return new Map()
  const bin = resolveToolBin(cwd, 'oxlint')
  if (bin === null) return null

  const written: string[] = []
  const probePaths = new Map<number, string>()
  try {
    for (const probe of probes) {
      // Neutralized by the guard's own helper, so the oxlint probe and the checkSource probe can
      // never differ by a substitution detail — a verdict that disagrees between the two halves of
      // one audit is worse than no verdict.
      const probed = neutralizeAllowAnnotation(sources.get(probe.rel) ?? '', probe.line, guardCfg)
      const dot = probe.rel.lastIndexOf('.')
      const rel =
        dot === -1
          ? `${probe.rel}.basalt-audit-${probe.slot}`
          : `${probe.rel.slice(0, dot)}.basalt-audit-${probe.slot}${probe.rel.slice(dot)}`
      const abs = resolve(cwd, rel)
      if (existsSync(abs)) continue
      writeFileSync(abs, probed, 'utf8')
      written.push(abs)
      probePaths.set(probe.slot, rel)
    }
    if (probePaths.size === 0) return null

    const targets = [...new Set(probes.map((p) => p.rel)), ...probePaths.values()]
    const run = spawnSync(bin, ['--format=json', '--no-error-on-unmatched-pattern', ...targets], {
      cwd,
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    if (run.error !== undefined || typeof run.stdout !== 'string') return null
    let diagnostics: OxlintDiagnostic[]
    try {
      diagnostics =
        (JSON.parse(run.stdout) as { diagnostics?: OxlintDiagnostic[] }).diagnostics ?? []
    } catch {
      return null
    }

    const verdicts = new Map<number, string[]>()
    for (const probe of probes) {
      const probeRel = probePaths.get(probe.slot)
      if (probeRel === undefined) continue
      const before = diagnosticCounts(diagnostics, probe.rel)
      const after = diagnosticCounts(diagnostics, probeRel)
      const revealed: string[] = []
      for (const [key, count] of after) {
        if (count <= (before.get(key) ?? 0)) continue
        const [line = '', rule = ''] = key.split(':')
        revealed.push(`${rule}@${line}`)
      }
      verdicts.set(probe.slot, revealed.toSorted())
    }
    return verdicts
  } finally {
    for (const abs of written) {
      try {
        unlinkSync(abs)
      } catch {
        // The probe is a temp file basalt owns; a failed unlink must not mask the audit's verdict.
      }
    }
  }
}

/**
 * `check-theme --audit-allows` — list every active waiver and prove, per waiver, whether it still
 * suppresses anything.
 *
 * The accountability release shipped `theme-allow-unscoped`, which reports a waiver that names no
 * rule — but a waiver that is perfectly well written and covers a finding that no longer exists is
 * invisible to it, and to everything else. Two consumers found five of those by hand, by editing
 * the token out and re-running the guard. This is that method, automated: for each annotation the
 * file is re-checked with THAT occurrence neutralized, and the findings that appear are exactly
 * what it suppresses. Nothing is inferred from the annotation's text, so the audit cannot disagree
 * with the scan — it IS the scan, run twice.
 *
 * `basalt.exemptRules` entries are audited the same way, one pattern at a time. That also answers
 * the question the key could never answer for itself: a pattern that matches no scanned file (a
 * real relative path, say, where the matcher takes whole path SEGMENTS) suppresses nothing and is
 * reported as dead rather than passing silently.
 *
 * Exit 1 when anything is dead, so it can be wired into CI as a gate. A waiver nobody re-checks is
 * how a rule quietly stops applying to the file that needed the exception most.
 */
export function auditAllows(
  cwd: string,
  cfg: BasaltConfig,
  guardCfg: GuardConfig,
  scanned: string[],
): number {
  const token = guardCfg.allowComment
  const lines: string[] = [`\nbasalt-ui check-theme --audit-allows — ${cwd}\n`]
  let dead = 0
  let live = 0
  let outOfReach = 0
  let unaccountable = 0

  // ── theme-allow annotations ─────────────────────────────────────────────────
  const waiverLines: string[] = []
  const pluginProbes: PluginProbe[] = []
  const sources = new Map<string, string>()
  for (const rel of scanned) sources.set(rel, readFileSync(resolve(cwd, rel), 'utf8'))

  for (const rel of scanned) {
    const text = sources.get(rel) ?? ''
    if (!text.includes(token)) continue
    const baseline = checkSource(text, rel, guardCfg)
    const baselineKeys = new Set(
      baseline.filter((f) => f.kind !== 'theme-allow-unscoped').map(findingKey),
    )
    const unscopedAt = new Map(
      baseline.filter((f) => f.kind === 'theme-allow-unscoped').map((f) => [f.line, f.token]),
    )
    // Enumerated by the guard, never by a regex kept here: `findAllowAnnotations` shares its
    // collector with `checkSource`, so the audit lists exactly the annotations the scan honours.
    // The private mirror this replaced was already one comment shape behind.
    for (const site of findAllowAnnotations(text, rel, guardCfg)) {
      const revealed = checkSource(
        neutralizeAllowAnnotation(text, site.line, guardCfg),
        rel,
        guardCfg,
      )
        .filter((f) => f.kind !== 'theme-allow-unscoped' && !baselineKeys.has(findingKey(f)))
        .map((f) => `${f.kind}@${f.line}`)
      const note = unscopedAt.get(site.line)
      if (note !== undefined) unaccountable++
      const label = `  ${rel}:${site.line}`.padEnd(52)
      const suffix = note === undefined ? '' : ` [${note}]`
      if (revealed.length > 0) {
        live++
        waiverLines.push(`${label} suppresses ${[...new Set(revealed)].join(', ')}${suffix}`)
        continue
      }
      // Nothing in check-theme's reach moved. If the annotation names a PLUGIN rule, the oxlint
      // half decides it — a placeholder holds the slot so the report stays in file/line order.
      if (site.pluginRules.length > 0 && site.guardKinds.length === 0) {
        pluginProbes.push({
          slot: waiverLines.length,
          rel,
          line: site.line,
          ids: site.pluginRules,
          site: label,
          suffix,
        })
        waiverLines.push('')
        continue
      }
      if (site.guardKinds.length === 0 && site.unknownRules.length > 0) {
        outOfReach++
        waiverLines.push(
          `${label} scoped to ${site.unknownRules.join(', ')} — names no guard kind and no ` +
            'plugin rule, so this audit cannot judge it (most likely a typo, which ' +
            `theme-allow-unscoped reports)${suffix}`,
        )
        continue
      }
      dead++
      waiverLines.push(`${label} SUPPRESSES NOTHING — dead, delete it${suffix}`)
    }
  }

  // ── the oxlint half — plugin-rule annotations, judged the same way ──────────
  const pluginVerdicts = probePluginRules(cwd, guardCfg, pluginProbes, sources)
  for (const probe of pluginProbes) {
    const revealed = pluginVerdicts?.get(probe.slot)
    if (revealed === undefined) {
      outOfReach++
      waiverLines[probe.slot] =
        `${probe.site} scoped to ${probe.ids.join(', ')} — an oxlint plugin rule, and oxlint ` +
        `could not be run here, so this audit cannot judge it${probe.suffix}`
      continue
    }
    if (revealed.length > 0) {
      live++
      waiverLines[probe.slot] =
        `${probe.site} suppresses ${revealed.join(', ')} (oxlint)${probe.suffix}`
      continue
    }
    dead++
    waiverLines[probe.slot] =
      `${probe.site} SUPPRESSES NOTHING — dead, delete it (proved by re-running oxlint over the ` +
      `file with this annotation neutralized)${probe.suffix}`
  }

  lines.push(`${token} annotations (${waiverLines.length}):`)
  lines.push(...(waiverLines.length === 0 ? ['  (none)'] : waiverLines))

  // ── basalt.exemptRules entries ──────────────────────────────────────────────
  const exemptLines: string[] = []
  let exemptCount = 0
  const declared = Object.entries(cfg.exemptRules ?? {}) as [GuardKind, ExemptRuleEntry][]
  if (declared.length > 0) {
    const baselineKeys = new Set<string>()
    for (const rel of scanned) {
      for (const f of checkSource(sources.get(rel) ?? '', rel, guardCfg))
        baselineKeys.add(findingKey(f))
    }
    for (const [kind, entry] of declared) {
      const reason = exemptRuleReason(entry)
      for (const pattern of exemptRulePaths(entry)) {
        exemptCount++
        const probeCfg: GuardConfig = {
          ...guardCfg,
          exemptRules: {
            ...guardCfg.exemptRules,
            [kind]: exemptRulePaths(entry).filter((p) => p !== pattern),
          },
        }
        const revealed = new Set<string>()
        for (const rel of scanned) {
          for (const f of checkSource(sources.get(rel) ?? '', rel, probeCfg)) {
            if (!baselineKeys.has(findingKey(f))) revealed.add(f.relPath)
          }
        }
        const site = `  ${kind}: "${pattern}"`.padEnd(52)
        const why = reason === null ? ' [no reason recorded]' : ` — ${reason}`
        if (revealed.size === 0) {
          dead++
          const unmatched = unmatchedExemptPatterns(guardCfg, scanned).find(
            (u) => u.kind === kind && u.pattern === pattern,
          )
          exemptLines.push(
            `${site} SUPPRESSES NOTHING — ` +
              (unmatched === undefined
                ? 'the files it matches have no such finding; delete it'
                : unmatched.reason === 'unknown-kind'
                  ? 'it names no guard kind (a typo, or a renamed kind)'
                  : 'it matches no scanned file at all') +
              why,
          )
        } else {
          live++
          exemptLines.push(
            `${site} suppresses findings in ${[...revealed].toSorted().join(', ')}${why}`,
          )
        }
      }
    }
  }
  lines.push(`\nbasalt.exemptRules entries (${exemptCount}):`)
  lines.push(...(exemptLines.length === 0 ? ['  (none)'] : exemptLines))

  lines.push(
    `\n${live} live, ${dead} dead, ${outOfReach} unjudgeable, ${unaccountable} ` +
      'unaccountable (reported as theme-allow-unscoped by a normal run).',
  )
  // The audit reads exactly what `check-theme` reads, and that is `scannableFiles` — which is
  // WIDER than `basalt.roots`: it also takes each root's sibling `index.html` and `public/` tree
  // (see appShellFiles) and anything named in `basalt.include`. Two consumers reported a live
  // `public/site.webmanifest` waiver under a scope line saying files outside `roots` are not
  // audited; the line was wrong, not the scan. Saying the scope out loud is the difference between
  // "0 dead" and "0 dead, over these files" — so it has to name every class actually reached.
  const includes = cfg.include ?? []
  lines.push(
    `Scope: the ${scanned.length} file(s) check-theme scans — everything under basalt.roots ` +
      `(${resolveRoots(cfg).join(', ')}), plus each root's sibling index.html and public/ tree, ` +
      (includes.length === 0
        ? 'plus anything named in basalt.include (none). '
        : `plus basalt.include (${includes.join(', ')}). `) +
      'A waiver in a file none of those reach is not audited — widen roots, or name it in ' +
      'basalt.include, or accept that nothing polices that file.',
  )
  if (dead > 0) {
    lines.push(
      'A dead waiver is not harmless: it is an exception nobody re-checked, and it will silently ' +
        'cover the next real finding on that line.',
    )
  }
  console.log(lines.join('\n'))
  return dead > 0 ? 1 : 0
}
