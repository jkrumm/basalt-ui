/**
 * Turns the measurements (scripts/measure.ts) into the Astro matrix and keeps it honest.
 *
 *   bun scripts/matrix.ts                judge the fresh results against docs/v3/verdicts/astro-matrix.json: exit 1
 *                                        when a part that was static-clean is not, a page's JavaScript or CSS is past
 *                                        its budget, or a page without an island loads any script
 *   bun scripts/matrix.ts --update [--reason <why>]
 *                                        write the record: new parts, flipped verdicts, and every budget the run
 *                                        exceeds raised to the measured size plus BYTE_SLACK (a raise needs --reason)
 *   bun scripts/matrix.ts --render       render astro-matrix.md from the JSON (no results needed)
 *   bun scripts/matrix.ts --check-render exit 1 when astro-matrix.md is not the JSON's rendering
 *
 * The record holds what is judged: each part's verdicts and its byte budgets, never a measured size. A size inside its
 * budget does not touch the record, so two branches that change the package rebase over each other with no re-record.
 * Every run writes the whole measured table to .astro-matrix/matrix.md beside the results (CI keeps it as an
 * artifact). The .md beside the record is rendered from the JSON alone, never written by hand.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { FINDINGS, UNCOVERED_WHY } from '../src/parts/findings'
import type { Finding } from '../src/parts/findings'
import { MODES, PARTS } from '../src/parts/registry'
import type { Interaction, Mode, PartEntry } from '../src/parts/registry'
import { VIEWS } from './results'
import type { ModeResult, PartResult, Results, View } from './results'

/**
 * Changed pixels a view may have and still count as the same picture. The static page and its client:only page
 * render in the same browser on the same machine, so a matching picture differs by no pixel, except for a rare
 * one-pixel flake (form-layout, 2026-11-20: 1 px at 1440 light in one run of four, 0 in the other three). The
 * smallest real difference recorded is 28 px (segmented's indicator edge at 390 light); 4 px sits between the two.
 */
export const PIXEL_TOLERANCE = 4
/**
 * The headroom a budget is set with: the measured gzip size plus one KiB, an order below the smallest further-island
 * cost measured (Button, 9.5 KiB), so a part that grows fails while a few bytes of hash or banner drift do not.
 */
export const BYTE_SLACK = 1024

export type ModeVerdict = Pick<
  ModeResult,
  'js' | 'css' | 'cls' | 'lcp' | 'hydrated' | 'hydrationErrors'
> & {
  further: number
  errors: number
  error: string
}

export type ViewVerdict = {
  changed: number
  ratio: number
  sameSize: boolean
  static: [number, number]
  only: [number, number]
}

export type Verdict = {
  id: string
  family: string
  covers: readonly string[]
  interaction: Interaction
  ssr: PartResult['ssr']
  ssrError: string
  /** The static HTML renders and matches the client:only render at every view, pixel and text. */
  staticClean: boolean
  views: Record<View, ViewVerdict>
  modes: Record<Mode, ModeVerdict>
  best: Mode | 'none'
  why: string
  chart: boolean
}

/** One run, judged: every measured number. It is the artifact's table, never committed. */
export type Run = {
  browser: string
  runtime: { js: number; css: number }
  parts: Verdict[]
  families: { family: string; parts: number; js: Record<Mode, number>; css: number; cls: number }[]
  /** Pages without an island and the script bytes and tags they carried (0 and 0 is the claim). */
  zeroJs: { pages: number; js: number; scriptTags: number }
  uncovered: string[]
  /** Font files a page asked for and did not get. */
  missingFonts: number
}

const isFont404 = (e: string): boolean => / 404 /.test(e)

function modeOf(m: ModeResult & { further: number }): ModeVerdict {
  const real = m.errors.filter((e) => !isFont404(e))
  return {
    js: m.js,
    css: m.css,
    cls: m.cls,
    lcp: m.lcp,
    hydrated: m.hydrated,
    hydrationErrors: m.hydrationErrors,
    further: m.further,
    errors: real.length,
    error: real[0] ?? '',
  }
}

const kb = (n: number): string => (n === 0 ? '0' : `${(n / 1024).toFixed(1)} kB`)

/** The view that differs most, named without its counts: what the record says, so a rerun does not rewrite it. */
function worstView(views: Record<View, ViewVerdict>): string {
  const [view, p] = Object.entries(views).toSorted((a, b) => b[1].changed - a[1].changed)[0]!
  return p.sameSize ? `most at ${view}` : `its size at ${view}`
}

function worst(views: Record<View, ViewVerdict>): string {
  const [view, p] = Object.entries(views).toSorted((a, b) => b[1].changed - a[1].changed)[0]!
  return p.sameSize
    ? `${p.changed} px (${(p.ratio * 100).toFixed(1)}%) at ${view}`
    : `size ${p.static.join('x')} vs ${p.only.join('x')} at ${view}`
}

type Judged = Omit<Verdict, 'best' | 'why'>

/** The best directive for a part and why, from what it needs JavaScript for and what the measurements show. */
export function decide(
  part: Pick<PartEntry, 'interaction' | 'why'>,
  v: Judged,
  further: string = kb(v.modes.load.further),
  differs: string = worst(v.views),
): { best: Verdict['best']; why: string } {
  const load = v.modes.load
  if (v.ssr === 'fail') {
    const only = v.modes.only
    if (!only.hydrated || only.errors > 0)
      return {
        best: 'none',
        why: `fails on the server (${v.ssrError}) and in the browser (${only.error || 'never renders'})`,
      }
    return {
      best: 'only',
      why: `fails on the server (${v.ssrError}); client:only is the one mode that renders, with no static picture`,
    }
  }
  if (!load.hydrated || load.errors > 0)
    return {
      best: 'static',
      why: `renders on the server but its island fails in the browser (${load.error || 'never hydrates'}); only the static picture works`,
    }
  const wrong = v.staticClean
    ? ''
    : ` The static picture differs from the hydrated one until it hydrates (${differs}).`
  if (part.interaction === 'none') {
    return v.staticClean
      ? {
          best: 'static',
          why: `The static HTML is the whole part, 0 bytes of JavaScript: ${part.why}.`,
        }
      : {
          best: 'visible',
          why: `Should need no JavaScript (${part.why}).${wrong} client:visible repairs it for ${further} until the fix lands.`,
        }
  }
  if (part.interaction === 'enhance')
    return {
      best: 'visible',
      why: `Static picture first, the island adds behaviour: ${part.why}. client:visible, ${further} further (client:idle above the fold).${wrong}`,
    }
  return {
    best: 'visible',
    why: `Needs the island to work: ${part.why}. client:idle above the fold, client:visible below, ${further} further.${wrong}`,
  }
}

/** Every exported component of the package: the PascalCase names of the export-surface shards, constants excluded. */
async function exportedParts(shards: string): Promise<string[]> {
  const out = new Set<string>()
  for (const f of (await readdir(shards)).sort()) {
    const names = JSON.parse(await readFile(join(shards, f), 'utf8')) as string[]
    for (const n of names) if (/^[A-Z][a-z]/.test(n)) out.add(n)
  }
  return [...out].sort()
}

export function judge(
  results: Results,
  parts: readonly PartEntry[],
  exported: readonly string[],
): Run {
  const byId = new Map(results.parts.map((p) => [p.id, p]))
  const verdicts: Verdict[] = []
  for (const part of parts) {
    const r = byId.get(part.id)
    if (!r) continue
    const views = Object.fromEntries(
      VIEWS.map((view) => {
        const p = r.views[view]
        const sameSize = p.static[0] === p.only[0] && p.static[1] === p.only[1]
        return [
          view,
          { changed: p.changed, ratio: p.ratio, sameSize, static: p.static, only: p.only },
        ]
      }),
    ) as Record<View, ViewVerdict>
    const staticClean =
      r.ssr === 'ok' &&
      r.textMatch &&
      VIEWS.every((view) => views[view].sameSize && views[view].changed <= PIXEL_TOLERANCE)
    const modes = Object.fromEntries(MODES.map((m) => [m, modeOf(r.modes[m])])) as Record<
      Mode,
      ModeVerdict
    >
    const base: Judged = {
      id: part.id,
      family: part.family,
      covers: part.covers,
      interaction: part.interaction,
      ssr: r.ssr,
      ssrError: r.ssrError,
      staticClean,
      views,
      modes,
      chart: part.chart === true,
    }
    verdicts.push({ ...base, ...decide(part, base) })
  }
  const covered = new Set(parts.flatMap((p) => p.covers))
  const noIsland = [
    ...results.parts.map((p) => p.modes.static),
    ...results.families.map((f) => f.modes.static),
    results.index,
    results.baseline.static,
  ]
  const every = [
    ...results.parts.flatMap((p) => MODES.map((m) => p.modes[m])),
    ...results.families.flatMap((f) => MODES.map((m) => f.modes[m])),
    results.index,
  ]
  return {
    browser: results.browser,
    runtime: { js: results.baseline.load.js, css: results.baseline.load.css },
    parts: verdicts,
    families: results.families.map((f) => ({
      family: f.family,
      parts: f.parts,
      js: Object.fromEntries(MODES.map((m) => [m, f.modes[m].js])) as Record<Mode, number>,
      css: f.modes.load.css,
      cls: f.modes.load.cls,
    })),
    zeroJs: {
      pages: noIsland.length,
      js: noIsland.reduce((a, m) => a + m.js, 0),
      scriptTags: noIsland.reduce((a, m) => a + m.htmlScriptTags + m.scriptTags, 0),
    },
    uncovered: exported.filter((n) => !covered.has(n)),
    missingFonts: Math.max(0, ...every.map((m) => m.errors.filter(isFont404).length)),
  }
}

/** A part's byte ceilings, gzip: its page's JavaScript and the further-island share of it in any hydrating mode, and its CSS. */
export type Budget = { js: number; further: number; css: number }

/** What is judged of one part: its verdicts and its budgets. A measured size is never recorded. */
export type PartRecord = {
  id: string
  family: string
  covers: readonly string[]
  interaction: Interaction
  chart: boolean
  ssr: PartResult['ssr']
  staticClean: boolean
  /** A chart kind's static picture: correct, correct at the declared width only, or wrong. */
  picture?: string
  best: Mode | 'none'
  why: string
  budget: Budget
  /** Why a budget was last raised past the size it was set at. */
  raised?: string
}

export type FamilyRecord = {
  family: string
  parts: number
  /** Gzip JavaScript ceiling of the family page in each mode. */
  js: Record<Mode, number>
  raised?: string
}

/** docs/v3/verdicts/astro-matrix.json: the verdicts and budgets a run is checked against. */
export type MatrixRecord = {
  browser: string
  /** The headroom each budget was set with over the size measured then. */
  slack: number
  /** The island runtime (React, react-dom, the Astro island script): the baseline island's page. */
  runtime: { js: number; raised?: string }
  parts: PartRecord[]
  families: FamilyRecord[]
}

const HYDRATING: readonly Mode[] = MODES.filter((m) => m !== 'static')

/** The sizes a part's budget bounds, from one run. */
export function sizes(v: Verdict): Budget {
  return {
    js: Math.max(...HYDRATING.map((m) => v.modes[m].js)),
    further: Math.max(...HYDRATING.map((m) => v.modes[m].further)),
    css: Math.max(...MODES.map((m) => v.modes[m].css)),
  }
}

export function chartVerdict(v: Pick<Verdict, 'ssr' | 'staticClean' | 'views'>): string {
  if (v.ssr !== 'ok') return `no: ${v.ssr} on the server`
  if (v.staticClean) return 'correct'
  const at = v.views['1440-light']
  return at.sameSize && at.changed <= PIXEL_TOLERANCE
    ? 'correct at the declared width only'
    : 'wrong'
}

const BUDGET_KEYS = ['js', 'further', 'css'] as const

const BUDGET_NAME: Record<keyof Budget, string> = {
  js: 'JavaScript',
  further: 'further-island JavaScript',
  css: 'CSS',
}

/**
 * The record after a run: every measured part with its verdicts, its budgets kept while the run fits them, a budget
 * the run exceeds raised to the measured size plus `BYTE_SLACK`. A budget is never lowered: an improvement leaves the
 * record alone, which is what lets branches rebase over each other. `raised` lists each raise of an existing budget;
 * the caller refuses one without a reason. A partial run (`only`) keeps the parts and families it did not measure.
 */
export function toRecord(
  run: Run,
  previous: MatrixRecord | null,
  opts: { parts: readonly PartEntry[]; reason?: string },
): { record: MatrixRecord; raised: string[] } {
  const raised: string[] = []
  const was = new Map(previous?.parts.map((p) => [p.id, p]) ?? [])
  const measured = new Map(run.parts.map((p) => [p.id, p]))
  const partial = previous !== null && run.parts.length < opts.parts.length
  const parts: PartRecord[] = []
  for (const entry of opts.parts) {
    const v = measured.get(entry.id)
    const prev = was.get(entry.id)
    if (!v) {
      if (partial && prev) parts.push(prev)
      continue
    }
    const size = sizes(v)
    let bumped = false
    const budget = {} as Budget
    for (const key of BUDGET_KEYS) {
      const kept = prev?.budget[key]
      if (kept !== undefined && size[key] <= kept) {
        budget[key] = kept
        continue
      }
      budget[key] = size[key] + BYTE_SLACK
      if (kept === undefined) continue
      bumped = true
      raised.push(`${entry.id} ${BUDGET_NAME[key]}: ${kept} B to ${budget[key]} B`)
    }
    const reason = bumped ? opts.reason : prev?.raised
    parts.push({
      id: v.id,
      family: v.family,
      covers: v.covers,
      interaction: v.interaction,
      chart: v.chart,
      ssr: v.ssr,
      staticClean: v.staticClean,
      ...(v.chart ? { picture: chartVerdict(v) } : {}),
      ...decide(entry, v, `up to ${kb(budget.further)}`, worstView(v.views)),
      budget,
      ...(reason ? { raised: reason } : {}),
    })
  }
  const fams = new Map(run.families.map((f) => [f.family, f]))
  const families: FamilyRecord[] = []
  const order = [...new Set([...(previous?.families.map((f) => f.family) ?? []), ...fams.keys()])]
  for (const name of order) {
    const f = fams.get(name)
    const prev = previous?.families.find((p) => p.family === name)
    if (!f) {
      if (partial && prev) families.push(prev)
      continue
    }
    let bumped = false
    const js = {} as Record<Mode, number>
    for (const m of MODES) {
      const kept = prev?.js[m]
      if (kept !== undefined && f.js[m] <= kept) {
        js[m] = kept
        continue
      }
      js[m] = f.js[m] === 0 ? 0 : f.js[m] + BYTE_SLACK
      if (kept === undefined) continue
      bumped = true
      raised.push(`family ${name} ${LABEL[m]}: ${kept} B to ${js[m]} B`)
    }
    const reason = bumped ? opts.reason : prev?.raised
    families.push({ family: name, parts: f.parts, js, ...(reason ? { raised: reason } : {}) })
  }
  const keptRuntime = previous?.runtime.js
  let runtime: MatrixRecord['runtime']
  if (keptRuntime !== undefined && run.runtime.js <= keptRuntime) runtime = previous!.runtime
  else {
    runtime = { js: run.runtime.js + BYTE_SLACK }
    if (keptRuntime !== undefined) {
      raised.push(`the island runtime: ${keptRuntime} B to ${runtime.js} B`)
      if (opts.reason) runtime.raised = opts.reason
    }
  }
  return { record: { browser: run.browser, slack: BYTE_SLACK, runtime, parts, families }, raised }
}

const RAISE = 'raise it on purpose: make astro-matrix-run ASTRO_PARTS=<id> UPDATE=1 REASON="<why>"'

/**
 * What the fresh run does worse than the record allows: `failures` fail the check, `notes` only report. `partial`
 * (a `--parts` run, `make astro-matrix-fast`) checks the parts and families it measured and leaves the rest to CI.
 */
export function compare(
  recorded: MatrixRecord,
  fresh: Run,
  partial = false,
): { failures: string[]; notes: string[] } {
  const failures: string[] = []
  const notes: string[] = []
  const now = new Map(fresh.parts.map((p) => [p.id, p]))
  for (const was of recorded.parts) {
    const is = now.get(was.id)
    if (!is && partial) continue
    if (!is) {
      failures.push(
        `${was.id}: recorded but not measured (removed from the registry? record it with UPDATE=1)`,
      )
      continue
    }
    if (was.staticClean && !is.staticClean)
      failures.push(
        `${was.id}: was static-clean, now ${is.ssr === 'ok' ? worst(is.views) : `ssr ${is.ssr}: ${is.ssrError}`}`,
      )
    if (!was.staticClean && is.staticClean)
      notes.push(`${was.id}: now static-clean; record it with UPDATE=1`)
    if (was.best !== is.best)
      notes.push(
        `${was.id}: best is now ${is.best}, the record says ${was.best}; record it with UPDATE=1`,
      )
    const size = sizes(is)
    for (const key of BUDGET_KEYS)
      if (size[key] > was.budget[key])
        failures.push(
          `${was.id}: ${BUDGET_NAME[key]} ${size[key]} B gzip, budget ${was.budget[key]} B; ${RAISE}`,
        )
  }
  for (const p of fresh.parts)
    if (!recorded.parts.some((r) => r.id === p.id))
      notes.push(`${p.id}: new part with no budget; record it with UPDATE=1`)
  const families = new Map(fresh.families.map((f) => [f.family, f]))
  for (const was of recorded.families) {
    const is = families.get(was.family)
    if (!is) continue
    for (const m of MODES)
      if (is.js[m] > was.js[m])
        failures.push(
          `family ${was.family} ${m}: JavaScript ${is.js[m]} B gzip, budget ${was.js[m]} B; ${RAISE}`,
        )
  }
  if (fresh.zeroJs.js > 0 || fresh.zeroJs.scriptTags > 0)
    failures.push(
      `a page without an island loaded ${fresh.zeroJs.js} B of JavaScript from ${fresh.zeroJs.scriptTags} script tags`,
    )
  if (fresh.runtime.js > recorded.runtime.js)
    failures.push(
      `the island runtime is ${fresh.runtime.js} B gzip, budget ${recorded.runtime.js} B; ${RAISE}`,
    )
  return { failures, notes }
}

const LABEL: Record<Mode, string> = {
  static: 'no directive',
  visible: 'client:visible',
  idle: 'client:idle',
  load: 'client:load',
  only: 'client:only',
}

function cellOf(v: Verdict, m: Mode): string {
  const r = v.modes[m]
  if (m === 'static') {
    if (v.ssr === 'fail') return 'fails'
    return (
      (v.staticClean ? 'clean' : 'differs') + (v.ssr === 'partial' ? ' (part left to client)' : '')
    )
  }
  if (m !== 'only' && v.ssr === 'fail') return 'build fails'
  if (!r.hydrated) return 'no hydrate'
  if (r.errors > 0) return 'error'
  const flags = [
    r.hydrationErrors ? `${r.hydrationErrors} hydration` : '',
    r.cls > 0 ? `CLS ${r.cls}` : '',
  ].filter(Boolean)
  return kb(r.js) + (flags.length ? ' · ' + flags.join(' · ') : '')
}

const esc = (s: string): string => s.replaceAll('|', '\\|').replaceAll('\n', ' ')
const code = (s: string): string => '`' + s + '`'

/** The measured table of one run: `.astro-matrix/matrix.md`, kept by CI as an artifact. */
export function renderRun(rec: Run, findings: readonly Finding[]): string {
  const clean = rec.parts.filter((p) => p.staticClean).length
  const out: string[] = [
    '# Astro matrix: the measured run',
    '',
    '<!-- written by apps/playground-astro/scripts/matrix.ts from results.json on every run; never committed -->',
    '',
    `Every basalt-ui part rendered by ${code('apps/playground-astro')} (Astro 7, @astrojs/react, Tailwind 4, the package's built dist) in each render mode and measured in a real browser (${rec.browser}). How to run it and how a change is checked against it: ${code('docs/validation.md')} § Astro matrix.`,
    '',
    '## Summary',
    '',
    `- **${rec.parts.length} parts** measured, **${clean}** static-clean: the HTML Astro writes with no directive matches the client:only render word for word and to within ${PIXEL_TOLERANCE} pixels (a measured flake) at 1440 and 390 px, light and dark.`,
    `- **Zero JavaScript without an island:** ${rec.zeroJs.pages} pages carry no island; together they loaded ${rec.zeroJs.js} bytes of script from ${rec.zeroJs.scriptTags} script tags.`,
    `- **The first React island** costs ${kb(rec.runtime.js)} of gzip JavaScript before any basalt code: React, react-dom and the Astro island runtime (the baseline island). Each further island costs what its part adds, the "further" column.`,
    `- **CSS** is one sheet per page, ${kb(rec.runtime.css)} gzip, with the whole basalt dist scanned by Tailwind.`,
  ]
  if (rec.missingFonts)
    out.push(
      `- **${rec.missingFonts} font requests 404 on every page:** ${code('basalt-ui/fonts.css')} (inside ${code('basalt-ui/tailwind.css')}) names its woff2 files by bare specifier in ${code('url()')}, which Vite leaves unresolved; the faces load through ${code('basalt-ui/styles.css')}' fontsource imports instead.`,
    )
  out.push(
    '',
    `Cells: ${code('no directive')} is the static HTML: ${code('clean')}, ${code('differs')} from the client:only picture, or ${code('fails')} on the server. The hydrating modes give the page's gzip JavaScript and any hydration error or layout shift; ${code('build fails')} means a hydrating island of a part that throws on the server stops ${code('astro build')}.`,
    '',
    '## Per part',
    '',
    `| Part | Exports | ${MODES.map((m) => LABEL[m]).join(' | ')} | Best | Why |`,
    `|-|-|${MODES.map(() => '-').join('|')}|-|-|`,
  )
  for (const v of rec.parts) {
    const best = v.best === 'none' ? 'none works' : LABEL[v.best]
    out.push(
      `| ${v.id} | ${v.covers.join(', ')} | ${MODES.map((m) => cellOf(v, m)).join(' | ')} | ${best} | ${esc(v.why)} |`,
    )
  }
  out.push(
    '',
    '## Bytes per part',
    '',
    "Gzip. First island: everything the part's client:load page runs. Further island: what it loads beyond the baseline island, the cost of adding it to a page that already has one.",
    '',
    '| Part | First island JS | Further island JS | CSS | LCP no directive | LCP client:load | LCP client:only | CLS on hydrate |',
    '|-|-|-|-|-|-|-|-|',
  )
  for (const v of rec.parts) {
    const m = v.modes
    out.push(
      `| ${v.id} | ${kb(m.load.js)} | ${kb(m.load.further)} | ${kb(m.load.css)} | ${m.static.lcp} ms | ${m.load.lcp} ms | ${m.only.lcp} ms | ${m.load.cls} |`,
    )
  }
  out.push(
    '',
    '## Several islands on one page',
    '',
    "Every part of a family on one page, each its own island, in one mode. Astro sends React once per page, so the total is the runtime plus each part's further cost, less what the parts share; client:visible counts only the islands in the first viewport.",
    '',
    `| Family | Parts | ${MODES.map((m) => LABEL[m]).join(' | ')} | CSS | CLS (client:load) |`,
    `|-|-|${MODES.map(() => '-').join('|')}|-|-|`,
  )
  for (const f of rec.families)
    out.push(
      `| ${f.family} | ${f.parts} | ${MODES.map((m) => kb(f.js[m])).join(' | ')} | ${kb(f.css)} | ${f.cls} |`,
    )
  const charts = rec.parts.filter((p) => p.chart)
  if (charts.length) {
    out.push(
      '',
      '## Charts: is the static picture correct?',
      '',
      `Each kind renders in a box of a declared 640 px (the engine's server width, ${code('INITIAL_WIDTH')} in ${code('packages/basalt-ui/src/charts/sizing.ts')}); at 390 the box is narrower than that. The share of differing pixels compares the static HTML with the client:only render; the linked images put static, client:only and the diff side by side.`,
      '',
      `| Kind | Static picture | ${VIEWS.join(' | ')} | Hover on top |`,
      `|-|-|${VIEWS.map(() => '-').join('|')}|-|`,
    )
    for (const v of charts) {
      const cells = VIEWS.map((view) => {
        const p = v.views[view]
        const text = p.sameSize
          ? `${(p.ratio * 100).toFixed(2)}%`
          : `size ${p.static.join('x')} vs ${p.only.join('x')}`
        return view.endsWith('light') ? `[${text}](shots/${v.id}.${view}.png)` : text
      })
      out.push(
        `| ${v.id} | ${chartVerdict(v)} | ${cells.join(' | ')} | client:visible, ${kb(v.modes.visible.further)} further |`,
      )
    }
  }
  const relevant = findings.filter(
    (f) => f.parts === '*' || f.parts.some((id) => rec.parts.some((p) => p.id === id)),
  )
  if (relevant.length) {
    out.push(
      '',
      '## Findings',
      '',
      'The cause of each difference, read from the source, and the plan row that carries the fix where the part should need no JavaScript for its picture.',
      '',
    )
    for (const f of relevant) {
      const parts = f.parts === '*' ? [] : rec.parts.filter((p) => f.parts.includes(p.id))
      const resolved =
        parts.length && parts.every((p) => p.staticClean)
          ? ' **Resolved: static-clean now; delete this finding.**'
          : ''
      const row = f.row ? ` Plan row ${code(f.row)}.` : ''
      out.push(
        `- **${f.parts === '*' ? 'Every page' : f.parts.join(', ')}**: ${f.cause}${row}${resolved}`,
      )
    }
  }
  out.push('', '## Not covered', '')
  out.push(
    rec.uncovered.length
      ? `Exported components no demo renders (${rec.uncovered.length}): ${rec.uncovered.map(code).join(', ')}; ${UNCOVERED_WHY}.`
      : 'Every exported component is rendered by a demo.',
    '',
    `${code('server:defer')} (server islands) is not measured: it needs an adapter and on-demand rendering, and this playground builds static output only.`,
    '',
  )
  return out.join('\n')
}

/** docs/v3/verdicts/astro-matrix.md: the record as prose and tables, rendered from the JSON alone. */
export function render(rec: MatrixRecord, findings: readonly Finding[]): string {
  const clean = rec.parts.filter((p) => p.staticClean).length
  const out: string[] = [
    '# Astro matrix',
    '',
    '<!-- @generated by apps/playground-astro/scripts/matrix.ts from astro-matrix.json: do not edit -->',
    '',
    `Every basalt-ui part rendered by ${code('apps/playground-astro')} (Astro 7, @astrojs/react, Tailwind 4, the package's built dist) in each render mode and measured in a real browser (${rec.browser}) on every CI head. This file is the record a run is checked against: each part's verdicts and its byte budgets. The measured run (every size, LCP, CLS, the pixel diffs and side-by-side pictures, the exports no demo renders) is ${code('.astro-matrix/matrix.md')}, kept as the ${code('astro-matrix')} artifact of the CI run. How to run it and how a budget is raised: ${code('docs/validation.md')} § Astro matrix.`,
    '',
    '## Summary',
    '',
    `- **${rec.parts.length} parts**, **${clean}** static-clean: the HTML Astro writes with no directive matches the client:only render word for word and to within ${PIXEL_TOLERANCE} pixels (a measured flake) at 1440 and 390 px, light and dark.`,
    '- **Zero JavaScript without an island:** a page without an island loads no script, checked on every run.',
    `- **The first React island** (React, react-dom and the Astro island runtime, before any basalt code) is budgeted at ${kb(rec.runtime.js)} of gzip JavaScript.`,
    `- **Budgets** are gzip ceilings, set at the size measured then plus ${kb(rec.slack)}. A run fails past one and never below one; a budget is raised on purpose, with its reason, and an improvement leaves the record as it is.`,
    '',
    `Columns: ${code('No directive')} is the static HTML: ${code('clean')}, ${code('differs')} from the client:only picture, or ${code('fails')} on the server. JavaScript is the most any hydrating mode's page loads; further island is what it loads beyond the baseline island, the cost of adding the part to a page that already has one.`,
    '',
    '## Per part',
    '',
    '| Part | Exports | No directive | Best | JavaScript | Further island | CSS | Why |',
    '|-|-|-|-|-|-|-|-|',
  ]
  for (const v of rec.parts) {
    const best = v.best === 'none' ? 'none works' : LABEL[v.best]
    const pic =
      v.ssr === 'fail'
        ? 'fails'
        : (v.staticClean ? 'clean' : 'differs') +
          (v.ssr === 'partial' ? ' (part left to client)' : '')
    out.push(
      `| ${v.id} | ${v.covers.join(', ')} | ${pic} | ${best} | ${kb(v.budget.js)} | ${kb(v.budget.further)} | ${kb(v.budget.css)} | ${esc(v.why)} |`,
    )
  }
  out.push(
    '',
    '## Several islands on one page',
    '',
    `Every part of a family on one page, each its own island, in one mode: the JavaScript budget of each page. Astro sends React once per page; client:visible counts only the islands in the first viewport.`,
    '',
    `| Family | Parts | ${MODES.map((m) => LABEL[m]).join(' | ')} |`,
    `|-|-|${MODES.map(() => '-').join('|')}|`,
  )
  for (const f of rec.families)
    out.push(`| ${f.family} | ${f.parts} | ${MODES.map((m) => kb(f.js[m])).join(' | ')} |`)
  const charts = rec.parts.filter((p) => p.chart)
  if (charts.length) {
    out.push(
      '',
      '## Charts: is the static picture correct?',
      '',
      `Each kind renders in a box of a declared 640 px (the engine's server width, ${code('INITIAL_WIDTH')} in ${code('packages/basalt-ui/src/charts/sizing.ts')}); at 390 the box is narrower than that. The run's matrix.md gives the share of differing pixels per view and the side-by-side pictures.`,
      '',
      '| Kind | Static picture | Hover on top |',
      '|-|-|-|',
    )
    for (const v of charts)
      out.push(
        `| ${v.id} | ${v.picture ?? ''} | client:visible, up to ${kb(v.budget.further)} further |`,
      )
  }
  const raised = [
    ...(rec.runtime.raised ? [`the island runtime: ${rec.runtime.raised}`] : []),
    ...rec.parts.filter((p) => p.raised).map((p) => `${p.id}: ${p.raised}`),
    ...rec.families.filter((f) => f.raised).map((f) => `family ${f.family}: ${f.raised}`),
  ]
  if (raised.length) out.push('', '## Raised budgets', '', ...raised.map((r) => `- ${esc(r)}`))
  const relevant = findings.filter(
    (f) => f.parts === '*' || f.parts.some((id) => rec.parts.some((p) => p.id === id)),
  )
  if (relevant.length) {
    out.push(
      '',
      '## Findings',
      '',
      'The cause of each difference, read from the source, and the plan row that carries the fix where the part should need no JavaScript for its picture.',
      '',
    )
    for (const f of relevant) {
      const parts = f.parts === '*' ? [] : rec.parts.filter((p) => f.parts.includes(p.id))
      const resolved =
        parts.length && parts.every((p) => p.staticClean)
          ? ' **Resolved: static-clean now; delete this finding.**'
          : ''
      const row = f.row ? ` Plan row ${code(f.row)}.` : ''
      out.push(
        `- **${f.parts === '*' ? 'Every page' : f.parts.join(', ')}**: ${f.cause}${row}${resolved}`,
      )
    }
  }
  out.push(
    '',
    '## Not measured',
    '',
    `${code('server:defer')} (server islands) is not measured: it needs an adapter and on-demand rendering, and this playground builds static output only.`,
    '',
  )
  return out.join('\n')
}

/** The record as JSON with one part and one family per line, so a diff of the record reads part by part. */
export function serialize(rec: MatrixRecord): string {
  const { parts, families, ...head } = rec
  const lines = (items: readonly unknown[]): string =>
    items.map((i) => '    ' + JSON.stringify(i)).join(',\n')
  const top = JSON.stringify(head, null, 2).slice(0, -2)
  return `${top},\n  "parts": [\n${lines(parts)}\n  ],\n  "families": [\n${lines(families)}\n  ]\n}\n`
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      update: { type: 'boolean', default: false },
      reason: { type: 'string' },
      render: { type: 'boolean', default: false },
      'check-render': { type: 'boolean', default: false },
      results: { type: 'string', default: join(import.meta.dir, '../.astro-matrix/results.json') },
    },
  })
  const repo = join(import.meta.dir, '../../..')
  const jsonPath = join(repo, 'docs/v3/verdicts/astro-matrix.json')
  const mdPath = join(repo, 'docs/v3/verdicts/astro-matrix.md')
  const recorded = JSON.parse(await readFile(jsonPath, 'utf8')) as MatrixRecord
  if (values.render || values['check-render']) {
    const md = render(recorded, FINDINGS)
    if (values.render) await writeFile(mdPath, md)
    else if ((await readFile(mdPath, 'utf8')) !== md) {
      console.error(
        'astro-matrix: docs/v3/verdicts/astro-matrix.md is not rendered from astro-matrix.json: bun apps/playground-astro/scripts/matrix.ts --render',
      )
      process.exit(1)
    }
    process.exit(0)
  }
  const results = JSON.parse(await readFile(values.results!, 'utf8')) as Results
  const exported = await exportedParts(join(repo, 'packages/basalt-ui/scripts/export-surface'))
  const fresh = judge(results, PARTS, exported)
  const partial = results.only !== undefined
  const runMd = join(dirname(values.results!), 'matrix.md')
  await writeFile(runMd, renderRun(fresh, FINDINGS))
  if (values.update) {
    const { record, raised } = toRecord(fresh, recorded, { parts: PARTS, reason: values.reason })
    if (raised.length && !values.reason) {
      for (const r of raised) console.error(`astro-matrix: raise ${r}`)
      console.error(
        'astro-matrix: a raise needs its reason: UPDATE=1 REASON="<why the part grew>"; nothing written',
      )
      process.exit(1)
    }
    await writeFile(jsonPath, serialize(record))
    await writeFile(mdPath, render(record, FINDINGS))
    for (const r of raised) console.log(`astro-matrix: raised ${r} (${values.reason})`)
    console.log(
      `astro-matrix: recorded ${fresh.parts.length}${partial ? ` of ${PARTS.length}` : ''} parts in docs/v3/verdicts/astro-matrix.{json,md}; the run is ${runMd}`,
    )
  } else {
    const { failures, notes } = compare(recorded, fresh, partial)
    if ((await readFile(mdPath, 'utf8')) !== render(recorded, FINDINGS))
      failures.push(
        'docs/v3/verdicts/astro-matrix.md is not rendered from astro-matrix.json: bun apps/playground-astro/scripts/matrix.ts --render',
      )
    for (const n of notes) console.log(`astro-matrix: ${n}`)
    for (const f of failures) console.error(`astro-matrix: FAIL ${f}`)
    console.log(`astro-matrix: the measured run is ${runMd}`)
    if (failures.length) process.exit(1)
    console.log(
      `astro-matrix: ${fresh.parts.length}${partial ? ` of ${recorded.parts.length}` : ''} parts inside their budgets, no regression${partial ? '; CI checks every part' : ''}`,
    )
  }
}
