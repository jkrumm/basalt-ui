/**
 * Spike 624 (docs/v3/concepts/guardrails.md section 13, S4 to S8). Throwaway harness, no tests.
 *
 *   S4  native oxlint directive edges: comment-start (I1), `-- reason` on block directives, a rule
 *       configured `off`, suppressed-count re-lint for `deepRender` files.
 *   S5  does `shadcn/no-arbitrary-values` flag `bg-(--vx-x)`.
 *   S6  `scanAllStrings` on a copy of the Console app: findings on plain class arrays, noise.
 *   S7  median wall time of the full SYNTHETIC preset (59 regex rules + bought rules) on one
 *       300-line TSX file, 1 warm-up and 11 timed runs.
 *   S8  Stop-only versus PostToolUse plus Stop. A lead cannot vary hooks for a subagent, so this is
 *       `not run`; the apparatus is s8.ts and its self-check is reported here.
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr. Every scratch copy lives in the OS temp dir. The preset is synthetic.
 */
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { HERE, lineOf, lint, median, ours, r1, ruleOf } from './lib'
import type { Diag } from './lib'
import { FORMS, configFor, pluginSource, writeSynthetic } from './preset'
import { selfCheck } from './s8'

const log = (m: string): void => void process.stderr.write(`[lint-edges] ${m}\n`)
const scratch = mkdtempSync(join(tmpdir(), 'lint-edges-'))
const link = (dir: string): void => {
  try {
    symlinkSync(join(HERE, 'node_modules'), join(dir, 'node_modules'))
  } catch {
    // already there
  }
}

type Verdict = 'PASS' | 'REFUTED' | 'not run'

const fired = (diags: Diag[], rule: string, line: number): boolean =>
  diags.some((d) => ruleOf(d) === rule && lineOf(d) === line)
const keyOf = (d: Diag): string =>
  `${d.filename}:${d.labels[0]?.span.offset}:${ruleOf(d)}:${d.message}`
const shadcn = (diags: Diag[]): Diag[] => diags.filter((d) => ruleOf(d).startsWith('shadcn/'))
const bump = (m: Record<string, number>, k: string): void => void (m[k] = (m[k] ?? 0) + 1)
const walkSources = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walkSources(join(d, e.name))
      : /\.(tsx?|jsx?)$/.test(e.name)
        ? [join(d, e.name)]
        : [],
  )
const version = (name: string): string =>
  (
    JSON.parse(readFileSync(join(HERE, 'node_modules', name, 'package.json'), 'utf8')) as {
      version: string
    }
  ).version

const s6Config = (scan: boolean): object => ({
  categories: { correctness: 'off' },
  jsPlugins: [join(HERE, 'node_modules/@shadcn/lint/dist/index.js'), './probe-plugin.js'],
  rules: {
    'shadcn/no-arbitrary-values': scan ? ['error', { scanAllStrings: true }] : 'error',
    'shadcn/no-raw-colors': scan ? ['error', { scanAllStrings: true }] : 'error',
    'shadcn/no-unknown-classes': 'error',
    'probe/string-site': scan ? 'error' : 'off',
  },
  // Zone V (vendored shadcn files, guardrails.md section 6) has the class rules off.
  overrides: [
    {
      files: ['**/components/ui/**'],
      rules: {
        'shadcn/no-arbitrary-values': 'off',
        'shadcn/no-raw-colors': 'off',
        'shadcn/no-unknown-classes': 'off',
      },
    },
  ],
  settings: { shadcn: { componentImports: ['^@/components/ui/'] } },
})

// ── S4: native directive edges ───────────────────────────────────────────────────────────────

const PROBE_PLUGIN = `const lit = (value, message) => ({ create(ctx) { return { Literal(n) { if (n.value === value) ctx.report({ node: n, message }) } } } })
export default {
  meta: { name: 'probe' },
  rules: {
    'no-foo': lit('foo', 'foo literal'),
    'no-bar': lit('bar', 'bar literal'),
    never: lit('zzz', 'zzz literal'),
    'waiver-needs-reason': { create(ctx) { return { Program() {
      for (const c of ctx.sourceCode.getAllComments()) {
        if (/^\\s*oxlint-disable/.test(c.value) && !/\\s--\\s+\\S/.test(c.value)) ctx.report({ loc: c.loc, message: 'directive without reason' })
      }
    } } } },
  },
}
`

const PROBE_CONFIG = {
  categories: { correctness: 'off' },
  jsPlugins: ['./probe-plugin.js'],
  rules: {
    'probe/no-foo': 'error',
    'probe/no-bar': 'error',
    'probe/never': 'off',
    'probe/waiver-needs-reason': 'error',
  },
}

// One line per case, so a finding's line number names the case. `L` = the line the finding would be on.
const S4_FIXTURE = [
  '// oxlint-disable-next-line probe/no-foo -- line reason', // 1
  "const lineReason = 'foo'", // 2
  '/* oxlint-disable-next-line probe/no-foo -- block next-line reason */', // 3
  "const blockNextLine = 'foo'", // 4
  '/* oxlint-disable probe/no-foo -- reason naming probe/no-bar */', // 5
  "const blockRegionFoo = 'foo'", // 6
  "const blockRegionBar = 'bar'", // 7
  '/* oxlint-enable probe/no-foo -- back on */', // 8
  "const afterEnable = 'foo'", // 9
  '// see oxlint-disable-next-line probe/no-foo', // 10
  "const lineMention = 'foo'", // 11
  '/* note: oxlint-disable-next-line probe/no-foo */', // 12
  "const blockMention = 'foo'", // 13
  "const trailing = 'foo' // oxlint-disable-line probe/no-foo -- trailing", // 14
  '// oxlint-disable-next-line probe/never -- rule configured off', // 15
  "const offRule = 'zzz'", // 16
  '// oxlint-disable-next-line probe/nonexistent -- unknown id', // 17
  'const unknownId = 1', // 18
  '// oxlint-disable-next-line probe/no-bar -- nothing to waive', // 19
  'const dead = 1', // 20
  '// oxlint-disable-next-line probe/no-foo', // 21 (no reason)
  "const noReason = 'foo'", // 22
].join('\n')

const S4_DEEP = [
  '/* oxlint-disable probe/no-foo -- canvas overlay, deepRender */',
  "export const a = 'foo'",
  "export const b = ['foo', 'foo']",
  "export const c = 'bar'",
  "export const d = `${'foo'}`",
].join('\n')

async function s4(): Promise<Record<string, unknown>> {
  const dir = join(scratch, 's4')
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'probe-plugin.js'), PROBE_PLUGIN)
  writeFileSync(join(dir, 'oxlintrc.json'), JSON.stringify(PROBE_CONFIG))
  writeFileSync(join(dir, 'src/edges.ts'), S4_FIXTURE)
  writeFileSync(join(dir, 'src/deep.ts'), S4_DEEP)
  link(dir)
  const run = (file: string, extra: string[] = []) =>
    lint({ cwd: dir, config: 'oxlintrc.json', targets: [file], args: extra })
  const withFlag = await run('src/edges.ts', ['--report-unused-disable-directives'])
  const plain = await run('src/edges.ts')
  const unusedAt = (line: number) =>
    withFlag.diags.some((d) => !d.code && /Unused/.test(d.message) && lineOf(d) === line)
  const foo = (line: number) => fired(plain.diags, 'probe/no-foo', line)

  // A block directive with `-- reason` suppresses its rule (lines 3-4, 5-6), the enable ends it
  // (9), and reason text naming another rule does not disable that rule (7).
  const blockNextLine = !foo(4)
  const blockRegion = !foo(6)
  const reasonTextNotTakenAsRuleId = fired(plain.diags, 'probe/no-bar', 7)
  const enableEnds = foo(9)
  const blockReasonParsed = blockNextLine && blockRegion && reasonTextNotTakenAsRuleId && enableEnds

  // deepRender: oxlint 1.93.0 has no switch to ignore inline directives, so blank the directive
  // (offsets and lines kept) and lint the copy; the findings that appear are what it suppressed.
  const help = Bun.spawnSync([join(HERE, 'node_modules/.bin/oxlint'), '--help']).stdout.toString()
  const noInlineFlag = /--no-inline-config|--ignore-directives/.test(help)
  const deep = readFileSync(join(dir, 'src/deep.ts'), 'utf8')
  writeFileSync(
    join(dir, 'src/deep-blanked.ts'),
    deep.replace(/\/\*[^]*?\*\//, (m) => ' '.repeat(m.length)),
  )
  const deepNormal = ours((await run('src/deep.ts')).diags).filter(
    (d) => ruleOf(d) === 'probe/no-foo',
  ).length
  const deepBlanked = ours((await run('src/deep-blanked.ts')).diags).filter(
    (d) => ruleOf(d) === 'probe/no-foo',
  ).length
  const deepBar = ours((await run('src/deep.ts')).diags).filter(
    (d) => ruleOf(d) === 'probe/no-bar',
  ).length

  const reasonRule = plain.diags
    .filter((d) => ruleOf(d) === 'probe/waiver-needs-reason')
    .map(lineOf)
  const result = {
    verdict: (blockReasonParsed ? 'PASS' : 'REFUTED') as Verdict,
    blockReasonParsed,
    blockNextLineWithReasonSuppresses: blockNextLine,
    blockRegionWithReasonSuppresses: blockRegion,
    reasonTextNotTakenAsRuleId,
    enableEndsRegion: enableEnds,
    lineReasonSuppresses: !foo(2),
    trailingLineDirectiveSuppresses: !foo(14),
    commentStart: { lineMentionDoesNotDisable: foo(11), blockMentionDoesNotDisable: foo(13) },
    ruleConfiguredOff: { directiveReportedUnused: unusedAt(15) },
    unknownId: { directiveReportedUnused: unusedAt(17) },
    deadDirectiveReportedUnused: unusedAt(19),
    unusedReportNeedsFlag: !plain.diags.some((d) => !d.code && /Unused/.test(d.message)),
    pluginReadsReason: {
      reportedLines: reasonRule,
      onlyTheDirectiveWithoutReason: reasonRule.length === 1 && reasonRule[0] === 21,
    },
    deepRender: {
      noIgnoreDirectivesFlag: !noInlineFlag,
      findingsWithDirective: deepNormal,
      suppressedCountByRelint: deepBlanked,
      expectedSuppressed: 4,
      otherRuleStillFires: deepBar === 1,
    },
  }
  log(`s4 blockReasonParsed=${blockReasonParsed}`)
  return result
}

// ── S5: no-arbitrary-values on the parenthesised variable form ───────────────────────────────

const S5_CLASSES = [
  'bg-(--vx-x)',
  'text-(--vx-x)',
  'w-(--vx-w)',
  'bg-[var(--vx-x)]',
  'bg-[#fff]',
  'p-[13px]',
  'bg-background p-4',
]

async function s5(): Promise<Record<string, unknown>> {
  const dir = join(scratch, 's5')
  writeSynthetic(dir)
  const body = S5_CLASSES.map((c, i) => `      <i key={${i}} className="${c}" />`).join('\n')
  writeFileSync(
    join(dir, 'src/probe.tsx'),
    `export const P = () => (\n  <div>\n${body}\n  </div>\n)\n`,
  )
  const config = {
    jsPlugins: ['@shadcn/lint'],
    rules: {
      'shadcn/no-arbitrary-values': 'error',
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-unknown-classes': 'error',
    },
  }
  writeFileSync(join(dir, 'oxlintrc.s5.json'), JSON.stringify(config))
  const { diags } = await lint({ cwd: dir, config: 'oxlintrc.s5.json', targets: ['src/probe.tsx'] })
  const flagged = (cls: string): string[] =>
    ours(diags)
      .filter((d) => d.message.startsWith(`"${cls}"`))
      .map(ruleOf)
  const byClass = Object.fromEntries(S5_CLASSES.map((c) => [c, flagged(c)]))
  const flaggedAny = (c: string): boolean => byClass[c]!.length > 0
  log(`s5 parenFormFlagged=${flaggedAny('bg-(--vx-x)')}`)
  return {
    verdict: `recorded (${flaggedAny('bg-(--vx-x)') ? 'flagged' : 'not flagged'})`,
    parenFormFlagged: flaggedAny('bg-(--vx-x)'),
    textParenFlagged: flaggedAny('text-(--vx-x)'),
    widthParenFlagged: flaggedAny('w-(--vx-w)'),
    bracketVarFlagged: flaggedAny('bg-[var(--vx-x)]'),
    bracketHexFlagged: flaggedAny('bg-[#fff]'),
    bracketLengthFlagged: flaggedAny('p-[13px]'),
    cleanFlagged: flaggedAny('bg-background p-4'),
    byClass,
  }
}

// ── S6: scanAllStrings on a console copy ─────────────────────────────────────────────────────

const S6_PROBE_PLUGIN = `export default {
  meta: { name: 'probe' },
  rules: { 'string-site': { create(ctx) {
    const site = (n, kind) => ctx.report({ node: n, message: JSON.stringify({ k: kind, p: n.parent?.type, g: n.parent?.parent?.type, c: n.parent?.callee?.name ?? n.parent?.callee?.property?.name ?? null, a: n.parent?.name?.name ?? null }) })
    return { Literal: (n) => typeof n.value === 'string' && site(n, 'L'), TemplateElement: (n) => site(n, 'T') }
  } } },
}
`

// Tailwind utility heads; a token is class-shaped when its base (variants and !/- stripped) starts with one.
const HEADS =
  /^(flex|inline|grid|block|hidden|contents|absolute|relative|fixed|sticky|static|p[xytblrse]?|m[xytblrse]?|gap|space|w|h|min|max|size|text|font|leading|tracking|bg|border|rounded|shadow|ring|outline|opacity|overflow|items|justify|self|place|content|col|row|order|z|top|bottom|left|right|inset|start|end|translate|rotate|scale|transition|duration|ease|delay|animate|cursor|select|pointer|truncate|whitespace|break|underline|line|uppercase|lowercase|capitalize|sr|not|grow|shrink|basis|divide|fill|stroke|object|aspect|columns|list|table|tabular|align|resize|appearance|accent|caret|decoration|antialiased|italic|isolate|group|peer|snap|scroll|touch|will|backdrop|blur|brightness|from|via|to|origin|visible|invisible|float|clear|box|sm|md|lg|xl)(-|$|\/)/

/** Operational definition of "a string that is a class": every whitespace token is class-shaped. */
function isClassShaped(text: string): boolean {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length || tokens.length > 60) return false
  return tokens.every((t) => {
    const base = t.replace(/^(?:[^:\s[\]()]+:|\[[^\]]*\]:)+/, '').replace(/^[!-]+/, '')
    return HEADS.test(base) || /^\*:|^\[&/.test(base)
  })
}

const S6_SEED = [
  "export const ARRAY = ['flex gap-[7px]', 'bg-[#123456]']", // 1
  "export const JOINED = ['p-[9px]', 'm-2'].join(' ')", // 2
  "export const MAP = { a: 'w-[420px]', b: 'text-sm' }", // 3
  'export const TPL = `h-[33px] ${ARRAY.length}`', // 4
  "export const NOT = ['/api/foo-bar/[id]', 'user-profile', 'en-US', 'row-[1]']", // 5
  "export const CALL = cn(['gap-[5px]'], 'flex')", // 6
  'declare function cn(...a: unknown[]): string', // 7
].join('\n')

const sha = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 8)

type Site = {
  start: number
  end: number
  k: string
  p: string
  g: string
  c: string | null
  a: string | null
}

async function s6(): Promise<Record<string, unknown>> {
  const consoleApp = join(homedir(), 'SourceRoot/software-factory/apps/console')
  if (!existsSync(join(consoleApp, 'src'))) {
    return {
      verdict: 'not run' as Verdict,
      reason: 'console checkout not found',
      arrayFindings: null,
      noisePct: null,
    }
  }
  const dir = join(scratch, 's6')
  mkdirSync(dir, { recursive: true })
  cpSync(join(consoleApp, 'src'), join(dir, 'src'), {
    recursive: true,
    filter: (p) => !p.endsWith('.gen.ts') && !p.includes('node_modules'),
  })
  cpSync(join(consoleApp, 'components.json'), join(dir, 'components.json'))
  symlinkSync(join(consoleApp, 'node_modules'), join(dir, 'node_modules'))
  writeFileSync(join(dir, 'src/__seed.tsx'), S6_SEED)
  writeFileSync(join(dir, 'probe-plugin.js'), S6_PROBE_PLUGIN)
  const files = walkSources(join(dir, 'src'))

  writeFileSync(join(dir, 'oxlintrc.off.json'), JSON.stringify(s6Config(false)))
  writeFileSync(join(dir, 'oxlintrc.on.json'), JSON.stringify(s6Config(true)))
  const off = await lint({ cwd: dir, config: 'oxlintrc.off.json', targets: ['src'] })
  const on = await lint({ cwd: dir, config: 'oxlintrc.on.json', targets: ['src'] })

  const sites = new Map<string, Site[]>()
  for (const d of on.diags.filter((x) => ruleOf(x) === 'probe/string-site')) {
    const span = d.labels[0]!.span
    const meta = JSON.parse(d.message) as Omit<Site, 'start' | 'end'>
    const list = sites.get(d.filename) ?? []
    list.push({ ...meta, start: span.offset, end: span.offset + span.length })
    sites.set(d.filename, list)
  }
  const offSet = new Set(shadcn(off.diags).map(keyOf))
  const onFindings = shadcn(on.diags)
  const added = onFindings.filter((d) => !offSet.has(keyOf(d)))

  const sources = new Map<string, Buffer>()
  const classify = (d: Diag) => {
    const offset = d.labels[0]!.span.offset
    const site = (sites.get(d.filename) ?? []).find((s) => offset >= s.start && offset < s.end)
    let buf = sources.get(d.filename)
    if (!buf) sources.set(d.filename, (buf = readFileSync(join(dir, d.filename))))
    const text = site ? buf.subarray(site.start, site.end).toString('utf8') : ''
    return { site, offset, class: !!site && isClassShaped(text.replace(/^[`'"]|[`'"]$/g, '')) }
  }
  const classified = added.map((d) => ({ d, ...classify(d) }))
  const noise = classified.filter((x) => !x.class)
  const arrayRows = classified.filter((x) => x.site?.p === 'ArrayExpression')
  const arrayClass = arrayRows.filter((x) => x.class)
  const noiseByParent: Record<string, number> = {}
  for (const x of noise) bump(noiseByParent, x.site ? `${x.site.p}` : 'unmatched')
  const classByParent: Record<string, number> = {}
  for (const x of classified) {
    if (x.class && !x.d.filename.endsWith('__seed.tsx'))
      bump(classByParent, x.site?.p ?? 'unmatched')
  }
  const byRule: Record<string, number> = {}
  for (const x of classified) if (!x.d.filename.endsWith('__seed.tsx')) bump(byRule, ruleOf(x.d))

  // Seeded shapes: findings per line of the seed file, scan off versus on.
  const seedLine = (diags: Diag[], line: number): number =>
    shadcn(diags).filter((d) => d.filename.endsWith('__seed.tsx') && lineOf(d) === line).length
  const seeded = Object.fromEntries(
    [
      ['array', 1],
      ['joined', 2],
      ['objectMap', 3],
      ['template', 4],
      ['nonClassStrings', 5],
      ['cnArrayArg', 6],
    ].map(([k, l]) => [
      k,
      { off: seedLine(off.diags, l as number), on: seedLine(on.diags, l as number) },
    ]),
  )
  const consoleOnly = (xs: typeof classified) =>
    xs.filter((x) => !x.d.filename.endsWith('__seed.tsx'))
  const realAdded = consoleOnly(classified)
  const realNoise = realAdded.filter((x) => !x.class)
  const realTotal = onFindings.filter((d) => !d.filename.endsWith('__seed.tsx')).length
  const noisePct = realTotal ? r1((realNoise.length / realTotal) * 100) : 0
  const noisePctOfAdded = realAdded.length ? r1((realNoise.length / realAdded.length) * 100) : 0
  const real = (xs: typeof classified) => consoleOnly(xs)
  const result = {
    verdict: (noisePct > 5 ? 'REFUTED' : 'PASS') as Verdict,
    files: files.length,
    findingsOff: shadcn(off.diags).filter((d) => !d.filename.endsWith('__seed.tsx')).length,
    findingsOn: realTotal,
    addedByScanAllStrings: realAdded.length,
    arrayFindings: real(arrayClass).length,
    arrayFindingsIncludingNonClass: real(arrayRows).length,
    noiseFindings: realNoise.length,
    noisePct,
    noisePctOfAdded,
    noiseByParent,
    classShapedByParent: classByParent,
    addedByRule: byRule,
    noiseSampleIds: realNoise.slice(0, 5).map((x) => sha(`${x.d.filename}:${x.offset}`)),
    seeded,
    classifier:
      'every whitespace token, variants and !/- stripped, starts with a Tailwind utility head',
  }
  log(`s6 added=${result.addedByScanAllStrings} noisePct=${noisePct}`)
  return result
}

// ── S7: wall time of the full synthetic preset ───────────────────────────────────────────────

/** A deterministic 300-line TSX file: ~25 components, a few offenders from different forms. */
function fixture300(): string {
  const offenders = [
    'md:gap-4',
    'mt-4',
    'shadow-card',
    'dark:bg-background',
    'p-[13px]',
    'overflow-auto',
  ]
  const lines = [
    "import type { ReactNode } from 'react'",
    "import { Button } from 'basalt-ui/ui/button'",
    "import { Card } from 'basalt-ui/ui/card'",
    '',
  ]
  for (let n = 0; lines.length < 292; n++) {
    const extra = n % 4 === 0 ? ` ${offenders[(n / 4) % offenders.length]}` : ''
    lines.push(
      `export function Panel${n}({ title, children }: { title: string; children: ReactNode }) {`,
      '  return (',
      `    <Card className="flex gap-2 text-sm text-muted${extra}">`,
      '      <header className="flex items-center justify-between">',
      '        <span className="text-base text-foreground">{title}</span>',
      `        <Button variant="ghost" size="sm" onClick={() => console.log(${n})}>Open</Button>`,
      '      </header>',
      '      <div className="flex flex-col gap-2">{children}</div>',
      '    </Card>',
      '  )',
      '}',
      '',
    )
  }
  while (lines.length < 300) lines.push('// padding')
  return `${lines.slice(0, 300).join('\n')}\n`
}

async function s7(): Promise<Record<string, unknown>> {
  const dir = join(scratch, 's7')
  writeSynthetic(dir)
  const file = 'src/panel.tsx'
  const text = fixture300()
  writeFileSync(join(dir, file), text)
  const levels = ['bare', 'basalt', 'shadcn', 'full'] as const
  const out: Record<string, unknown> = {}
  let fullMedian = 0
  let fullFindings = 0
  for (const level of levels) {
    const config = `oxlintrc.${level}.json`
    await lint({ cwd: dir, config, targets: [file] }) // warm-up, discarded
    const runs: number[] = []
    let n = 0
    for (let i = 0; i < 11; i++) {
      const r = await lint({ cwd: dir, config, targets: [file] })
      runs.push(r.ms)
      n = ours(r.diags).length
    }
    const med = median(runs)
    out[level] = {
      medianMs: r1(med),
      minMs: r1(Math.min(...runs)),
      maxMs: r1(Math.max(...runs)),
      findings: n,
    }
    if (level === 'full') {
      fullMedian = med
      fullFindings = n
    }
    log(`s7 ${level} median ${r1(med)} ms`)
  }
  return {
    verdict: (fullMedian > 1000 ? 'REFUTED' : 'PASS') as Verdict,
    wallMs: r1(fullMedian),
    findings: fullFindings,
    fileLines: text.split('\n').length - 1,
    basaltRules: FORMS.length,
    boughtRules: 6,
    pluginLines: pluginSource().split('\n').length - 1,
    runsPerLevel: 11,
    warmUps: 1,
    levels: out,
  }
}

// ── S8: not run ──────────────────────────────────────────────────────────────────────────────

async function s8(): Promise<Record<string, unknown>> {
  const check = await selfCheck(join(scratch, 's8'))
  return {
    verdict: 'not run' as Verdict,
    reason:
      'hooks are per session; a lead cannot vary them for a subagent, and headless `claude -p` is banned',
    stopOnlyFindingsKept: null,
    postPlusStopFindingsKept: null,
    apparatusSelfCheck: check,
    repro: [
      'for arm in stop-only post-plus-stop; for rep in 1 2 3:',
      'bun tools/spikes/lint-edges/s8.ts prepare /tmp/lint-edges-s8/<arm>-<rep> <arm>',
      'start an interactive Claude Code session in that dir as the implementer role (claude --agent implementer), paste BRIEF.md, let it finish and stop',
      'bun tools/spikes/lint-edges/s8.ts score /tmp/lint-edges-s8/<arm>-<rep>   # kept = seeded offenders still present, of 10',
      'mean kept over the 3 repeats per arm; REFUTED when post-plus-stop does not keep at least 2 fewer (mean) than stop-only',
    ],
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const r4 = (await s4()) as { verdict: Verdict }
  const r5 = await s5()
  const r6 = (await s6()) as { verdict: Verdict }
  const r7 = (await s7()) as { verdict: Verdict }
  const r8 = (await s8()) as { verdict: Verdict }
  const gated = [r4.verdict, r6.verdict, r7.verdict, r8.verdict]
  const verdict = gated.includes('REFUTED')
    ? 'refuted'
    : gated.every((v) => v === 'PASS')
      ? 'pass'
      : 'pending'
  process.stdout.write(
    `${JSON.stringify({
      verdict,
      s4: r4,
      s5: r5,
      s6: r6,
      s7: r7,
      s8: r8,
      inputs: {
        synthetic: true,
        oxlint: version('oxlint'),
        shadcnLint: version('@shadcn/lint'),
        tailwindcss: version('tailwindcss'),
        presetRules: Object.keys((configFor('full') as { rules: object }).rules).length,
      },
    })}\n`,
  )
}

try {
  await main()
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
