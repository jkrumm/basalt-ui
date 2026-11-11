/**
 * Spike cn-breakpoints (docs/v3/ARCHITECTURE.md section 11 F6, F7; docs/v3/concepts/tokens-visual.md
 * section 8 S4). Throwaway harness, no tests.
 *
 *   F6  every `cn(...)` call in console and epos: can its arguments emit two utilities of one conflict
 *       group (collapsed by the compiled `cn`, kept side by side by `clsx`), and is it a `className`
 *       handed to a bought primitive (inside `no-restyle`'s reach)? Plus the emit case (`hidden`,
 *       `inline-flex`) read as a computed `display` in Chrome for both class orders.
 *   F7  the v3 breakpoint reset compiled by Tailwind 4.3.5; every `sm:`, `lg:`, `max-`, `min-` use in
 *       console and epos plus seeded dead and live classes; a standalone `no-unknown-classes` matcher.
 *   S4  the zone A colour denial over argo, console, linewatch, TS colour included.
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr. Private repos appear as counts and hashed ids, epos as counts only.
 * Reads scratch copies in the OS temp dir only; never writes into a target repo.
 */
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clsx } from 'clsx'
import { cn } from '../../../packages/basalt-ui/src/core/cn'
import { chromeEffects, cliBuild, emitCase, emittedClasses, isolated, makeCompiler } from './css'
import { analyseCalls, setLiveness, summariseRepo } from './f6'
import type { F6Repo } from './f6'
import { collectUses, noUnknownClasses, SEEDED_DEAD, SEEDED_LIVE, USE_KINDS, deadSites } from './f7'
import type { Use, UseKind } from './f7'
import { probe, ZONE_A_SIZE } from './s4'
import type { S4Repo } from './s4'
import { cmp, log, REPOS, round, scanRepo } from './scan'
import type { RepoName, ScannedRepo } from './scan'

const F6_REPOS: RepoName[] = ['console', 'epos']
const F7_REPOS: RepoName[] = ['console', 'epos']
const S4_REPOS: RepoName[] = ['argo', 'console', 'linewatch']
const S4_MAX_PER_300 = 1
const word = (b: boolean): 'PASS' | 'REFUTED' => (b ? 'PASS' : 'REFUTED')

async function main(): Promise<void> {
  const tmpRoot = join(tmpdir(), `cn-breakpoints-spike-${process.pid}`)
  try {
    const scanned = new Map<RepoName, ScannedRepo>()
    for (const def of REPOS) {
      const r = scanRepo(def, tmpRoot)
      scanned.set(def.name, r)
      log(`[${def.name}] ${r.files.length} files, ${r.lines} lines`)
    }
    const pick = (names: RepoName[]): ScannedRepo[] =>
      names.flatMap((n) => {
        const r = scanned.get(n)
        return r ? [r] : []
      })

    // ---- F6 ------------------------------------------------------------------------------------
    log('[f6] cn call sites')
    const v3 = await makeCompiler('v3')
    const liveCache = new Map<string, boolean>()
    setLiveness((t) => {
      const hit = liveCache.get(t)
      if (hit !== undefined) return hit
      const live = emittedClasses(v3.build([t])).has(t)
      liveCache.set(t, live)
      return live
    })
    const f6Repos: Record<string, F6Repo> = {}
    for (const repo of pick(F6_REPOS)) {
      f6Repos[repo.def.name] = summariseRepo(repo, analyseCalls(repo))
    }
    const sumBy = (k: keyof Omit<F6Repo, 'refs'>): number =>
      Object.values(f6Repos).reduce((n, r) => n + r[k], 0)

    log('[f6] emit case in Chrome')
    const emit = await emitCase(['hidden', 'inline-flex'])
    const emitSidebar = await emitCase(['flex', 'hidden'])
    const orders = Object.keys(emit.displayByOrder)
    const displays = new Set(Object.values(emit.displayByOrder))
    const f6 = {
      conflictsBeyondNoRestyle: sumBy('beyondNoRestyle'),
      callSites: sumBy('sites'),
      callsWithConflict: sumBy('withConflict'),
      coveredByNoRestyle: sumBy('coveredByNoRestyle'),
      beyondInBoughtPrimitiveSource: sumBy('beyondInUiFiles'),
      beyondViaCva: sumBy('beyondViaCva'),
      beyondStatic: sumBy('beyondStatic'),
      openCalls: sumBy('openCalls'),
      passThroughCalls: sumBy('passThroughCalls'),
      emitCaseDisplay: emit.displayByOrder,
      emitCaseFlexHiddenDisplay: emitSidebar.displayByOrder,
      emitCase: {
        orders,
        classOrderChangesDisplay: displays.size > 1,
        stylesheetOrder: emit.cssOrder,
        flexHiddenStylesheetOrder: emitSidebar.cssOrder,
        clsx: clsx('hidden', 'inline-flex'),
        compiledCn: cn('hidden', 'inline-flex'),
      },
      byRepo: Object.fromEntries(
        Object.entries(f6Repos)
          .toSorted(([a], [b]) => cmp(a, b))
          .map(([name, r]) => [name, r]),
      ),
    }

    // ---- F7 ------------------------------------------------------------------------------------
    log('[f7] breakpoint uses')
    const uses: Use[] = pick(F7_REPOS).flatMap((r) => collectUses(r))
    const realClasses = [...new Set(uses.map((u) => u.text))].toSorted(cmp)
    const seededDead = [...SEEDED_DEAD]
    const seededLive = [...SEEDED_LIVE]
    const candidates = [...new Set([...realClasses, ...seededDead, ...seededLive])].toSorted(cmp)

    log(`[f7] ${candidates.length} candidates: ground truth (compile API, one class at a time)`)
    const truth = await isolated('v3', candidates)
    log('[f7] the CLI over every candidate at once, then the matcher')
    const emitted = emittedClasses(cliBuild('v3', candidates, 'f7-v3'))
    const flagged = new Set(noUnknownClasses(candidates, emitted))
    const dead = candidates.filter((c) => truth.get(c) === false)
    const caught = dead.filter((c) => flagged.has(c))
    const falsePositives = candidates.filter((c) => truth.get(c) === true && flagged.has(c))

    log('[f7] Chrome: do the seeded classes change anything?')
    const defaultTruth = await isolated('default', candidates)
    const chromeCss = cliBuild('v3', [...seededDead, ...seededLive], 'f7-chrome')
    const chromeDefaultCss = cliBuild('default', [...seededDead], 'f7-chrome-default')
    const effect = await chromeEffects(chromeCss, [...seededDead, ...seededLive])
    const effectDefault = await chromeEffects(chromeDefaultCss, [...seededDead])

    const deadSet = new Set(dead)
    const kindCount = (pred: (u: Use) => boolean): Record<UseKind, number> =>
      Object.fromEntries(
        USE_KINDS.map((k) => [k, uses.filter((u) => pred(u) && u.kinds.includes(k)).length]),
      ) as Record<UseKind, number>
    const realDead = realClasses.filter((c) => truth.get(c) === false)
    const f7ByRepo = Object.fromEntries(
      pick(F7_REPOS).map((r) => {
        const own = uses.filter((u) => u.repo === r.def.name)
        const d = deadSites(r, own, deadSet)
        return [
          r.def.name,
          {
            uses: own.length,
            uniqueClasses: new Set(own.map((u) => u.text)).size,
            deadOccurrences: d.occurrences,
            deadRefs: d.refs.slice(0, 20),
          },
        ]
      }),
    )
    const f7 = {
      deadClassesCaught: caught.length,
      deadClassesTotal: dead.length,
      falsePositives: falsePositives.length,
      missed: dead.length - caught.length,
      realUses: uses.length,
      realUniqueClasses: realClasses.length,
      realDeadClasses: realDead.length,
      realDeadOccurrences: uses.filter((u) => deadSet.has(u.text)).length,
      usesByKind: kindCount(() => true),
      deadUsesByKind: kindCount((u) => deadSet.has(u.text)),
      seeded: {
        dead: seededDead.length,
        deadVerified: seededDead.filter((c) => truth.get(c) === false).length,
        deadCaught: seededDead.filter((c) => flagged.has(c)).length,
        live: seededLive.length,
        liveVerified: seededLive.filter((c) => truth.get(c) === true).length,
        liveFlagged: seededLive.filter((c) => flagged.has(c)).length,
        chromeSilentDead: seededDead.filter((c) => effect.get(c) === false).length,
        chromeEffectLive: seededLive.filter((c) => effect.get(c) === true).length,
        defaultScaleEffectDead: seededDead.filter((c) => effectDefault.get(c) === true).length,
        deadUnderDefaultScale: seededDead.filter((c) => defaultTruth.get(c) === false).length,
      },
      byRepo: f7ByRepo,
    }

    // ---- S4 ------------------------------------------------------------------------------------
    log('[s4] zone A colour denial')
    const s4Repos: Record<string, S4Repo> = {}
    for (const repo of pick(S4_REPOS)) s4Repos[repo.def.name] = probe(repo)
    const rs = Object.values(s4Repos)
    const total = (k: keyof Omit<S4Repo, 'refs'>): number => rs.reduce((n, r) => n + r[k], 0)
    const flaggedSites = total('flagged')
    const lines = total('scannedLines')
    const s4 = {
      waiversPer300Lines: round((flaggedSites * 300) / lines, 3),
      flaggedSites,
      classSites: total('classSites'),
      tsColour: total('tsColour'),
      tsColourHueOnly: total('tsColourHue'),
      waiversPer300LinesHueOnly: round(
        ((total('classSites') + total('tsColourHue')) * 300) / lines,
        3,
      ),
      scannedLines: lines,
      scannedTsxLines: total('scannedTsxLines'),
      waiversPer300LinesLiteralPatternOnly: round(
        ((total('classSites') + total('tsColourLiteral')) * 300) / lines,
        3,
      ),
      denialList: ZONE_A_SIZE,
      byRepo: Object.fromEntries(
        Object.entries(s4Repos)
          .toSorted(([a], [b]) => cmp(a, b))
          .map(([name, r]) => [name, { ...r, refs: r.refs.slice(0, 20) }]),
      ),
    }

    const f6Pass = f6.conflictsBeyondNoRestyle === 0
    const f7Pass = f7.deadClassesTotal > 0 && f7.deadClassesCaught === f7.deadClassesTotal
    const s4Pass = s4.waiversPer300Lines <= S4_MAX_PER_300

    const out = {
      tool: {
        tailwindcss: '4.3.5',
        playwright: '1.63.0',
        typescript: '6.0.3',
      },
      repos: Object.fromEntries(
        [...scanned.values()]
          .toSorted((a, b) => cmp(a.def.name, b.def.name))
          .map((r) => [
            r.def.name,
            { visibility: r.visibility, head: r.head, files: r.files.length, lines: r.lines },
          ]),
      ),
      f6,
      f7,
      s4,
      verdicts: { F6: word(f6Pass), F7: word(f7Pass), S4: word(s4Pass) },
      verdict: word(f6Pass && f7Pass && s4Pass),
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}

await main()
