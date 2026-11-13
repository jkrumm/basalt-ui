/**
 * Preset smoke (guardrails section 13): a console-shaped temp project built from the committed
 * fixtures, linted by the real oxlint through the SHIPPED generated preset files. A wrong regex
 * silently matches nothing and an invalid option aborts or pauses a rule, so every form is proven to
 * fire here and not through the plugin directly.
 *
 * Per profile (`bridge`, `parts`, `app`) the project holds every fixture block as its own file; a
 * block that carries rule options or a filename gets a project of its own that extends the shipped
 * file and sets just that rule's options. The plugin is a bundle of the working tree installed as
 * `node_modules/basalt-ui/lint`, next to a byte copy of each shipped preset.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import plugin from '../packages/basalt-ui/src/lint'
import { tableOf } from '../packages/basalt-ui/src/lint/factory'
import { buildPreset } from '../packages/basalt-ui/src/lint/preset'
import type { Form, Profile } from '../packages/basalt-ui/src/lint/rule-table'
import { isEnabled, presetInput } from '../packages/basalt-ui/src/lint/rule-table'

const ROOT = resolve(import.meta.dir, '..')
const PKG = join(ROOT, 'packages/basalt-ui')
const OXLINT = join(ROOT, 'node_modules/.bin/oxlint')
const FIXTURES = join(PKG, 'test/fixtures/lint')
const RULES = tableOf(plugin)
const INPUT = presetInput(RULES)

const SHIPPED = ['bridge', 'parts', 'app'] as const
type Shipped = (typeof SHIPPED)[number]

/** The `tw-off-law` forms that exist from `parts` upward: silent at bridge, firing at parts. */
const PARTS_ONLY = ['surface-recipe', 'app-colour', 'app-colour-arbitrary', 'fixed-width']

// ── the fixture blocks ───────────────────────────────────────────────────────────────────────────

type Block = {
  ruleId: string
  form: Form
  kind: 'valid' | 'invalid'
  code: string
  options?: unknown[]
  filename?: string
  /** Class fixtures name their offending tokens in `// expect:` lines. */
  expects: string[]
}

const HEADER = /^\/\/ @(valid|invalid)(?: x\d+)?(?: (\{.*\}))?\s*$/
const DIRECTIVE = /^\/\/ @(filename|options|errors|ts)(?:\s+(.*))?$/

function blocksOf(ruleId: string, form: Form): Block[] {
  const text = readFileSync(join(FIXTURES, form.fixture), 'utf8')
  const expectsOf = (code: string): string[] =>
    [...code.matchAll(/^\/\/ expect: (.+)$/gm)].map((m) => m[1] as string)
  if (!text.split('\n').some((line) => HEADER.test(line))) {
    const valid = readFileSync(join(FIXTURES, form.fixture.replace(/\.tsx$/, '.valid.tsx')), 'utf8')
    return [
      { ruleId, form, kind: 'invalid', code: text, expects: expectsOf(text) },
      { ruleId, form, kind: 'valid', code: valid, expects: [] },
    ]
  }
  const blocks: Block[] = []
  let current: Block | undefined
  const lines: string[] = []
  const close = (): void => {
    if (current) blocks.push({ ...current, code: lines.join('\n').trim() + '\n' })
    lines.length = 0
  }
  for (const line of text.split('\n')) {
    const header = HEADER.exec(line)
    if (header) {
      close()
      current = {
        ruleId,
        form,
        kind: header[1] as Block['kind'],
        code: '',
        expects: [],
        ...(header[2] ? { options: [JSON.parse(header[2]) as unknown] } : {}),
      }
      continue
    }
    if (!current) continue
    const directive = DIRECTIVE.exec(line)
    if (!directive) lines.push(line)
    else if (directive[1] === 'filename') current.filename = (directive[2] ?? '').trim()
    else if (directive[1] === 'options') current.options = [JSON.parse(directive[2] ?? '{}')]
  }
  close()
  return blocks
}

const BLOCKS: Block[] = Object.entries(RULES).flatMap(([ruleId, entry]) =>
  entry.forms.flatMap((form) => blocksOf(ruleId, form)),
)

// ── the temp project ─────────────────────────────────────────────────────────────────────────────

let tmp: string

async function scaffold(dir: string): Promise<void> {
  const nm = join(dir, 'node_modules')
  mkdirSync(join(nm, 'basalt-ui/configs'), { recursive: true })
  mkdirSync(join(nm, '@shadcn'), { recursive: true })
  const build = await Bun.build({
    entrypoints: [join(PKG, 'src/lint/index.ts')],
    outdir: join(nm, 'basalt-ui'),
    target: 'node',
    format: 'esm',
    naming: 'lint.mjs',
  })
  if (!build.success) throw new Error(`plugin bundle failed: ${build.logs.join('\n')}`)
  writeFileSync(
    join(nm, 'basalt-ui/package.json'),
    JSON.stringify({ name: 'basalt-ui', type: 'module', exports: { './lint': './lint.mjs' } }),
  )
  for (const profile of SHIPPED) {
    copyFileSync(
      join(PKG, `configs/oxlint-${profile}.json`),
      join(nm, `basalt-ui/configs/oxlint-${profile}.json`),
    )
  }
  symlinkSync(join(PKG, 'node_modules/@shadcn/lint'), join(nm, '@shadcn/lint'))
  symlinkSync(join(PKG, 'node_modules/tailwindcss'), join(nm, 'tailwindcss'))
  // The theme the bought rules read: the package's sheet and token file, minus the font import.
  mkdirSync(join(dir, 'src'), { recursive: true })
  copyFileSync(join(PKG, 'src/css/tokens.css'), join(dir, 'src/tokens.css'))
  const sheet = readFileSync(join(PKG, 'src/css/tailwind.css'), 'utf8').replace(
    /^@import '\.\/fonts\.css';\n/m,
    '',
  )
  writeFileSync(join(dir, 'src/styles.css'), sheet.replace("'./tokens.css'", "'./tokens.css'"))
  // A console-shaped project: shadcn's `components.json`, the `@/` alias and its own `components/ui`.
  writeFileSync(
    join(dir, 'components.json'),
    JSON.stringify({
      tailwind: { css: 'src/styles.css' },
      aliases: { ui: '@/components/ui', utils: '@/lib/utils' },
    }),
  )
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }),
  )
  mkdirSync(join(dir, 'src/components/ui'), { recursive: true })
  writeFileSync(
    join(dir, 'src/components/ui/button.tsx'),
    'export function Button(props: { className?: string }) {\n  return <button className={props.className} />\n}\n',
  )
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'console-fixture', private: true }),
  )
}

type Diagnostic = { message: string; code: string; filename: string }

/** Lint `files` (relative to `cwd`) with the config in `cwd`; stderr must stay empty. */
function lint(cwd: string, files: string[] = ['src']): Diagnostic[] {
  const run = Bun.spawnSync([OXLINT, '--format=json', '-c', '.oxlintrc.json', ...files], { cwd })
  const stderr = run.stderr.toString()
  expect(stderr).toBe('')
  const out = JSON.parse(run.stdout.toString()) as { diagnostics: Diagnostic[] }
  return out.diagnostics
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

const extend = (profile: string): string =>
  `./node_modules/basalt-ui/configs/oxlint-${profile}.json`

const ownDiagnostics = (found: Diagnostic[], ruleId: string): Diagnostic[] =>
  found.filter((d) => d.code === `basalt(${ruleId})`)

/** A directive with no rule list: every rule is off in the file, whatever its own message says. */
const BLANKET_DISABLE = /oxlint-disable(?!-)\s*(?:--|\*\/|$)/m

const fixOf = (form: Form): string => form.fix.replace(/[.\s]+$/, '')

/** A block runs in the shared project unless it needs its own options or file path. */
const needsOwnProject = (block: Block): boolean =>
  block.options !== undefined || block.filename !== undefined

const runsAt = (block: Block, profile: Shipped): boolean =>
  INPUT.profiles[profile].includes(`basalt/${block.ruleId}`) &&
  !(profile === 'bridge' && block.ruleId === 'tw-off-law' && PARTS_ONLY.includes(block.form.id))

type Outcome = { block: Block; found: Diagnostic[] }
const outcomes: Record<Shipped, Outcome[]> = { bridge: [], parts: [], app: [] }

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'basalt-preset-smoke-'))
  await scaffold(tmp)
  for (const profile of SHIPPED) {
    const shared = join(tmp, profile)
    write(
      join(shared, '.oxlintrc.json'),
      JSON.stringify({ extends: [`../${extend(profile).slice(2)}`] }),
    )
    const placed = new Map<string, Block>()
    BLOCKS.forEach((block, index) => {
      if (needsOwnProject(block)) return
      const path = `src/cases/${block.ruleId}/${block.form.id}.${block.kind}.${index}.tsx`
      write(join(shared, path), block.code)
      placed.set(path, block)
    })
    const found = lint(shared)
    for (const [path, block] of placed) {
      outcomes[profile].push({ block, found: found.filter((d) => d.filename === path) })
    }
    // Blocks with their own options or file path: one project each, the shipped file extended.
    let n = 0
    for (const block of BLOCKS.filter(needsOwnProject)) {
      const dir = join(tmp, `${profile}-own-${n++}`)
      const override = block.options
        ? { rules: { [`basalt/${block.ruleId}`]: ['error', ...block.options] } }
        : {}
      write(
        join(dir, '.oxlintrc.json'),
        JSON.stringify({ extends: [`../${extend(profile).slice(2)}`], ...override }),
      )
      const path = block.filename ?? `src/cases/${block.ruleId}/${block.form.id}.tsx`
      write(join(dir, path), block.code)
      outcomes[profile].push({ block, found: lint(dir, [path]).filter((d) => d.filename === path) })
    }
  }
}, 120_000)

afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe('every form fires through the shipped preset', () => {
  const enabled = BLOCKS.filter((b) => b.kind === 'invalid' && isEnabled(b.form))
  it('has a fixture block for every enabled form', () => {
    const forms = Object.values(RULES).flatMap((entry) => entry.forms.filter(isEnabled))
    expect(forms.length).toBeGreaterThan(0)
    const covered = new Set(enabled.map((b) => b.form.fixture))
    expect(forms.filter((f) => !covered.has(f.fixture)).map((f) => f.fixture)).toEqual([])
  })

  for (const profile of SHIPPED) {
    it(`${profile}: each invalid fixture reports its form and names its fix`, () => {
      const missed: string[] = []
      for (const { block, found } of outcomes[profile]) {
        if (block.kind !== 'invalid' || !isEnabled(block.form) || !runsAt(block, profile)) continue
        // The host hides a finding under a blanket `/* oxlint-disable */`, the rule's own included:
        // oxlint behaviour, not a regex that matched nothing. `v3-gr-5` owns the weakened-config check.
        if (BLANKET_DISABLE.test(block.code)) continue
        const own = ownDiagnostics(found, block.ruleId)
        const label = `${block.ruleId}/${block.form.id}`
        // A block may report other forms of its rule (`@errors`); one must name this form's fix.
        const named = own.some((d) => d.message.includes(fixOf(block.form)))
        const subjects = block.expects.filter((s) => !own.some((d) => d.message.includes(s)))
        if (!named || subjects.length > 0) missed.push(`${label} (${own.length} found)`)
      }
      expect(missed).toEqual([])
    })
  }

  it('tw-off-law parts-only forms stay silent at bridge and fire at parts', () => {
    for (const id of PARTS_ONLY) {
      const form = RULES['tw-off-law']?.forms.find((f) => f.id === id)
      expect(form).toBeDefined()
      const at = (profile: Shipped): number =>
        outcomes[profile]
          .filter((o) => o.block.kind === 'invalid' && o.block.form.id === id)
          .reduce((sum, o) => sum + ownDiagnostics(o.found, 'tw-off-law').length, 0)
      expect([id, at('bridge')]).toEqual([id, 0])
      expect(at('parts')).toBeGreaterThan(0)
    }
  })
})

describe('every valid fixture lints clean at its profile', () => {
  for (const profile of SHIPPED) {
    it(`${profile}: a valid block is clean of its own rule`, () => {
      const dirty = outcomes[profile]
        .filter(({ block }) => block.kind === 'valid')
        .flatMap(({ block, found }) =>
          ownDiagnostics(found, block.ruleId).map(
            (d) => `${block.ruleId}/${block.form.id}: ${d.code} ${d.message}`,
          ),
        )
      expect(dirty).toEqual([])
    })
  }

  it('lints at least one valid block per profile', () => {
    for (const profile of SHIPPED) {
      expect(outcomes[profile].filter((o) => o.block.kind === 'valid').length).toBeGreaterThan(20)
    }
  })
})

describe('the bought rules fire through the preset', () => {
  const OFFENDERS: { rule: string; file: string; code: string }[] = [
    {
      rule: 'no-raw-colors',
      file: 'raw-colour',
      code: `export const a = <div className="bg-red-500" />`,
    },
    {
      rule: 'no-arbitrary-values',
      file: 'arbitrary',
      code: `export const a = <div className="p-[13px]" />`,
    },
    {
      rule: 'no-unknown-classes',
      file: 'unknown',
      code: `export const a = <div className="rounded-huge" />`,
    },
    {
      rule: 'no-inline-styles',
      file: 'inline',
      code: `export const a = <div style={{ color: 'red' }} />`,
    },
  ]
  const restyle = (spec: string): string =>
    `import { Button } from '${spec}'\nexport const a = <Button className="p-4" />`

  for (const profile of SHIPPED) {
    it(`${profile}: one offender per bought rule is reported`, () => {
      const dir = join(tmp, `bought-${profile}`)
      write(
        join(dir, '.oxlintrc.json'),
        JSON.stringify({ extends: [`../${extend(profile).slice(2)}`] }),
      )
      for (const o of OFFENDERS) write(join(dir, `src/${o.file}.tsx`), o.code)
      const spec = profile === 'bridge' ? '@/components/ui/button' : 'basalt-ui/ui/button'
      write(join(dir, 'src/restyle.tsx'), restyle(spec))
      write(
        join(dir, 'src/static.tsx'),
        `import { Button } from '${spec}'\nexport const a = (c: string) => <Button className={\`bg-\${c}\`} />`,
      )
      const found = lint(dir).map((d) => `${d.code}@${d.filename}`)
      for (const o of OFFENDERS) expect(found).toContain(`shadcn(${o.rule})@src/${o.file}.tsx`)
      expect(found).toContain('shadcn(no-restyle)@src/restyle.tsx')
      expect(found).toContain('shadcn(require-static-classes)@src/static.tsx')
    })
  }
})

describe('zones and roots', () => {
  const generated = (inputs: Parameters<typeof buildPreset>[0]): object | undefined =>
    buildPreset(inputs) as object | undefined
  const base = {
    table: RULES,
    pins: { oxlint: '1.93.0', shadcnLint: '0.2.5' },
    contracts: [],
    uiSlots: {},
  }

  const project = (name: string, config: object | undefined, files: Record<string, string>) => {
    const dir = join(tmp, name)
    write(join(dir, '.oxlintrc.json'), JSON.stringify(config))
    for (const [path, code] of Object.entries(files)) write(join(dir, path), code)
    return dir
  }
  const hits = (found: Diagnostic[], file: string, rule: string): number =>
    found.filter((d) => d.filename === file && d.code === rule).length

  it('a mixed-root manifest resolves a different profile per file', () => {
    const roots: Record<string, Profile | 'tokens'> = {
      'apps/desktop/src': 'app',
      'apps/gallery/src': 'parts',
      'apps/console/src': 'bridge',
      'apps/share/src': 'tokens',
    }
    const config = generated({ ...base, profile: 'bridge', roots: roots as never })
    const probe = `export const a = <div className="md:flex overflow-auto" />`
    const files = Object.fromEntries(Object.keys(roots).map((r) => [`${r}/probe.tsx`, probe]))
    const dir = project('mixed', config, files)
    const found = lint(dir, ['apps'])
    const at = (root: string, rule: string): number => hits(found, `${root}/probe.tsx`, rule)
    expect(at('apps/desktop/src', 'basalt(viewport-keyed)')).toBe(1)
    expect(at('apps/desktop/src', 'basalt(raw-scroll)')).toBe(1)
    expect(at('apps/gallery/src', 'basalt(raw-scroll)')).toBe(1)
    expect(at('apps/console/src', 'basalt(viewport-keyed)')).toBe(1)
    // raw-scroll is not a bridge id: the same file is silent in the bridge root.
    expect(at('apps/console/src', 'basalt(raw-scroll)')).toBe(0)
    // tokens: no oxlint rule runs at all.
    expect(found.filter((d) => d.filename.startsWith('apps/share/')).map((d) => d.code)).toEqual([])
  })

  it('zone E turns no-restyle off in an ejected file and keeps it on at the call site', () => {
    const config = generated({
      ...base,
      profile: 'parts',
      ejected: ['src/components/ui/card.tsx'],
      contracts: [],
    })
    const restyle = `import { Button } from 'basalt-ui/ui/button'\nexport const a = <Button className="p-4" />`
    const dir = project('zone-e', config, {
      'src/components/ui/card.tsx': restyle,
      'src/page.tsx': restyle,
    })
    const found = lint(dir, ['src/components', 'src/page.tsx'])
    expect(hits(found, 'src/components/ui/card.tsx', 'shadcn(no-restyle)')).toBe(0)
    expect(hits(found, 'src/page.tsx', 'shadcn(no-restyle)')).toBeGreaterThan(0)
  })

  it('zone V (vendored shadcn files) is off at bridge only', () => {
    const offender = `export const a = <div className="md:flex bg-red-500" />`
    for (const profile of ['bridge', 'parts'] as const) {
      const dir = join(tmp, `vendored-${profile}`)
      write(
        join(dir, '.oxlintrc.json'),
        JSON.stringify({ extends: [`../${extend(profile).slice(2)}`] }),
      )
      write(join(dir, 'src/components/ui/button.tsx'), offender)
      write(join(dir, 'src/page.tsx'), offender)
      const found = lint(dir)
      const inside = found.filter((d) => d.filename === 'src/components/ui/button.tsx')
      const outside = found.filter((d) => d.filename === 'src/page.tsx')
      expect(outside.map((d) => d.code)).toContain('basalt(viewport-keyed)')
      if (profile === 'bridge') expect(inside).toEqual([])
      else expect(inside.map((d) => d.code)).toContain('basalt(viewport-keyed)')
    }
  })
})
