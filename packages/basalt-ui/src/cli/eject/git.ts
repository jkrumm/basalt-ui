/**
 * The two questions eject asks git: is the install's tree committed (`--undo` refuses otherwise),
 * and was a file already there on the merge base (`--adopt` takes only those, CE2). With no git,
 * neither can be proven, so the answer is the refusing one.
 */
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { relative } from 'node:path'

const git = (cwd: string, args: string[]): { ok: boolean; out: string } => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { ok: run.status === 0, out: (run.stdout ?? '').trim() }
}

/** True when nothing under `dir` differs from HEAD (untracked files included); null without git. */
export function isClean(dir: string): boolean | null {
  const status = git(dir, ['status', '--porcelain', '--untracked-files=all', '--', '.'])
  return status.ok ? status.out === '' : null
}

/** The branch the merge base is taken against: origin's HEAD, else main or master. */
function defaultRef(dir: string): string | null {
  const head = git(dir, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'])
  const candidates = [
    ...(head.ok ? [head.out] : []),
    'refs/remotes/origin/main',
    'refs/remotes/origin/master',
    'refs/heads/main',
    'refs/heads/master',
  ]
  return candidates.find((ref) => git(dir, ['rev-parse', '--verify', '--quiet', ref]).ok) ?? null
}

/** True when `absPath` exists in the commit where HEAD left the default branch. */
export function onMergeBase(dir: string, absPath: string): boolean {
  const top = git(dir, ['rev-parse', '--show-toplevel'])
  const ref = defaultRef(dir)
  if (!top.ok || ref === null) return false
  const base = git(dir, ['merge-base', 'HEAD', ref])
  if (!base.ok) return false
  const rel = relative(top.out, realpathSync(absPath)).replaceAll('\\', '/')
  return git(dir, ['cat-file', '-e', `${base.out}:${rel}`]).ok
}
