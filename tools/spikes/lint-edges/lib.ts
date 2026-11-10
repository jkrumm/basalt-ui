/** Shared plumbing for spike 624: run the pinned oxlint on a scratch dir and read its JSON. */
import { resolve } from 'node:path'

export type Diag = {
  message: string
  code?: string
  severity: string
  filename: string
  labels: { span: { offset: number; length: number; line: number; column: number } }[]
}

export const HERE = import.meta.dirname
export const OXLINT = resolve(HERE, 'node_modules/.bin/oxlint')

/** `probe(no-foo)` becomes `probe/no-foo`; a diagnostic with no code (a directive report) has none. */
export const ruleOf = (d: Diag): string => d.code?.replace(/^([^(]+)\((.+)\)$/, '$1/$2') ?? ''

export const lineOf = (d: Diag): number => d.labels[0]?.span.line ?? 0

export type LintRun = { diags: Diag[]; ms: number; stderr: string }

/** One oxlint process; `ms` is spawn-to-exit wall time. Never throws on findings (exit 1 is normal). */
export async function lint(opts: {
  cwd: string
  config: string
  targets: string[]
  args?: string[]
}): Promise<LintRun> {
  const start = performance.now()
  const proc = Bun.spawn(
    [OXLINT, '-c', opts.config, '-f', 'json', ...(opts.args ?? []), ...opts.targets],
    { cwd: opts.cwd, stdout: 'pipe', stderr: 'pipe' },
  )
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  await proc.exited
  const ms = performance.now() - start
  if (!stdout.trim())
    throw new Error(`oxlint printed no JSON (cwd ${opts.cwd}): ${stderr.slice(0, 400)}`)
  const parsed = JSON.parse(stdout) as { diagnostics: Diag[] }
  return { diags: parsed.diagnostics, ms, stderr }
}

/** Findings from the rules under test, native noise excluded. */
export const ours = (diags: Diag[]): Diag[] =>
  diags.filter((d) => /^(basalt|shadcn|probe)\//.test(ruleOf(d)))

export const r1 = (n: number): number => Math.round(n * 10) / 10
export const median = (xs: number[]): number => {
  const s = xs.toSorted((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
