/**
 * `series-palette`: the series module as a FILE. Judges each `defineSeries` group, wraps the issues
 * as findings, and reads the file with the surfaces derived from the default theme. Kept out of
 * `guard/index.ts`'s import graph on purpose — that graph is on the PreToolUse hook path and never
 * loads colour math or the `derive` engine; this one does. `check-theme` is the only caller.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEFAULT_DERIVE_CONFIG, deriveTokens } from '../tokens/derive'
import { isRuleExempt, severityOf } from './index'
import { auditSeriesGroups, parseSeriesGroups } from './palette'
import type { SeriesSurfaces } from './palette'
import type { Finding, GuardConfig } from './types'

/**
 * Judge ONE series file's palette: one finding per failed check, naming the key(s), scheme,
 * measured number and threshold. The series module is exempt from every line-scan kind, so it is
 * judged here instead. Honors `severity` and `exemptRules` like any other kind.
 */
export function checkSeriesPalette(
  source: string,
  relPath: string,
  cfg: GuardConfig,
  surfaces: SeriesSurfaces,
): Finding[] {
  if (isRuleExempt('series-palette', relPath, cfg.exemptRules)) return []
  return auditSeriesGroups(parseSeriesGroups(source), surfaces).map((issue) => ({
    relPath,
    line: issue.line,
    token: issue.keys.join(', '),
    text: issue.message,
    kind: 'series-palette' as const,
    severity: severityOf('series-palette', cfg),
  }))
}

/**
 * Findings for the series module at `<cwd>/<rel>`; none if it does not exist. Surfaces are the
 * derive engine's default `surface.panel` (a chart sits on a panel) — a consumer's `derive`
 * overrides are not read.
 */
export function checkSeriesModule(cwd: string, rel: string, cfg: GuardConfig): Finding[] {
  const file = resolve(cwd, rel)
  if (!existsSync(file)) return []
  const { panel } = deriveTokens(DEFAULT_DERIVE_CONFIG).surface
  return checkSeriesPalette(readFileSync(file, 'utf8'), rel, cfg, {
    light: panel.light,
    dark: panel.dark,
  })
}
