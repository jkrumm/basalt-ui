import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { laneOf, transformWaivers } from './transform.ts'
import type { Site, Worklisted } from './transform.ts'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'target',
  'coverage',
  '.git',
  '.claude',
  '.next',
  '.turbo',
  '.output',
])

export type RepoCounts = {
  files: number
  sites: number
  rewritten: number
  worklist: number
  deepRenderCandidates: number
}

export type WaiverReport = {
  dryRun: boolean
  repos: Record<string, RepoCounts>
  total: RepoCounts
  worklist: (Worklisted & { repo: string; file: string })[]
  deepRenderCandidates: { repo: string; file: string; line: number; ids: readonly string[] }[]
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name))
    } else if (entry.isFile()) {
      yield join(dir, entry.name)
    }
  }
}

const empty = (): RepoCounts => ({
  files: 0,
  sites: 0,
  rewritten: 0,
  worklist: 0,
  deepRenderCandidates: 0,
})

/** Run the waiver codemod over directories. Dry run unless `write`. */
export function runWaivers(opts: { dirs: readonly string[]; write: boolean }): WaiverReport {
  const report: WaiverReport = {
    dryRun: !opts.write,
    repos: {},
    total: empty(),
    worklist: [],
    deepRenderCandidates: [],
  }
  for (const input of opts.dirs) {
    const root = resolve(input)
    const repo = basename(root)
    const counts = (report.repos[repo] ??= empty())
    const files = statSync(root).isDirectory() ? [...walk(root)] : [root]
    for (const path of files) {
      const lane = laneOf(path)
      if (lane === null) continue
      const source = readFileSync(path, 'utf8')
      if (!source.includes('theme-allow')) continue
      const rel = statSync(root).isDirectory() ? relative(root, path) : basename(path)
      const result = transformWaivers(source, { lane })
      const sites: number = result.rewritten.length + result.worklist.length
      if (sites === 0) continue
      counts.files++
      counts.sites += sites
      counts.rewritten += result.rewritten.length
      counts.worklist += result.worklist.length
      counts.deepRenderCandidates += result.deepRenderCandidates.length
      for (const w of result.worklist) report.worklist.push({ repo, file: rel, ...w })
      for (const s of result.deepRenderCandidates)
        report.deepRenderCandidates.push({ repo, file: rel, line: s.line, ids: s.ids })
      if (opts.write && result.text !== source) writeFileSync(path, result.text)
    }
  }
  for (const c of Object.values(report.repos))
    for (const k of Object.keys(c) as (keyof RepoCounts)[]) report.total[k] += c[k]
  return report
}

export type { Site }
