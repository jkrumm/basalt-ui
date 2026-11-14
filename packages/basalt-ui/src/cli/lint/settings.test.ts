import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { basaltEntries, mergeSettings, SHIM } from './settings'

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../../test/fixtures/hook/merge/${name}`, import.meta.url)),
    'utf8',
  )

const merged = (text: string | null): string => {
  const out = mergeSettings(text)
  if ('error' in out) throw new Error(out.error)
  return out.text
}

type Settings = { hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]> }
const entries = (text: string): Settings['hooks'] => (JSON.parse(text) as Settings).hooks
const basaltOf = (text: string, event: string) =>
  (entries(text)[event] ?? []).filter((e) => e.hooks.some((h) => h.command.includes(SHIM)))

describe('mergeSettings', () => {
  it('writes the three wrapped entries into a missing file', () => {
    const text = merged(null)
    expect(Object.keys(entries(text))).toEqual(['PostToolUse', 'Stop', 'PreToolUse'])
    for (const event of Object.keys(basaltEntries())) expect(basaltOf(text, event)).toHaveLength(1)
    expect(basaltOf(text, 'Stop')[0]?.hooks[0]?.command).toContain('case $s in 0|2) exit $s;; esac')
  })

  it('keeps a live-library guard byte-identical and adds the basalt events around it', () => {
    const before = fixture('shutterflow.json')
    const guard = JSON.stringify(entries(before)['PreToolUse']?.[0], null, 2)
    const after = merged(before)
    expect(after).toContain(guard.replaceAll('\n', '\n      '))
    expect(entries(after)['PreToolUse']?.[0]).toEqual(entries(before)['PreToolUse']?.[0])
    expect(basaltOf(after, 'PreToolUse')).toHaveLength(1)
    expect(basaltOf(after, 'PostToolUse')).toHaveLength(1)
  })

  it('leaves every other line of a hand-formatted file untouched (compact arrays, other keys)', () => {
    const before = fixture('rb.json')
    const after = merged(before)
    for (const line of before.split('\n')) expect(after).toContain(line)
    const legacy = entries(after)['PreToolUse']?.[0]?.hooks[0]?.command
    expect(legacy).toBe('bunx basalt-ui guard-hook')
    expect(JSON.parse(after).permissions).toEqual({ allow: ['Bash(bun run:*)'] })
  })

  it('is a no-op the second time, byte for byte', () => {
    for (const name of ['shutterflow.json', 'rb.json', 'tabs.json']) {
      const once = merged(fixture(name))
      expect(merged(once)).toBe(once)
    }
    const fresh = merged(null)
    expect(merged(fresh)).toBe(fresh)
  })

  it('replaces a stale basalt entry in place and keeps its neighbours', () => {
    const stale = JSON.stringify(
      {
        hooks: {
          Stop: [
            { hooks: [{ type: 'command', command: 'make first' }] },
            {
              hooks: [
                { type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" stop' },
              ],
            },
            { hooks: [{ type: 'command', command: 'make last' }] },
          ],
        },
      },
      null,
      2,
    )
    const after = merged(stale)
    const stop = entries(after)['Stop'] ?? []
    expect(stop.map((e) => e.hooks[0]?.command.split(' ')[0])).toEqual(['make', 'node', 'make'])
    expect(stop[1]?.hooks[0]?.command).toContain('exit 2')
  })

  it('never drops a foreign command that shares an entry with a basalt one', () => {
    const shared = JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              { type: 'command', command: 'node .basalt/hook.mjs stop' },
              { type: 'command', command: 'make mine' },
            ],
          },
        ],
      },
    })
    const stop = entries(merged(shared))['Stop'] ?? []
    expect(JSON.stringify(stop)).toContain('make mine')
  })

  it("indents with the file's own unit", () => {
    const after = merged(fixture('tabs.json'))
    expect(after).toContain('\n\t\t"PostToolUse": [')
    expect(entries(after)['Stop']?.[0]?.hooks[0]?.command).toBe('make stop-check')
  })

  it('refuses unparseable JSON and a wrong shape, and writes nothing', () => {
    expect(mergeSettings(fixture('broken.json'))).toEqual({
      error: expect.stringContaining('not valid JSON'),
    })
    expect(mergeSettings('[]')).toEqual({ error: expect.stringContaining('not a JSON object') })
    expect(mergeSettings('{"hooks": []}')).toEqual({
      error: expect.stringContaining('"hooks" is not an object'),
    })
    expect(mergeSettings('{"hooks": {"Stop": {}}}')).toEqual({
      error: expect.stringContaining('is not an array'),
    })
  })
})
