/**
 * The four agent-layer guards in scripts/agent-layer-guards.ts. Each runs on the real tree, which must
 * come back clean, and reports exactly the expected failure on a seeded offender. The real-tree cases
 * fail while the agent text still carries the offence the guard names.
 */
import { describe, expect, it } from 'bun:test'

import {
  agentFiles,
  appsPaths,
  blockSkillLines,
  claimFindings,
  docFiles,
  historyFindings,
  skillLines,
} from '../../scripts/agent-layer-guards'

describe('agent layer guard: skill bullets', () => {
  it('gives every skill under agent/skills a bullet in the AGENTS block (real tree)', () => {
    expect(blockSkillLines()).toEqual([])
  })

  it('reports a skill with no bullet, a short bullet and a missing literal (seeded)', () => {
    const block = [
      '- `/basalt-design`: Design and build a page in a basalt-ui app.',
      '- `/basalt-charts`: Short.',
      'Run `basalt-ui lint --changed` before you report.',
    ].join('\n')
    expect(skillLines(block, ['basalt-design', 'basalt-charts', 'basalt-state'])).toEqual([
      'skill /basalt-charts: no bullet "- /basalt-charts:" with 20 characters of text',
      'skill /basalt-state: no bullet "- /basalt-state:" with 20 characters of text',
      'block: missing "Claude Code"',
    ])
  })
})

describe('agent layer guard: repo-only apps/ paths', () => {
  it('no file under agent/** names an apps/ path (real tree)', () => {
    expect(appsPaths(agentFiles())).toEqual([])
  })

  it('reports apps/ in prose and in fenced code (seeded)', () => {
    const text = 'See apps/web for the demo.\nFine line.\n```ts\napps/x\n```\n'
    expect(appsPaths([{ path: 'agent/rules/x.md', text }])).toEqual([
      'agent/rules/x.md:1: apps/',
      'agent/rules/x.md:4: apps/',
    ])
  })
})

describe('agent layer guard: history in prose', () => {
  it('agent prose carries no history (real tree)', () => {
    expect(historyFindings(agentFiles().filter((f) => /\.(md|tpl)$/.test(f.path)))).toEqual([])
  })

  it('flags history in prose and ignores code and code spans (seeded)', () => {
    const text = [
      'Cycle 12 was fine.',
      '`cycle 3` in code',
      '```',
      'the owner in code',
      '```',
      'Wave 18 said the owner.',
    ].join('\n')
    expect(historyFindings([{ path: 'agent/rules/x.md', text }])).toEqual([
      { file: 'agent/rules/x.md', line: 1, id: 'cycle-number', text: 'Cycle 12 was fine.' },
      { file: 'agent/rules/x.md', line: 6, id: 'wave-id', text: 'Wave 18 said the owner.' },
      { file: 'agent/rules/x.md', line: 6, id: 'owner', text: 'Wave 18 said the owner.' },
    ])
  })
})

describe('agent layer guard: claims resolve against the package source', () => {
  it('every specifier, import name, export name and CLI flag resolves (real tree)', () => {
    expect(claimFindings([...agentFiles(), ...docFiles()])).toEqual([])
  })

  it('reports an unresolved specifier, a missing export, a bad flag and a bad import (seeded)', () => {
    const text = [
      'Use `basalt-ui/nope` for it.',
      'Call `Frobnicate` then `basalt-ui lint --changed`.',
      'Run `basalt-ui lint --bogus`.',
      '```ts',
      "import { CartesianChart, Nope } from 'basalt-ui/charts'",
      '```',
    ].join('\n')
    expect(claimFindings([{ path: 'agent/rules/x.md', text }])).toEqual([
      { file: 'agent/rules/x.md', line: 1, kind: 'specifier', text: 'basalt-ui/nope' },
      { file: 'agent/rules/x.md', line: 2, kind: 'export-name', text: 'Frobnicate' },
      { file: 'agent/rules/x.md', line: 3, kind: 'cli-flag', text: 'basalt-ui lint --bogus' },
      {
        file: 'agent/rules/x.md',
        line: 5,
        kind: 'import-name',
        text: "Nope from 'basalt-ui/charts'",
      },
    ])
  })

  it('a path the exports map nulls or leaves out does not resolve (seeded)', () => {
    const text = [
      'Use `basalt-ui/ui/button` for it.',
      'Not `basalt-ui/ui/button.guard`, `basalt-ui/ui/slots` or `basalt-ui/core/scheme`.',
    ].join('\n')
    expect(claimFindings([{ path: 'agent/rules/x.md', text }]).map((f) => f.text)).toEqual([
      'basalt-ui/ui/button.guard',
      'basalt-ui/ui/slots',
      'basalt-ui/core/scheme',
    ])
  })
})
