/**
 * guard-hook — pure helpers for the Claude Code PreToolUse hook adapter.
 * Mantine-free, dependency-free (zero non-type imports beyond guard internals).
 */
import { checkSource } from './index'
import type { GuardConfig } from './types'

/** The file path + new content extracted from a PreToolUse payload. */
export type HookTarget = { relPath: string; text: string }

/**
 * Extract the target file path and incoming new content from a Claude Code PreToolUse payload.
 * Handles Write, Edit, and MultiEdit tool shapes; returns null for anything else or on bad input.
 *
 * Field mapping:
 *   payload.tool_name         — tool identifier
 *   payload.tool_input        — tool-specific input bag
 *   Write:     tool_input.file_path + (tool_input.file_text ?? tool_input.content)
 *   Edit:      tool_input.file_path + tool_input.new_string
 *   MultiEdit: tool_input.file_path + edits[].new_string / edits[].new_text (both forms)
 */
export function extractHookTarget(payload: unknown): HookTarget | null {
  if (payload === null || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>

  const toolName = p['tool_name']
  if (typeof toolName !== 'string') return null

  const input = p['tool_input']
  if (input === null || typeof input !== 'object') return null
  const inp = input as Record<string, unknown>

  const filePath = inp['file_path']
  if (typeof filePath !== 'string' || filePath.length === 0) return null
  const relPath = filePath

  if (toolName === 'Write') {
    const text =
      typeof inp['file_text'] === 'string'
        ? inp['file_text']
        : typeof inp['content'] === 'string'
          ? inp['content']
          : null
    if (text === null) return null
    return { relPath, text }
  }

  if (toolName === 'Edit') {
    const newStr = inp['new_string']
    if (typeof newStr !== 'string') return null
    return { relPath, text: newStr }
  }

  if (toolName === 'MultiEdit') {
    const edits = inp['edits']
    if (!Array.isArray(edits)) return null
    const parts: string[] = []
    for (const e of edits) {
      if (e === null || typeof e !== 'object') continue
      const edit = e as Record<string, unknown>
      const part =
        typeof edit['new_string'] === 'string'
          ? edit['new_string']
          : typeof edit['new_text'] === 'string'
            ? edit['new_text']
            : null
      if (part !== null) parts.push(part)
    }
    return { relPath, text: parts.join('\n') }
  }

  return null
}

export type GuardHookResult = {
  permissionDecision: 'allow' | 'deny'
  reason?: string
}

/** Options for evaluateGuardHook. */
export type EvaluateGuardHookOptions = {
  /**
   * Scope predicate over the target's file path. Return false to SKIP the file (allow it
   * unconditionally) — supplied by the CLI to honor the consumer's roots / exempt / skip config
   * so the hook never blocks edits to exempted palette source or files outside the guarded roots.
   */
  isInScope?: (relPath: string) => boolean
}

/**
 * Evaluate a PreToolUse payload against the theme guard.
 * - If the payload is not a file-writing tool: allow.
 * - If an isInScope predicate is supplied and rejects the target path: allow.
 * - If no violations: allow.
 * - If violations found: deny with a concise summary.
 */
export function evaluateGuardHook(
  payload: unknown,
  cfg: GuardConfig,
  opts?: EvaluateGuardHookOptions,
): GuardHookResult {
  const target = extractHookTarget(payload)
  if (target === null) return { permissionDecision: 'allow' }

  if (opts?.isInScope !== undefined && !opts.isInScope(target.relPath)) {
    return { permissionDecision: 'allow' }
  }

  const findings = checkSource(target.text, target.relPath, cfg)
  if (findings.length === 0) return { permissionDecision: 'allow' }

  const shown = findings.slice(0, 10)
  const lines = shown.map((f) => `${f.kind} @ ${f.line}: ${f.token}`)
  const extra = findings.length > 10 ? ` (+${findings.length - 10} more)` : ''
  const reason =
    `basalt theme-guard: ${findings.length} off-palette/off-system violation(s) in ${target.relPath}\n` +
    lines.join('\n') +
    extra +
    '\nFix: route colors through VX.* / Mantine theme; use spacing/radius tokens; add `theme-allow` for deliberate exceptions.'

  return { permissionDecision: 'deny', reason }
}
