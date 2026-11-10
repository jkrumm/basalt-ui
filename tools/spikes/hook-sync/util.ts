import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export const HERE = import.meta.dir
export const REPO = join(HERE, '../../..')
export const AGENT_DIR = join(REPO, 'packages/basalt-ui/agent')
export const OXFMT = join(REPO, 'node_modules/.bin/oxfmt')

export const sha256 = (s: string | Uint8Array): string =>
  createHash('sha256').update(s).digest('hex')

export const progress = (msg: string): void => {
  process.stderr.write(`[hook-sync] ${msg}\n`)
}

export type Run = { status: number | null; stdout: string; stderr: string }

/** Run a command line through /bin/sh exactly as Claude Code runs a hook `command`. */
export function sh(
  command: string,
  opts: { cwd: string; env?: Record<string, string | undefined>; input?: string },
): Run {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...process.env, ...opts.env })) {
    if (v !== undefined) env[k] = v
  }
  const r = Bun.spawnSync(['/bin/sh', '-c', command], {
    cwd: opts.cwd,
    env,
    stdin: new TextEncoder().encode(opts.input ?? ''),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { status: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() }
}

export function put(path: string, text: string, mode?: number): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, mode === undefined ? undefined : { mode })
}

/** Every file under `dir` (relative posix paths, sorted), skipping `node_modules`. */
export function walk(dir: string): string[] {
  const out: string[] = []
  const visit = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      if (name === 'node_modules') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) visit(p)
      else out.push(relative(dir, p).split('\\').join('/'))
    }
  }
  visit(dir)
  return out
}

/** One digest over the relative names and bytes of a tree: equal digests, byte-identical trees. */
export function treeDigest(dir: string): string {
  const h = createHash('sha256')
  for (const f of walk(dir)) h.update(`${f}\0`).update(readFileSync(join(dir, f)))
  return h.digest('hex')
}

/** First `max` words of `text`, for the "quote under 20 words" rule. */
export function clip(text: string, max = 19): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  return words.length <= max ? words.join(' ') : `${words.slice(0, max).join(' ')} …`
}
