/* oxlint-disable no-console -- CLI entry point: progress and failures go to the terminal */
/**
 * `make evidence` — build (or take) a playground dist, serve it, run every lane, write
 * `.evidence/<label>/<lane>.json` (gitignored) and the committed `docs/waves/evidence/w2/<label>.md`.
 *
 *   bun scripts/evidence/index.ts --label <label> [--dist <dir>] [--routes <file>]
 *
 * Lanes are plain modules exporting a `Lane` (see `types.ts`); a missing module is recorded as
 * "lane absent", a throwing lane as "lane failed" (and fails the run after everything is written).
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Browser, BrowserServer } from 'playwright-core'
import { serveDist } from './serve'
import type { Lane, LaneCtx, LaneResult } from './types'

const ROOT = resolve(import.meta.dirname, '../..')
const LANES = ['bundle', 'screens', 'lighthouse', 'charts-perf', 'chat-profile', 'otel'] as const
const BUILD_TIMEOUT_MS = 300_000
const LANE_TIMEOUT_MS = 20 * 60_000

export type LaneOutcome =
  | { status: 'ok'; result: LaneResult }
  | { status: 'absent' }
  | { status: 'failed'; error: string }

// ── Output ────────────────────────────────────────────────────────────────────────────────────

const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)]),
    )
  }
  return v
}

/** JSON with recursively sorted keys, so two runs over the same numbers are byte-identical. */
export const stableStringify = (value: unknown): string =>
  JSON.stringify(sortKeys(value), null, 2) + '\n'

const cell = (text: string | number): string =>
  String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** The committed summary: no timestamps, no paths, lane order fixed by `LANES`. */
export function renderSummary(label: string, outcomes: Map<string, LaneOutcome>): string {
  const out = [`# Evidence — ${label}`, '']
  for (const [lane, outcome] of outcomes) {
    out.push(`## ${lane}`, '')
    if (outcome.status === 'absent') {
      out.push('lane absent', '')
    } else if (outcome.status === 'failed') {
      out.push(`lane failed: ${outcome.error.split('\n')[0]}`, '')
    } else {
      out.push('|Metric|Value|Unit|', '|-|-|-|')
      for (const row of outcome.result.summary) {
        out.push(`|${cell(row.metric)}|${cell(row.value)}|${cell(row.unit ?? '')}|`)
      }
      out.push('')
    }
  }
  return out.join('\n')
}

// ── Lanes ─────────────────────────────────────────────────────────────────────────────────────

const camel = (name: string): string => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())

/** `null` when the module file does not exist; the `Lane` is `<camelName>` or the sole function export. */
async function loadLane(name: string): Promise<Lane | null> {
  const file = join(import.meta.dirname, `${name}.ts`)
  if (!existsSync(file)) return null
  const mod = (await import(file)) as Record<string, unknown>
  const lane = mod[camel(name)] ?? Object.values(mod).find((v) => typeof v === 'function')
  if (typeof lane !== 'function') throw new Error(`${name}.ts exports no Lane`)
  return lane as Lane
}

const withTimeout = <T>(work: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

// ── Build ─────────────────────────────────────────────────────────────────────────────────────

async function sh(cmd: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    timeout: BUILD_TIMEOUT_MS,
  })
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed in ${cwd}`)
}

async function buildPlayground(): Promise<string> {
  await sh(['bun', 'run', 'build'], join(ROOT, 'packages/basalt-ui'))
  // `--manifest` is what lets the bundle lane map chunks to routes.
  await sh(['bunx', 'vite', 'build', '--manifest'], join(ROOT, 'apps/playground'))
  return join(ROOT, 'apps/playground/dist')
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      label: { type: 'string' },
      dist: { type: 'string' },
      routes: { type: 'string' },
    },
  })
  const label = values.label
  if (!label || !/^[\w.-]+$/.test(label)) {
    console.error(
      'usage: bun scripts/evidence/index.ts --label <label> [--dist <dir>] [--routes <file>]',
    )
    return 2
  }
  if (values.routes) process.env['EVIDENCE_ROUTES'] = resolve(values.routes)

  const distDir = values.dist ? resolve(values.dist) : await buildPlayground()
  if (!existsSync(join(distDir, 'index.html'))) throw new Error(`no index.html in ${distDir}`)

  const outDir = join(ROOT, '.evidence', label)
  await mkdir(outDir, { recursive: true })
  const server = serveDist(distDir)
  const chromes: BrowserServer[] = []
  const ctx: LaneCtx = {
    label,
    outDir,
    baseUrl: server.origin,
    distDir,
    // `launchServer` + `connect` + `kill()` — graceful `close()` is known to hang on this host
    // (packages/basalt-ui/tests/layout/harness.ts). Every Chrome opened is killed after its lane.
    openBrowser: async (): Promise<Browser> => {
      const chrome = await chromium.launchServer({
        channel: 'chrome',
        chromiumSandbox: !process.env['CI'],
      })
      chromes.push(chrome)
      return chromium.connect(chrome.wsEndpoint())
    },
  }

  const outcomes = new Map<string, LaneOutcome>()
  try {
    for (const name of LANES) {
      let outcome: LaneOutcome
      try {
        const lane = await loadLane(name)
        if (!lane) {
          outcome = { status: 'absent' }
        } else {
          console.log(`[evidence] ${name}…`)
          const result = await withTimeout(lane(ctx), LANE_TIMEOUT_MS, `lane ${name}`)
          await writeFile(join(outDir, `${name}.json`), stableStringify(result))
          outcome = { status: 'ok', result }
        }
      } catch (error) {
        outcome = {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        }
        console.error(`[evidence] ${name} failed: ${outcome.error}`)
      } finally {
        await Promise.all(chromes.splice(0).map((c) => c.kill().catch(() => undefined)))
      }
      outcomes.set(name, outcome)
    }
  } finally {
    server.stop()
  }

  const summaryDir = join(ROOT, 'docs/waves/evidence/w2')
  await mkdir(summaryDir, { recursive: true })
  const summaryFile = join(summaryDir, `${label}.md`)
  await writeFile(summaryFile, renderSummary(label, outcomes))
  console.log(`[evidence] wrote ${summaryFile}`)
  return [...outcomes.values()].some((o) => o.status === 'failed') ? 1 : 0
}

if (import.meta.main) process.exit(await main())
