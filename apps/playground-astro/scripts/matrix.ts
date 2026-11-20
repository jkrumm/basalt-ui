/**
 * Turns the measurements (scripts/measure.ts) into the Astro matrix and keeps it honest.
 *
 *   bun scripts/matrix.ts --update   judge the fresh results, write docs/v3/verdicts/astro-matrix.{json,md}
 *   bun scripts/matrix.ts --check    judge the fresh results against the recorded JSON: exit 1 when a part that
 *                                    was static-clean is not, a page's JavaScript or CSS grew past its budget,
 *                                    a page without an island loads any script, or the .md is not the JSON's
 *
 * The .md is rendered from the JSON alone, never written by hand.
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
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
 * smallest real difference measured is about 37 px (dock's focus ring at 1440); 4 px sits between the two.
 */
export const PIXEL_TOLERANCE = 4
/**
 * How far a page's gzip JavaScript or CSS may grow past its record before the check fails: one KiB, an order
 * below the smallest further-island cost measured (Button, 9.5 KiB), so a part that grows fails while a few
 * bytes of hash or banner drift do not.
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

export type MatrixRecord = {
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

export const kb = (n: number): string => (n === 0 ? '0' : `${(n / 1024).toFixed(1)} kB`)

function worst(views: Record<View, ViewVerdict>): string {
  const [view, p] = Object.entries(views).sort((a, b) => b[1].ratio - a[1].ratio)[0]!
  return p.sameSize
    ? `${(p.ratio * 100).toFixed(1)}% of pixels at ${view}`
    : `size ${p.static.join('x')} vs ${p.only.join('x')} at ${view}`
}

type Judged = Omit<Verdict, 'best' | 'why'>

/** The best directive for a part and why, from what it needs JavaScript for and what the measurements show. */
export function decide(
  part: Pick<PartEntry, 'interaction' | 'why'>,
  v: Judged,
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
    : ` The static picture differs from the hydrated one until it hydrates (${worst(v.views)}).`
  const further = kb(load.further)
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
export async function exportedParts(shards: string): Promise<string[]> {
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
): MatrixRecord {
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

/** What the fresh record does worse than the recorded one: \`failures\` fail the check, \`notes\` only report. */
export function compare(
  recorded: MatrixRecord,
  fresh: MatrixRecord,
): { failures: string[]; notes: string[] } {
  const failures: string[] = []
  const notes: string[] = []
  const now = new Map(fresh.parts.map((p) => [p.id, p]))
  for (const was of recorded.parts) {
    const is = now.get(was.id)
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
    for (const m of MODES) {
      if (is.modes[m].js > was.modes[m].js + BYTE_SLACK)
        failures.push(
          `${was.id} ${m}: JavaScript ${is.modes[m].js} B gzip, budget ${was.modes[m].js} B`,
        )
      if (is.modes[m].css > was.modes[m].css + BYTE_SLACK)
        failures.push(`${was.id} ${m}: CSS ${is.modes[m].css} B gzip, budget ${was.modes[m].css} B`)
    }
  }
  for (const p of fresh.parts)
    if (!recorded.parts.some((r) => r.id === p.id))
      notes.push(`${p.id}: new part; record it with UPDATE=1`)
  const families = new Map(fresh.families.map((f) => [f.family, f]))
  for (const was of recorded.families) {
    const is = families.get(was.family)
    if (!is) continue
    for (const m of MODES)
      if (is.js[m] > was.js[m] + BYTE_SLACK)
        failures.push(
          `family ${was.family} ${m}: JavaScript ${is.js[m]} B gzip, budget ${was.js[m]} B`,
        )
  }
  if (fresh.zeroJs.js > 0 || fresh.zeroJs.scriptTags > 0)
    failures.push(
      `a page without an island loaded ${fresh.zeroJs.js} B of JavaScript from ${fresh.zeroJs.scriptTags} script tags`,
    )
  if (fresh.runtime.js > recorded.runtime.js + BYTE_SLACK)
    failures.push(
      `the island runtime is ${fresh.runtime.js} B gzip, budget ${recorded.runtime.js} B`,
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

function chartVerdict(v: Verdict): string {
  if (v.ssr !== 'ok') return `no: ${v.ssr} on the server`
  if (v.staticClean) return 'correct'
  const at = v.views['1440-light']
  return at.sameSize && at.changed <= PIXEL_TOLERANCE
    ? 'correct at the declared width only'
    : 'wrong'
}

export function render(rec: MatrixRecord, findings: readonly Finding[]): string {
  const clean = rec.parts.filter((p) => p.staticClean).length
  const out: string[] = [
    '# Astro matrix',
    '',
    '<!-- @generated by apps/playground-astro/scripts/matrix.ts --update from astro-matrix.json: do not edit -->',
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
        return view.endsWith('light') ? `[${text}](astro-matrix/${v.id}.${view}.png)` : text
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
      results: { type: 'string', default: join(import.meta.dir, '../.astro-matrix/results.json') },
      shots: { type: 'string', default: join(import.meta.dir, '../.astro-matrix/shots') },
    },
  })
  const repo = join(import.meta.dir, '../../..')
  const jsonPath = join(repo, 'docs/v3/verdicts/astro-matrix.json')
  const mdPath = join(repo, 'docs/v3/verdicts/astro-matrix.md')
  const results = JSON.parse(await readFile(values.results!, 'utf8')) as Results
  const exported = await exportedParts(join(repo, 'packages/basalt-ui/scripts/export-surface'))
  const fresh = judge(results, PARTS, exported)
  if (values.update) {
    await writeFile(jsonPath, serialize(fresh))
    await writeFile(mdPath, render(fresh, FINDINGS))
    const dir = join(repo, 'docs/v3/verdicts/astro-matrix')
    await mkdir(dir, { recursive: true })
    for (const v of fresh.parts.filter((p) => p.chart))
      for (const view of VIEWS.filter((x) => x.endsWith('light')))
        await copyFile(join(values.shots!, `${v.id}.${view}.png`), join(dir, `${v.id}.${view}.png`))
    console.log(
      `astro-matrix: recorded ${fresh.parts.length} parts in docs/v3/verdicts/astro-matrix.{json,md}`,
    )
  } else {
    const recorded = JSON.parse(await readFile(jsonPath, 'utf8')) as MatrixRecord
    const { failures, notes } = compare(recorded, fresh)
    if ((await readFile(mdPath, 'utf8')) !== render(recorded, FINDINGS))
      failures.push(
        'docs/v3/verdicts/astro-matrix.md is not rendered from astro-matrix.json: record it with UPDATE=1',
      )
    for (const n of notes) console.log(`astro-matrix: ${n}`)
    for (const f of failures) console.error(`astro-matrix: FAIL ${f}`)
    if (failures.length) process.exit(1)
    console.log(
      `astro-matrix: ${fresh.parts.length} parts checked against the record, no regression`,
    )
  }
}
