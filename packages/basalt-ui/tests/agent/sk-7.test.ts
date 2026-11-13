/**
 * sk-7: the `basalt-design` references and the DESIGN.md seed.
 *
 * Kept set: the thin-skill spike killed the 2.x reference set (`docs/v3/spikes/thin-skill.md`,
 * 2 removed against 3 needed) but measured token and lint classes only. The expression-1 cycle
 * (`docs/v3/cycles/expression-1.md`) then routed every `planned` finding it traced to a missing or
 * misleading reference to this row, so the six files below are the kept set and the other 2.x
 * names stay dropped. `check 11` of `doctor` (DESIGN.md: at most 150 lines, no hex literal or
 * Mantine, deviations carry reasons) is not in this tree yet; `designCheck` mirrors its clause so
 * the seed is proven against the same rule the doctor will hold.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkRuleTags, loadSources } from '../../scripts/check-rule-tags'

const pkgRoot = join(import.meta.dirname, '..', '..')
const repoRoot = join(pkgRoot, '..', '..')
const skillDir = join(pkgRoot, 'agent/skills/basalt-design')
const refsDir = join(skillDir, 'references')
const read = (p: string): string => readFileSync(p, 'utf8')

const KEPT = ['concept', 'encoding', 'states', 'copy', 'charts', 'cards'] as const
/** Owned by sk-6, outside this row. */
const SK6 = ['anti-defaults'] as const
/** 2.x reference names the kill dropped; `cards` replaces `stat-tile`. */
const DROPPED = ['catalogue', 'encoding-rules', 'recipes', 'stat-tile'] as const

const refText = (name: string): string => read(join(refsDir, `${name}.md`))

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
  )

describe('sk-7 evidence for the kept set', () => {
  test('the spike records the kill and the cycle routes its findings to sk-7', () => {
    expect(read(join(repoRoot, 'docs/v3/spikes/thin-skill.md'))).toMatch(/Kill: yes/)
    expect(read(join(repoRoot, 'docs/v3/cycles/expression-1.md'))).toMatch(/sk-7 \(\d+\)/)
  })
})

describe('sk-7 references', () => {
  const skill = read(join(skillDir, 'SKILL.md'))

  test('each kept reference exists and SKILL.md links it', () => {
    for (const name of KEPT) {
      expect(existsSync(join(refsDir, `${name}.md`))).toBe(true)
      expect(skill).toContain(`](references/${name}.md)`)
    }
  })

  test('no file exists for a dropped reference, and nothing else is in the folder', () => {
    for (const name of DROPPED) expect(existsSync(join(refsDir, `${name}.md`))).toBe(false)
    const expected = [...KEPT, ...SK6].map((n) => `${n}.md`).toSorted()
    expect(readdirSync(refsDir).toSorted()).toEqual(expected)
  })

  test('no reference holds a props table, a code fence or a pasted signature', () => {
    for (const name of KEPT) {
      const text = refText(name)
      expect(text).not.toContain('```')
      expect(text).not.toMatch(/^\s*\|/m)
      expect(text).not.toMatch(/^#+\s*(Signature|Props)\b/im)
      expect(text).not.toMatch(/\w+\?:\s/)
    }
  })

  test('each export named has a generated doc and links to it', () => {
    const docs = new Map<string, string>()
    for (const f of readdirSync(join(pkgRoot, 'docs')).filter((n) => n.endsWith('.md'))) {
      const name = /^name: (.+)$/m.exec(read(join(pkgRoot, 'docs', f)))?.[1]
      if (name) docs.set(name.trim(), f)
    }
    for (const name of KEPT) {
      const text = refText(name)
      for (const m of text.matchAll(/\[([A-Za-z]\w*)\]\(docs\/([\w-]+\.md)\)/g)) {
        expect(docs.get(m[1] as string)).toBe(m[2] as string)
      }
      const prose = text.replace(/\[[^\]]*\]\([^)]*\)/g, '')
      for (const m of prose.matchAll(/`([A-Za-z]\w*)(?:\(\))?`/g)) {
        const id = m[1] as string
        // A name with a generated doc is linked; only its link text is allowed to carry it bare.
        if (docs.has(id) && /^[A-Z]/.test(id)) {
          throw new Error(`${name}.md names ${id} without a link to docs/${docs.get(id)}`)
        }
      }
    }
  })

  test('every playground region a reference cites exists', () => {
    const sources = walk(join(repoRoot, 'apps/playground/src')).map((f) => ({ f, text: read(f) }))
    for (const name of KEPT) {
      const text = refText(name)
      for (const m of text.matchAll(/region `([^`]+)`/g)) {
        expect(sources.some((s) => s.text.includes(`#region ${m[1]}\n`))).toBe(true)
      }
      for (const m of text.matchAll(/`(apps\/playground\/[^`]+)`/g)) {
        expect(existsSync(join(repoRoot, m[1] as string))).toBe(true)
      }
    }
  })

  test('every prohibition bullet ends in a tag that resolves, or sits under not guarded', () => {
    const sources = loadSources()
    const prohibition = /\b(never|no|not|don't|must not)\b/i
    for (const name of KEPT) {
      const bullets: string[] = []
      let notGuarded = false
      let open: string | undefined
      const close = (): void => {
        // Quoted example text ("No data") is shown, not instructed.
        const instructed = open?.replace(/"[^"]*"/g, '')
        if (open !== undefined && !notGuarded && prohibition.test(instructed ?? '')) {
          bullets.push(open)
        }
        if (open !== undefined && /(\[(?:lint|type):[^\]]+\]\s*)+$/.test(open)) {
          if (notGuarded || !bullets.includes(open)) bullets.push(open)
        }
        open = undefined
      }
      for (const line of refText(name).split('\n')) {
        if (line.startsWith('#')) {
          close()
          notGuarded = false
        } else if (/^not guarded:\s*$/i.test(line)) {
          close()
          notGuarded = true
        } else if (line.startsWith('- ')) {
          close()
          open = line
        } else if (open !== undefined && /^\s+\S/.test(line)) open += ` ${line.trim()}`
        else close()
      }
      close()
      const doc = `# x\n\nintro\n\n## s\n\n${bullets.join('\n')}\n`
      const report = checkRuleTags(doc, sources)
      expect({ name, failures: report.failures }).toEqual({ name, failures: [] })
    }
  })

  test('the doctrine flips are taught', () => {
    expect(refText('cards')).toMatch(/tinted badge/)
    expect(refText('cards')).toMatch(/sentence-case sans/)
    expect(refText('cards')).toMatch(/ink-inverted/)
    expect(refText('cards')).toMatch(/polarity/)
  })

  test('the expression carry-overs are in the references that serve them', () => {
    const charts = refText('charts')
    expect(charts).toMatch(/Neutral by default, one accent, one status hue/)
    expect(charts).toMatch(/baseline/)
    expect(charts).toMatch(/example:chartLabels/)
    expect(charts).toMatch(/one tab stop/i)
    expect(refText('states')).toMatch(/Say once what is missing/)
    expect(refText('copy')).toMatch(/qualifier appears once/)
    expect(refText('concept')).toMatch(/extreme at rest/)
    expect(refText('concept')).toMatch(/above the fold/)
  })
})

/** The DESIGN.md clause of `doctor` check 11: size, hex, Mantine, and a reason on each deviation. */
function designCheck(text: string): string[] {
  const failures: string[] = []
  if (text.split('\n').length > 150) failures.push('more than 150 lines')
  if (/#[0-9a-fA-F]{3,8}\b/.test(text)) failures.push('hex literal')
  if (/mantine/i.test(text)) failures.push('Mantine')
  const deviations = /^## Deviations\n([\s\S]*?)(?=\n## |(?![\s\S]))/m.exec(text)?.[1] ?? ''
  for (const line of deviations.split('\n').filter((l) => l.startsWith('- '))) {
    if (/^- _none yet_$/.test(line)) continue
    if (!/ — \S/.test(line)) failures.push(`deviation without a reason: ${line}`)
  }
  return failures
}

const render = (tpl: string): string =>
  tpl
    .replaceAll('{{APP_NAME}}', 'fixture-app')
    .replaceAll('{{ACCENT_HUE}}', 'blue')
    .replaceAll('{{SERIES_MODULE_PATH}}', 'src/lib/series.ts')

describe('sk-7 DESIGN.md seed', () => {
  const tpl = read(join(pkgRoot, 'agent/templates/DESIGN.md.tpl'))
  const seed = render(tpl)

  test('the seed is at most 150 lines with no hex literal or the word Mantine', () => {
    expect(tpl.split('\n').length).toBeLessThanOrEqual(150)
    expect(tpl).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(tpl).not.toMatch(/mantine/i)
  })

  test('every placeholder in the seed is one the init renderer fills', () => {
    const known = new Set(['APP_NAME', 'ACCENT_HUE', 'SERIES_MODULE_PATH'])
    for (const m of tpl.matchAll(/\{\{(\w+)\}\}/g)) expect(known.has(m[1] as string)).toBe(true)
    expect(seed).not.toContain('{{')
  })

  test('Identity is generated from the config, Direction is empty, deviations are empty', () => {
    expect(seed).toMatch(/## Identity[\s\S]*Accent hue:\*\* blue/)
    const direction = /## Direction\n([\s\S]*?)\n## /.exec(seed)?.[1] ?? ''
    expect(direction).toMatch(/owner writes this/)
    expect(direction).not.toMatch(/^- /m)
    expect(seed).toMatch(/## Deviations[\s\S]*- _none yet_/)
  })

  test('the AGENTS block does not import DESIGN.md', () => {
    for (const f of ['AGENTS-block.md.tpl', 'AGENTS-block.tokens.md.tpl']) {
      expect(read(join(pkgRoot, 'agent/templates', f))).not.toMatch(/@\.?\/?DESIGN\.md/)
    }
  })

  test('check 11 passes the rendered seed', () => {
    expect(designCheck(seed)).toEqual([])
  })

  test('check 11 fails a copy with a stale Identity hex', () => {
    const stale = seed.replace('- **Accent hue:** blue', '- **Accent hue:** blue (#0077bd)')
    expect(designCheck(stale)).toContain('hex literal')
  })

  test('check 11 fails an unreasoned deviation and passes a reasoned one', () => {
    const bare = seed.replace('- _none yet_', '- Cards: at most three per row')
    expect(designCheck(bare)).toEqual([
      'deviation without a reason: - Cards: at most three per row',
    ])
    const reasoned = seed.replace(
      '- _none yet_',
      '- Cards: at most three per row — the table needs the width',
    )
    expect(designCheck(reasoned)).toEqual([])
  })
})
