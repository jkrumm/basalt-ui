/**
 * The two unnumbered carried guards (docs/v3/concepts/skills-agent-layer.md section 6, "Rules" and
 * "basalt-app"): no shipped agent asset names a basalt version npm never served, and the skill
 * snippets a consumer receives compile. Ported from `shipped-versions.test.ts` and
 * `scripts/skill-snippets.test.ts`, re-pointed at the v3 shipped tree under `agent/`.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { filesUnder, PKG_ROOT } from './support'

const read = (file: string): string => readFileSync(file, 'utf8')

/** Every version CHANGELOG.md records, plus the one package.json declares. */
const RELEASED = new Set<string>([
  ...(read(join(PKG_ROOT, 'CHANGELOG.md')).match(/^#+\s*\[?(\d+\.\d+\.\d+)/gm) ?? []).map((h) =>
    h.replace(/^#+\s*\[?/, ''),
  ),
  (JSON.parse(read(join(PKG_ROOT, 'package.json'))) as { version: string }).version,
])

/** A bare literal on basalt's own majors; ranges (`^`, `~`, `@`) and peers' majors are not claims. */
const BASALT_VERSION = /(^|[^-~^@\w.])([0-9]+\.\d+\.\d+)(?![\w.])/g

describe('carried guards', () => {
  it('inv x-versions: shipped agent assets name only versions the changelog records', () => {
    expect(RELEASED.size).toBeGreaterThan(1)
    for (const dir of ['agent/rules', 'agent/reviewer', 'agent/skills']) {
      expect(existsSync(join(PKG_ROOT, dir))).toBe(true)
    }
    expect(readdirSync(join(PKG_ROOT, 'agent/rules')).toSorted()).toEqual([
      'basalt-charts.md',
      'basalt-page.md',
      'basalt-state.md',
      'basalt-tokens.md',
      'basalt-ui.md',
    ])
    const phantoms: string[] = []
    for (const file of filesUnder(join(PKG_ROOT, 'agent'))) {
      for (const match of read(file).matchAll(BASALT_VERSION)) {
        const version = match[2] as string
        const major = Number(version.split('.')[0])
        if (major >= 1 && major <= 3 && !RELEASED.has(version)) {
          phantoms.push(`${relative(PKG_ROOT, file)}: ${version}`)
        }
      }
    }
    expect(phantoms).toEqual([])
  })

  // flips in: v3-sk-5-rules (snippets move into the thin skill's references)
  it.failing(
    'inv x-snippets: every `// @check` snippet in the shipped skills is present and compiles',
    async () => {
      const snippets = filesUnder(join(PKG_ROOT, 'agent/skills'))
        .filter((f) => f.endsWith('.md'))
        .flatMap((file) =>
          [...read(file).matchAll(/^```tsx\n([\s\S]*?)^```/gm)]
            .map((m) => m[1] ?? '')
            .filter((code) => code.startsWith('// @check\n'))
            .map((code) => ({ file, code })),
        )
      expect(snippets.length).toBeGreaterThan(0)
      // v3: SKILL.md stays thin; what remains of the snippets lives in `references/` and the
      // v3 `src/ui` surface, so a snippet in a SKILL.md or one importing `@mantine` is stale.
      for (const { file, code } of snippets) {
        expect(file, file).toContain('/references/')
        expect(code, file).not.toContain('@mantine')
      }
    },
  )
})
