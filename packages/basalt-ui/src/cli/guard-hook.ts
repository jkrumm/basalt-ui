/**
 * `guard-hook` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only.
 * Imports its shared plumbing back from `./index` — config resolution, the guard-config builder
 * inputs, and the scan-scoping constants all still live there as this package's shared CLI helpers.
 */
import { isAbsolute, relative, resolve } from 'node:path'

import { DEFAULT_GUARD_CONFIG } from '../guard'
import type { GuardConfig } from '../guard'
import { evaluateGuardHook } from '../guard/guard-hook'
import {
  DEFAULT_ROOTS,
  SKIP,
  declaredProfile,
  defaultExempt,
  readBasaltConfig,
  resolveExemptRules,
} from './index'

/**
 * guard-hook — PreToolUse stdin adapter.
 *
 * Reads a JSON PreToolUse payload from stdin, evaluates it against the consumer's GuardConfig
 * (from the "basalt" key in the nearest package.json), and writes the Claude Code hook response
 * to stdout. Always exits 0 — the hook must never block Claude on a parse error or non-file tool.
 */
export async function guardHook(cwd: string = process.cwd()): Promise<number> {
  let raw: string
  try {
    // Bun: Bun.stdin.text() drains stdin to a string; under Node fall back to manual drain.
    if (typeof (globalThis as Record<string, unknown>)['Bun'] !== 'undefined') {
      raw = await globalThis['Bun'].stdin.text()
    } else {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
      raw = Buffer.concat(chunks).toString('utf8')
    }
  } catch {
    // Unreadable stdin → allow
    process.stdout.write(
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n',
    )
    return 0
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    // Malformed JSON → allow (never block on a bad payload)
    process.stdout.write(
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n',
    )
    return 0
  }

  const cfg = readBasaltConfig(cwd)
  const guardCfg: GuardConfig = {
    spacingSteps: cfg.spacingSteps ?? DEFAULT_GUARD_CONFIG.spacingSteps,
    rawRadius: cfg.rawRadius ?? DEFAULT_GUARD_CONFIG.rawRadius,
    forbiddenAccents: cfg.forbiddenAccents ?? DEFAULT_GUARD_CONFIG.forbiddenAccents,
    mantineShadeIndex: cfg.mantineShadeIndex ?? DEFAULT_GUARD_CONFIG.mantineShadeIndex,
    rawSurface: cfg.rawSurface ?? DEFAULT_GUARD_CONFIG.rawSurface,
    cardWithBorder: cfg.cardWithBorder ?? DEFAULT_GUARD_CONFIG.cardWithBorder,
    offSystemSurfaceVar: cfg.offSystemSurfaceVar ?? DEFAULT_GUARD_CONFIG.offSystemSurfaceVar,
    rawHtmlLayout: cfg.rawHtmlLayout ?? DEFAULT_GUARD_CONFIG.rawHtmlLayout,
    inlineSpacing: cfg.inlineSpacing ?? DEFAULT_GUARD_CONFIG.inlineSpacing,
    inlineDisplay: cfg.inlineDisplay ?? DEFAULT_GUARD_CONFIG.inlineDisplay,
    rawVisxAxis: cfg.rawVisxAxis ?? DEFAULT_GUARD_CONFIG.rawVisxAxis,
    rawMotionValue: cfg.rawMotionValue ?? DEFAULT_GUARD_CONFIG.rawMotionValue,
    chartMissingAriaLabel: cfg.chartMissingAriaLabel ?? DEFAULT_GUARD_CONFIG.chartMissingAriaLabel,
    rawFormControl: cfg.rawFormControl ?? DEFAULT_GUARD_CONFIG.rawFormControl,
    sub16InputFont: cfg.sub16InputFont ?? DEFAULT_GUARD_CONFIG.sub16InputFont,
    allowComment: 'theme-allow',
    exemptRules: resolveExemptRules(cfg),
    severity: cfg.severity ?? DEFAULT_GUARD_CONFIG.severity,
    // Same detection check-theme uses: the hook must never block an edit over advice the app
    // cannot take ("use @mantine/core's Select") in a repo with no Mantine.
    ...(declaredProfile(cfg, []) === 'tokens-only' ? { profile: 'tokens-only' as const } : {}),
  }

  // Honor the consumer's roots / exempt / skip config so the hook never blocks edits to exempted
  // palette source or files outside the guarded roots (mirrors checkTheme's file-walk scoping).
  const roots = cfg.roots ?? DEFAULT_ROOTS
  const exempt = new Set(cfg.exempt ?? defaultExempt(cfg))
  const isInScope = (filePath: string): boolean => {
    const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath)
    const rel = relative(cwd, abs).replace(/\\/g, '/')
    if (rel === '' || rel.startsWith('..')) return false
    if (SKIP.test(rel) || exempt.has(rel)) return false
    return roots.some((root: string) => {
      const r = root.replace(/\\/g, '/').replace(/\/+$/, '')
      return rel === r || rel.startsWith(`${r}/`)
    })
  }

  const result = evaluateGuardHook(payload, guardCfg, { isInScope })

  if (result.permissionDecision === 'deny' && result.reason !== undefined) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: result.reason,
        },
      }) + '\n',
    )
  } else {
    process.stdout.write(
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n',
    )
  }
  return 0
}
