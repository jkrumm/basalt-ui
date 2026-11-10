/**
 * S6 (skills-agent-layer.md section 8): the shadcn skill and the basalt skills side by side. A static
 * scan, no agent run. Each topic pairs one instruction from each side that cannot both be followed on
 * the same surface; the harness finds both lines in the real texts (a pattern that matches nothing is
 * reported, never papered over), quotes them under 20 words and orders them by the one precedence rule.
 *
 * Stand-ins: the basalt side is the 2.x skills and rules in packages/basalt-ui/agent (the v3 skills do
 * not exist yet); the shadcn side is skills/shadcn at a pinned commit, fetched once into the OS temp dir.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { AGENT_DIR, REPO, clip, progress, walk } from './util'

/** Last commit touching skills/shadcn/SKILL.md before shadcn@4.23.0 (2026-10-14), fixed via /research on 2026-11-10. */
export const SHADCN_COMMIT = '4233ed1caded8c38f4bc14b14afe1f93ebcaf966'
const SHADCN_FILES = [
  'SKILL.md',
  'cli.md',
  'customization.md',
  'design-system.md',
  'rules/base-vs-radix.md',
  'rules/chat.md',
  'rules/composition.md',
  'rules/forms.md',
  'rules/icons.md',
  'rules/styling.md',
]

/** The deliverable: one quotable paragraph. Every topic's `surface` must occur in it. */
export const PRECEDENCE =
  "When the shadcn skill and the basalt skills are both installed, the narrowest guarded owner wins. A surface basalt names (tokens, colors and the theme including presets and `apply`, DESIGN.md, layout, the shell, charts, forms and inputs, tables, overlays, notifications, card headers, and the finish check) is basalt's, and the shadcn text for it is background to read, never an order. Where both sides carry a guard (a lint id, a type or a hook) the generated basalt preset arbitrates; where neither does, basalt's skill wins because it ships in the same install and the shadcn skill is third-party. Everything basalt names nothing for (primitives, variants, icons, base versus radix, the shadcn CLI mechanics) stays shadcn's, and what it adds or edits must then pass the basalt gate. A gap in basalt's composites is reported, never filled from a registry."

type Line = { file: string; n: number; text: string }
type Side = { file: RegExp; re: RegExp }
type Topic = {
  id: string
  surface: string
  kind: 'ownership' | 'vocabulary' | 'process'
  standInArtifact: boolean
  basalt: Side
  shadcn: Side
}

const t = (
  id: string,
  surface: string,
  kind: Topic['kind'],
  standInArtifact: boolean,
  basalt: [RegExp, RegExp],
  shadcn: [RegExp, RegExp],
): Topic => ({
  id,
  surface,
  kind,
  standInArtifact,
  basalt: { file: basalt[0], re: basalt[1] },
  shadcn: { file: shadcn[0], re: shadcn[1] },
})

const TOPICS: Topic[] = [
  t(
    'token-owner',
    'tokens',
    'ownership',
    false,
    [/rules\/basalt-tokens/, /palette is derived, never authored/],
    [/^SKILL\.md$/, /Map its tokens onto the shadcn variables/],
  ),
  t(
    'design-md',
    'DESIGN.md',
    'ownership',
    false,
    [/skills\/basalt-design\/SKILL/, /the law is/],
    [/^SKILL\.md$/, /design system from a `DESIGN\.md`/],
  ),
  t(
    'restyle-components',
    'theme',
    'ownership',
    false,
    [/rules\/basalt-tokens/, /the theme owns them/],
    [/^SKILL\.md$/, /Restyle components by editing their `cva` variants/],
  ),
  t(
    'preset-apply',
    'presets',
    'ownership',
    false,
    [/rules\/basalt-tokens/, /Fonts change only through/],
    [/^SKILL\.md$/, /Partial\*\*: `npx shadcn@latest apply/],
  ),
  t(
    'layout-primitives',
    'layout',
    'vocabulary',
    true,
    [/rules\/basalt-mantine/, /Lay out with/],
    [/^SKILL\.md$/, /No `space-x-\*` or `space-y-\*`/],
  ),
  t(
    'color-vocabulary',
    'colors',
    'vocabulary',
    true,
    [/rules\/basalt-tokens/, /Write no `#hex`/],
    [/^SKILL\.md$/, /Use semantic colors/],
  ),
  t(
    'input-primitives',
    'inputs',
    'vocabulary',
    true,
    [/rules\/basalt-mantine/, /Inputs come from/],
    [/^SKILL\.md$/, /Form inputs/],
  ),
  t(
    'shell',
    'shell',
    'ownership',
    false,
    [/rules\/basalt-mantine/, /never build `AppShell/],
    [/^SKILL\.md$/, /Dashboard = Sidebar/],
  ),
  t(
    'chart-engine',
    'charts',
    'ownership',
    false,
    [/rules\/basalt-charts/, /`@visx\/\*` is banned/],
    [/^SKILL\.md$/, /wraps Recharts/],
  ),
  t(
    'forms',
    'forms',
    'ownership',
    false,
    [/rules\/basalt-batteries/, /A field is two calls/],
    [/^SKILL\.md$/, /Forms use `FieldGroup`/],
  ),
  t(
    'tables',
    'tables',
    'ownership',
    false,
    [/rules\/basalt-batteries/, /Tables are `BasaltDataTable`/],
    [/^SKILL\.md$/, /Data display/],
  ),
  t(
    'overlays',
    'overlays',
    'ownership',
    false,
    [/rules\/basalt-controls/, /A form dialog is a `defineOverlays`/],
    [/^SKILL\.md$/, /always need a Title/],
  ),
  t(
    'notifications',
    'notifications',
    'ownership',
    false,
    [/rules\/basalt-batteries/, /Register every kind in `defineNotifications`/],
    [/^SKILL\.md$/, /Toast follows the project base/],
  ),
  t(
    'card-headers',
    'card headers',
    'ownership',
    false,
    [/rules\/basalt-controls/, /title is a `WidgetHeader`/],
    [/^SKILL\.md$/, /Use full Card composition/],
  ),
  t(
    'gap-fill',
    'registry',
    'ownership',
    false,
    [/skills\/basalt-design\/SKILL/, /A gap is reported, not routed around/],
    [/^SKILL\.md$/, /check registries before writing custom UI/],
  ),
  t(
    'finish-check',
    'finish check',
    'process',
    false,
    [/skills\/basalt-design\/SKILL/, /\*\*Done\*\* only when/],
    [/^SKILL\.md$/, /Verify in a browser/],
  ),
]

async function loadShadcn(): Promise<Map<string, string>> {
  const cache = join(tmpdir(), 'basalt-hook-sync-cache', SHADCN_COMMIT)
  const out = new Map<string, string>()
  for (const f of SHADCN_FILES) {
    const path = join(cache, f)
    if (!existsSync(path)) {
      const res = await fetch(
        `https://raw.githubusercontent.com/shadcn-ui/ui/${SHADCN_COMMIT}/skills/shadcn/${f}`,
      )
      if (!res.ok) throw new Error(`shadcn ${f}: HTTP ${res.status}`)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, await res.text())
    }
    out.set(f, readFileSync(path, 'utf8'))
  }
  return out
}

function basaltCorpus(): Map<string, string> {
  const out = new Map<string, string>()
  for (const kind of ['rules', 'skills']) {
    for (const f of walk(join(AGENT_DIR, kind)))
      if (f.endsWith('.md')) out.set(`${kind}/${f}`, readFileSync(join(AGENT_DIR, kind, f), 'utf8'))
  }
  return out
}

function find(corpus: Map<string, string>, side: Side): (Line & { sentence: string }) | null {
  for (const [file, text] of corpus) {
    if (!side.file.test(file)) continue
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!side.re.test(lines[i]!)) continue
      const plain = lines[i]!.replace(/^[\s>|*\-\d.]+/, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
      const loose = new RegExp(side.re.source.replace(/\\\*\\\*/g, ''), side.re.flags)
      const hit = plain.split(/(?<=[.;])\s+/).find((x) => loose.test(x)) ?? plain
      return { file, n: i + 1, text: lines[i]!, sentence: hit }
    }
  }
  return null
}

export async function runS6() {
  progress('s6: loading the shadcn skill at the pinned commit')
  let shadcn: Map<string, string>
  try {
    shadcn = await loadShadcn()
  } catch (e) {
    return {
      error: `shadcn skill not available: ${e instanceof Error ? e.message : e}`,
      conflicts: [],
      verdict: 'pending' as const,
    }
  }
  const basalt = basaltCorpus()
  progress('s6: scanning for contradicting instructions')
  const conflicts: unknown[] = []
  const unmatched: string[] = []
  for (const topic of TOPICS) {
    const b = find(basalt, topic.basalt)
    const s = find(shadcn, topic.shadcn)
    if (b === null || s === null) {
      unmatched.push(topic.id)
      continue
    }
    const basaltTier = /\[(?:check-theme|basalt\/|type )[^\]]*\]/.test(b.text)
      ? 'guarded'
      : 'skill-prose'
    conflicts.push({
      id: topic.id,
      surface: topic.surface,
      kind: topic.kind,
      standInArtifact: topic.standInArtifact,
      basalt: { at: `${b.file}:${b.n}`, tier: basaltTier, quote: clip(b.sentence) },
      shadcn: { at: `shadcn/${s.file}:${s.n}`, tier: 'prose', quote: clip(s.sentence) },
      winner: 'basalt',
      by:
        basaltTier === 'guarded'
          ? 'guard (lint id or type)'
          : 'same-install skill over third-party skill',
    })
  }
  const missingSurfaces = TOPICS.filter(
    (x) => !PRECEDENCE.toLowerCase().includes(x.surface.toLowerCase()),
  ).map((x) => x.id)
  const docPath = join(REPO, 'docs/v3/spikes/hook-sync.md')
  const precedenceInDoc =
    existsSync(docPath) && readFileSync(docPath, 'utf8').split('\n').includes(PRECEDENCE)
  const skill = shadcn.get('SKILL.md')!
  return {
    pinned: {
      repo: 'shadcn-ui/ui',
      commit: SHADCN_COMMIT,
      cli: 'shadcn@4.23.0',
      skillPath: 'skills/shadcn/SKILL.md',
    },
    conflicts,
    unmatched,
    precedence: { words: PRECEDENCE.split(/\s+/).length, missingSurfaces, inDoc: precedenceInDoc },
    corpus: {
      shadcnBytes: [...shadcn.values()].reduce((n, x) => n + x.length, 0),
      shadcnSkillMdBytes: skill.length,
      basaltSkillAndRuleBytes: [...basalt.values()].reduce((n, x) => n + x.length, 0),
    },
    notes: {
      loadHook:
        'shadcn SKILL.md runs `npx shadcn@latest info --json` when it loads (a `!` command block); user-invocable: false',
      namespace:
        'installs to .claude/skills/shadcn (derived from the skills CLI agent table, not run here); outside the managed basalt-* namespace',
      triggerOverlap:
        'shadcn triggers on any project with components.json, so on every v3 consumer it loads beside basalt-design',
    },
    verdict:
      unmatched.length === 0 && missingSurfaces.length === 0
        ? ('pass' as const)
        : ('refuted' as const),
  }
}
