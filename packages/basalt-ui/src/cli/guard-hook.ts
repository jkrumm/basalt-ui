/**
 * `guard-hook` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only.
 * Imports its shared plumbing back from `./index` — config resolution, the guard-config builder
 * inputs, and the scan-scoping constants all still live there as this package's shared CLI helpers.
 */
import { isAbsolute, relative, resolve } from 'node:path'

import { evaluateGuardHook } from '../guard/guard-hook'
import { SKIP, declaredProfile, defaultExempt, readBasaltConfig, resolveGuardConfig } from './index'
import { DEFAULT_ROOTS } from './config'

const ALLOW = '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'

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
    process.stdout.write(ALLOW)
    return 0
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    // Malformed JSON → allow (never block on a bad payload)
    process.stdout.write(ALLOW)
    return 0
  }

  const cfg = readBasaltConfig(cwd)
  // Same profile as check-theme: never block an edit over advice a no-Mantine app cannot take.
  const guardCfg = resolveGuardConfig(cfg, declaredProfile(cfg, []))

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
    process.stdout.write(ALLOW)
  }
  return 0
}
