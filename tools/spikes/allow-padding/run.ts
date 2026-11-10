/**
 * Spike 623 (docs/v3/concepts/guardrails.md sections 4 and 13; tokens-visual.md section 3).
 * Throwaway harness, no tests.
 *
 *   F5   would the type/weight/spacing allowlist force waivers? Denied sites across four consumer
 *        repos, a seeded sample judged by the owner's value-only rubric.
 *   F5P  the same for the padding form.
 *   S2   false positives per lint form (54 own matchers) against an AST/class-context oracle.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr; nothing from the employer repo (epos) is printed except counts.
 * Reads scratch copies in the OS temp dir only; never writes into a target repo.
 */
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractTokens, judge, parseClass, REASONS, RUBRIC, rubric } from './classes'
import type { Kind, Reason } from './classes'
import { buildCtx, FORMS, NOT_MEASURED } from './forms'
import { emit } from './mapping'
import { parse, REPOS, scanRepo, siteRef } from './scan'
import type { RepoName, ScannedRepo } from './scan'
import ts from 'typescript'

const SEED = 42
const SAMPLE = 100

interface Site {
  repo: RepoName
  file: string
  line: number
  col: number
  cls: string
  kind: Kind
  px: number | null
  need: boolean
  reason: Reason
}

interface FormHit {
  repo: RepoName
  file: string
  line: number
  col: number
  fp: boolean
}

const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}
const round = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d
const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0)

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSite(
  repo: RepoName,
  file: string,
  line: number,
  col: number,
  cls: string,
): { site: Site; denied: boolean } | null {
  const j = judge(parseClass(cls))
  if (!j) return null
  const r = rubric(j.kind, j.px)
  const site: Site = {
    repo,
    file,
    line,
    col,
    cls,
    kind: j.kind,
    px: j.px,
    need: r.need,
    reason: r.reason,
  }
  return { site, denied: j.kind === 'padding' ? true : j.denied }
}

function sample(pool: Site[], visibility: Map<RepoName, ScannedRepo>, tsxLines: number) {
  const sorted = [...pool].toSorted(
    (a, b) =>
      cmp(a.repo, b.repo) ||
      cmp(a.file, b.file) ||
      a.line - b.line ||
      a.col - b.col ||
      cmp(a.cls, b.cls),
  )
  const rng = mulberry32(SEED)
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = sorted[i] as Site
    sorted[i] = sorted[j] as Site
    sorted[j] = tmp
  }
  const picked = sorted.slice(0, SAMPLE)
  const need = picked.filter((s) => s.need).length
  const pct = picked.length === 0 ? 0 : round((need / picked.length) * 100, 1)
  const reasons = Object.fromEntries(
    REASONS.map((r) => [r, picked.filter((s) => s.reason === r).length]),
  )
  const offStep = picked.filter((s) => s.reason !== 'equals-allowed').length
  const byRepo = Object.fromEntries(
    REPOS.map((d) => {
      const inPool = pool.filter((s) => s.repo === d.name).length
      const inSample = picked.filter((s) => s.repo === d.name)
      return [
        d.name,
        {
          deniedTotal: inPool,
          sampled: inSample.length,
          genuineNeed: inSample.filter((s) => s.need).length,
        },
      ]
    }),
  )
  const sites = picked.flatMap((s) => {
    const vis = visibility.get(s.repo)?.visibility ?? 'private'
    const ref = siteRef(s.repo, vis, s.file, s.line)
    if (!ref) return []
    return [
      {
        repo: s.repo,
        ...ref,
        class: s.cls,
        px: s.px,
        verdict: s.need ? 'need' : 'no need',
        reason: s.reason,
      },
    ]
  })
  const waivers = round(((pct / 100) * pool.length * 300) / tsxLines, 2)
  return {
    deniedTotal: pool.length,
    sampled: picked.length,
    genuineNeed: need,
    genuineNeedPct: pct,
    waiversPer300Lines: waivers,
    offStepPct: picked.length === 0 ? 0 : round((offStep / picked.length) * 100, 1),
    reasons,
    byRepo,
    sites,
  }
}

function main(): void {
  const tmpRoot = join(tmpdir(), `allow-padding-spike-${process.pid}`)
  try {
    const scanned: ScannedRepo[] = []
    for (const def of REPOS) {
      const r = scanRepo(def, tmpRoot)
      scanned.push(r)
      log(`[${def.name}] ${r.files.length} files, ${r.tsxFiles} tsx, ${r.tsxLines} tsx lines`)
    }
    const byName = new Map(scanned.map((s) => [s.def.name, s]))
    const f5Pool: Site[] = []
    const f5pPool: Site[] = []
    const formHits = new Map<string, FormHit[]>(FORMS.map((f) => [f.id, []]))

    for (const repo of scanned) {
      const name = repo.def.name
      const keep = (s: { site: Site; denied: boolean } | null): void => {
        if (!s?.denied) return
        ;(s.site.kind === 'padding' ? f5pPool : f5Pool).push(s.site)
      }
      for (const file of repo.files) {
        const sf = parse(file)
        const tokens = extractTokens(sf)
        for (const t of tokens) keep(makeSite(name, file.rel, t.line, t.col, t.text))
        if (repo.def.kind === 'mantine') {
          const visit = (n: ts.Node): void => {
            if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
              for (const e of emit(n)) {
                const p = sf.getLineAndCharacterOfPosition(e.node.getStart(sf))
                keep(makeSite(name, file.rel, p.line + 1, p.character + 1, e.cls))
              }
            }
            ts.forEachChild(n, visit)
          }
          visit(sf)
        }
        const ctx = buildCtx(sf, tokens)
        for (const form of FORMS) {
          for (const h of form.detect(ctx)) {
            formHits.get(form.id)?.push({
              repo: name,
              file: file.rel,
              line: h.line,
              col: h.col,
              fp: form.isFalsePositive(h),
            })
          }
        }
      }
      log(`[${name}] done`)
    }

    const tsxLines = scanned.reduce((n, s) => n + s.tsxLines, 0)
    const f5 = sample(f5Pool, byName, tsxLines)
    const f5p = sample(f5pPool, byName, tsxLines)
    const f5Verdict = f5.genuineNeedPct > 15 || f5.waiversPer300Lines > 1 ? 'REFUTED' : 'PASS'
    const f5pVerdict = f5p.genuineNeedPct > 15 || f5p.waiversPer300Lines > 1 ? 'REFUTED' : 'PASS'

    const forms: Record<string, unknown> = {}
    const byForm: Record<string, number | null> = {}
    const noHitForms: string[] = []
    const overTenPct: string[] = []
    for (const form of FORMS) {
      const hits = [...(formHits.get(form.id) ?? [])].toSorted(
        (a, b) => cmp(a.repo, b.repo) || cmp(a.file, b.file) || a.line - b.line || a.col - b.col,
      )
      const fps = hits.filter((h) => h.fp)
      const pct = hits.length === 0 ? null : round((fps.length / hits.length) * 100, 1)
      byForm[form.id] = pct
      if (pct === null) noHitForms.push(form.id)
      else if (pct > 10) overTenPct.push(form.id)
      const listed = (list: FormHit[], cap: number) =>
        list
          .filter((h) => h.repo !== 'epos')
          .slice(0, cap)
          .map((h) => {
            const ref = siteRef(h.repo, byName.get(h.repo)?.visibility ?? 'private', h.file, h.line)
            return { repo: h.repo, ...ref, falsePositive: h.fp }
          })
      forms[form.id] = {
        hits: hits.length,
        falsePositives: fps.length,
        pct,
        oracle: form.oracle,
        byRepo: Object.fromEntries(
          REPOS.map((d) => {
            const mine = hits.filter((h) => h.repo === d.name)
            return [d.name, { hits: mine.length, falsePositives: mine.filter((h) => h.fp).length }]
          }),
        ),
        sites: [
          ...listed(fps, 15),
          ...listed(
            hits.filter((h) => !h.fp),
            5,
          ),
        ],
      }
    }
    const s2Verdict = overTenPct.length > 0 ? 'REFUTED' : 'PASS'

    const out = {
      spike: 'allow-padding (623)',
      seed: SEED,
      assumptions: [
        'weight-body/medium/strong = 400/500/600 (font-normal/medium/semibold); other weights denied.',
        'Mantine emit is applied to ALL candidate sites (denial depends on the emitted class); the sample is drawn from the denied ones.',
        'Arbitrary text sizes: [Nem] = N*16 px; %, vh, vw, calc/clamp/min/max and other [length:..] are unclear (px null, counts as need); colours, var(..) and [length:var(..)] text-[..] (token references) are ignored.',
        'Spacing: fractions (w-1/2) and any spacing class with a /modifier are outside the namespace; keyword values are outside; arbitrary [..] and (--x) are denied, including on max-w/max-h.',
        'F5P counts every padding class token with a numeric, px, arbitrary or (--x) value as a padding-form site, allowed steps included; the rubric then judges its px.',
        'Negative spacing is judged on its magnitude.',
        'offStepPct = share of sampled sites whose reason is not equals-allowed.',
        'Mantine candidate props apply to every JSX element; Mantine string values without a unit are read as px.',
        'S2 runs on source text only (Mantine emitted classes are not part of S2); hex-like strings such as "#add" count as colour literals unless a stated FP predicate applies.',
        `Measured forms: ${FORMS.length} of the 59 the concept books (${NOT_MEASURED.length} not measurable standalone).`,
      ],
      rubric: RUBRIC,
      repos: Object.fromEntries(
        scanned.map((s) => [
          s.def.name,
          s.head === null
            ? { visibility: s.visibility }
            : { visibility: s.visibility, head: s.head },
        ]),
      ),
      scanned: Object.fromEntries(
        scanned.map((s) => [
          s.def.name,
          { files: s.files.length, tsxFiles: s.tsxFiles, tsxLines: s.tsxLines },
        ]),
      ),
      f5,
      f5p,
      s2: {
        measuredForms: FORMS.length,
        bookedForms: 59,
        notMeasured: NOT_MEASURED,
        byForm,
        noHitForms: noHitForms.toSorted(),
        overTenPct: overTenPct.toSorted(),
        verdict: s2Verdict,
        forms,
      },
      verdict: {
        f5: f5Verdict,
        f5p: f5pVerdict,
        s2: s2Verdict,
        overall: [f5Verdict, f5pVerdict, s2Verdict].every((v) => v === 'PASS') ? 'PASS' : 'REFUTED',
      },
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}

main()
