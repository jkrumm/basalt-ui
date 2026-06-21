/**
 * Tests for the PreToolUse hook adapter helpers.
 * Exercises extractHookTarget and evaluateGuardHook directly — no process spawn needed.
 */
import { describe, expect, it } from 'bun:test'
import { DEFAULT_GUARD_CONFIG } from './index'
import { evaluateGuardHook, extractHookTarget } from './guard-hook'

// ── extractHookTarget ─────────────────────────────────────────────────────────

describe('extractHookTarget', () => {
  it('returns null for a non-object payload', () => {
    expect(extractHookTarget(null)).toBeNull()
    expect(extractHookTarget('string')).toBeNull()
    expect(extractHookTarget(42)).toBeNull()
  })

  it('returns null for a non-Write/Edit/MultiEdit tool', () => {
    expect(extractHookTarget({ tool_name: 'Bash', tool_input: { command: 'ls' } })).toBeNull()
  })

  it('extracts a Write payload with file_text', () => {
    const result = extractHookTarget({
      tool_name: 'Write',
      tool_input: { file_path: 'src/Foo.tsx', file_text: 'const x = 1' },
    })
    expect(result).toEqual({ relPath: 'src/Foo.tsx', text: 'const x = 1' })
  })

  it('extracts a Write payload with content (fallback field)', () => {
    const result = extractHookTarget({
      tool_name: 'Write',
      tool_input: { file_path: 'src/Bar.tsx', content: 'const y = 2' },
    })
    expect(result).toEqual({ relPath: 'src/Bar.tsx', text: 'const y = 2' })
  })

  it('extracts an Edit payload with new_string', () => {
    const result = extractHookTarget({
      tool_name: 'Edit',
      tool_input: { file_path: 'src/A.tsx', new_string: 'const z = 3' },
    })
    expect(result).toEqual({ relPath: 'src/A.tsx', text: 'const z = 3' })
  })

  it('returns null for Edit without new_string', () => {
    expect(
      extractHookTarget({ tool_name: 'Edit', tool_input: { file_path: 'src/A.tsx' } }),
    ).toBeNull()
  })

  it('extracts a MultiEdit payload concatenating new_string entries', () => {
    const result = extractHookTarget({
      tool_name: 'MultiEdit',
      tool_input: {
        file_path: 'src/M.tsx',
        edits: [{ new_string: 'part one' }, { new_string: 'part two' }],
      },
    })
    expect(result).toEqual({ relPath: 'src/M.tsx', text: 'part one\npart two' })
  })

  it('extracts a MultiEdit payload accepting new_text as the alternate field name', () => {
    const result = extractHookTarget({
      tool_name: 'MultiEdit',
      tool_input: {
        file_path: 'src/N.tsx',
        edits: [{ new_text: 'via new_text' }],
      },
    })
    expect(result).toEqual({ relPath: 'src/N.tsx', text: 'via new_text' })
  })
})

// ── evaluateGuardHook ─────────────────────────────────────────────────────────

describe('evaluateGuardHook', () => {
  it('allows a Write payload with clean content', () => {
    const result = evaluateGuardHook(
      {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/apps/dashboard/src/Clean.tsx',
          file_text: 'const x = VX.surface.panel',
        },
      },
      DEFAULT_GUARD_CONFIG,
    )
    expect(result.permissionDecision).toBe('allow')
    expect(result.reason).toBeUndefined()
  })

  it('denies a Write payload containing a raw hex literal', () => {
    const result = evaluateGuardHook(
      {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/Dashboard.tsx',
          file_text: "const c = '#abc123'",
        },
      },
      DEFAULT_GUARD_CONFIG,
    )
    expect(result.permissionDecision).toBe('deny')
    expect(result.reason).toBeDefined()
    expect(result.reason).toContain('raw-hex')
    expect(result.reason).toContain('#abc123')
  })

  it('allows a non-file-writing tool (Bash)', () => {
    const result = evaluateGuardHook(
      { tool_name: 'Bash', tool_input: { command: 'ls' } },
      DEFAULT_GUARD_CONFIG,
    )
    expect(result.permissionDecision).toBe('allow')
  })

  it('allows an unparseable (null) payload', () => {
    const result = evaluateGuardHook(null, DEFAULT_GUARD_CONFIG)
    expect(result.permissionDecision).toBe('allow')
  })

  it('deny reason includes the file path and violation count', () => {
    const result = evaluateGuardHook(
      {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/Page.tsx',
          file_text: "const c = '#ff0000'\nconst d = '#00ff00'",
        },
      },
      DEFAULT_GUARD_CONFIG,
    )
    expect(result.permissionDecision).toBe('deny')
    expect(result.reason).toContain('src/Page.tsx')
    expect(result.reason).toContain('2 off-palette')
  })

  it('allows an Edit payload with no violations', () => {
    const result = evaluateGuardHook(
      {
        tool_name: 'Edit',
        tool_input: { file_path: 'src/X.tsx', new_string: 'const ok = true' },
      },
      DEFAULT_GUARD_CONFIG,
    )
    expect(result.permissionDecision).toBe('allow')
  })

  it('allows an out-of-scope file even with violations (isInScope returns false)', () => {
    const result = evaluateGuardHook(
      {
        tool_name: 'Write',
        tool_input: { file_path: 'src/theme/palette.ts', file_text: "const c = '#abc123'" },
      },
      DEFAULT_GUARD_CONFIG,
      { isInScope: () => false },
    )
    expect(result.permissionDecision).toBe('allow')
  })

  it('denies an in-scope file with violations (isInScope returns true)', () => {
    const result = evaluateGuardHook(
      {
        tool_name: 'Write',
        tool_input: { file_path: 'src/Page.tsx', file_text: "const c = '#abc123'" },
      },
      DEFAULT_GUARD_CONFIG,
      { isInScope: () => true },
    )
    expect(result.permissionDecision).toBe('deny')
  })
})
