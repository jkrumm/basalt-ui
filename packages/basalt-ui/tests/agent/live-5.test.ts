/**
 * live-5 (live-realtime 10 issue 5): the basalt-app `references/live.md` teaches the live layer and
 * keeps the skill law (skills teach, rules guarantee): every prohibition bullet (one that starts
 * with "Never") ends in a tag that resolves, or sits under `not guarded:`. Its one compiled snippet
 * type-checks against the built declarations, and the websocket-transport recipe is in the
 * recipes channel.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { loadSources } from '../../scripts/check-rule-tags'

const pkgRoot = join(import.meta.dirname, '..', '..')
const live = readFileSync(join(pkgRoot, 'agent/skills/basalt-app/references/live.md'), 'utf8')

const TAGS = /\[(lint|type):([\w$-]+)\]/g
const TRAILING = /(?:\s*\[(?:lint|type):[\w$-]+\])+\s*$/

/** Top-level bullets with the zone they sit in: `guarded` above `not guarded:`, `unguarded` below. */
function bullets(markdown: string): { text: string; line: number; guarded: boolean }[] {
  const out: { text: string; line: number; guarded: boolean }[] = []
  let guarded = true
  let inFence = false
  let current: { text: string; line: number } | undefined
  const close = (): void => {
    if (current) out.push({ ...current, guarded })
    current = undefined
  }
  markdown.split('\n').forEach((raw, idx) => {
    if (raw.startsWith('```')) {
      close()
      inFence = !inFence
      return
    }
    if (inFence) return
    if (/^not guarded:\s*$/i.test(raw)) {
      close()
      guarded = false
      return
    }
    if (/^-\s/.test(raw)) {
      close()
      current = { text: raw, line: idx + 1 }
    } else if (current && /^\s+\S/.test(raw)) current.text += ` ${raw.trim()}`
    else close()
  })
  close()
  return out
}

describe('live-5 references/live.md', () => {
  const all = bullets(live)

  test('every prohibition above `not guarded:` ends in a tag that resolves', () => {
    const sources = loadSources()
    const prohibitions = all.filter((b) => b.guarded && /^-\s+Never\b/.test(b.text))
    expect(prohibitions.length).toBeGreaterThanOrEqual(5)
    for (const b of prohibitions) {
      expect(TRAILING.test(b.text), `line ${b.line} has no trailing tag`).toBe(true)
      for (const [, kind, name] of b.text.matchAll(TAGS)) {
        const known = kind === 'lint' ? sources.lintIds : sources.typeNames
        expect(known.has(name!), `line ${b.line}: [${kind}:${name}] does not resolve`).toBe(true)
      }
    }
  })

  test('the lines under `not guarded:` carry no tag (they claim no guard)', () => {
    const unguarded = all.filter((b) => !b.guarded)
    expect(unguarded.length).toBeGreaterThan(0)
    for (const b of unguarded) expect(b.text, `line ${b.line}`).not.toMatch(TAGS)
  })

  test('teaches each part of the live layer the brief names', () => {
    for (const heading of [
      '## The ladder',
      '## Channel, frames, roots',
      '## Indicator and age on every live surface',
      '## Server checklist',
      '## Cursorless mode',
      '## Offline semantics',
      '## SSR and privacy',
      '## Settle, reload, persist, multi-tab',
    ]) {
      expect(live).toContain(heading)
    }
    expect(live).toContain('docs/recipes/websocket-transport.md')
  })

  test('names no Mantine API and no model id', () => {
    expect(live).not.toMatch(/mantine|claude-/i)
  })

  test('its snippet type-checks against the built declarations', async () => {
    expect(existsSync(join(pkgRoot, 'dist/index.d.ts')), 'run `bun run build` first').toBe(true)
    const fences = [...live.matchAll(/^```tsx\n(\/\/ @check\n[\s\S]*?)^```/gm)].map((m) => m[1]!)
    expect(fences).toHaveLength(1)
    const cacheRoot = join(pkgRoot, 'node_modules/.cache')
    mkdirSync(cacheRoot, { recursive: true })
    const dir = mkdtempSync(join(cacheRoot, 'live-5-'))
    try {
      writeFileSync(join(dir, 'snippet.tsx'), fences[0]!)
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({
          extends: join(pkgRoot, 'configs/tsconfig.react-app.json'),
          compilerOptions: {
            types: ['bun'],
            paths: {
              'basalt-ui': [join(pkgRoot, 'dist/index.d.ts')],
              'basalt-ui/*': [join(pkgRoot, 'dist/*')],
            },
          },
          include: ['./*.tsx'],
        }),
      )
      const tsc = Bun.spawn([join(pkgRoot, 'node_modules/.bin/tsc'), '-p', dir], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const output = await new Response(tsc.stdout).text()
      expect(await tsc.exited, output).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 120_000)
})

describe('live-5 websocket-transport recipe', () => {
  test('is in the recipes channel with its frontmatter and the 4401 and abort rules', () => {
    const doc = readFileSync(join(pkgRoot, 'docs/recipes/websocket-transport.md'), 'utf8')
    expect(doc).toMatch(/^name: websocket-transport$/m)
    expect(doc).toMatch(/^file: apps\/playground\/src\/recipes\/websocket-transport\.ts$/m)
    expect(doc).toContain('4401')
    expect(doc).toMatch(/abort closes the socket/)
  })
})
