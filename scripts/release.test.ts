/**
 * `release.sh`'s pure rules, sourced (not run) so nothing is dispatched: the
 * version gate (stable non-major 2.x only).
 */
import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const script = join(import.meta.dirname, 'release.sh')

type Run = { exitCode: number; stdout: string; stderr: string }

/** Runs `body` after sourcing release.sh; values arrive as positional args, never interpolated. */
function run(body: string, ...args: string[]): Run {
  const result = Bun.spawnSync(
    ['bash', '-c', `source "$1"; shift; ${body}`, '_', script, ...args],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString(),
  }
}

const gate = (bump: string, version: string): Run => run('version_gate "$@"', bump, version)

describe('version_gate', () => {
  it.each<[string, string]>([
    ['minor', '2.8.0'],
    ['patch', '2.7.4'],
    ['minor', '2.10.0'],
    ['patch', '2.7.10'],
  ])('allows %s → %s', (bump, version) => {
    expect(gate(bump, version).exitCode).toBe(0)
  })

  it.each<[string, string]>([
    ['major', '3.0.0'],
    ['major', '2.0.0'], // a second 2.0.0
    ['major', '2.8.0'], // a major bump is refused whatever version it computes
    ['major', '1.41.1'],
  ])('refuses %s → %s with the remedy', (bump, version) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('no majors')
    expect(result.stderr).toContain('MIGRATING.md')
  })

  it.each<[string, string]>([
    ['patch', '2.0.0'],
    ['minor', '2.0.0'],
  ])('refuses %s → %s as a recomputed 2.0.0', (bump, version) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('v2.0.0 has shipped')
    expect(result.stderr).toContain('out of sync with the registry')
  })

  it.each<[string, string]>([
    ['patch', '1.41.1'],
    ['minor', '1.42.0'],
    ['minor', '2.8.0-rc.1'],
    ['patch', '2.7.4+build.5'],
  ])('refuses %s → %s as not a stable 2.x', (bump, version) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('only stable 2.x')
    expect(result.stderr).not.toContain('MIGRATING.md')
  })
})

describe('version_gate — fails closed', () => {
  it.each<[string, string, string]>([
    ['', '2.0.0', 'unparsed bump'],
    ['unknown', '2.0.0', 'unparsed bump'],
    ['major', '', 'no computed version'],
  ])('refuses bump %p version %p', (bump, version, reason) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(reason)
  })
})

type Repo = {
  dir: string
  commit: (subject: string, ...paths: string[]) => void
  tag: (name: string) => void
}

/** A throwaway repo whose `origin/master` follows HEAD; `commit` adds a commit touching `paths`. */
function repoWith(commits: [string, ...string[]][]): Repo {
  const dir = mkdtempSync(join(tmpdir(), 'release-test-'))
  const git = (...args: string[]) => {
    const r = Bun.spawnSync(
      [
        'git',
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.com',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
    )
    if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`)
  }
  const commit = (subject: string, ...paths: string[]) => {
    for (const path of paths) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), `${subject}\n`)
    }
    git('add', '-A')
    git('commit', '-q', '--allow-empty', '-m', subject)
    git('update-ref', 'refs/remotes/origin/master', 'HEAD')
  }
  git('init', '-q', '-b', 'master')
  for (const [subject, ...paths] of commits) commit(subject, ...paths)
  return { dir, commit, tag: (name) => git('tag', name) }
}

/** `run` inside `dir`, with `gh` replaced by `ghBody` (its args reach the stub as "$@"). */
function runIn(dir: string, ghBody: string, body: string, ...args: string[]): Run {
  return run(`cd "$1"; shift; gh() { ${ghBody}; }; ${body}`, dir, ...args)
}

const ghRun = (status: string, conclusion: string) => `echo '${status}/${conclusion}'`

describe('ci_green', () => {
  const repo = repoWith([
    ['feat: first', 'a.txt'],
    ['fix: head', 'b.txt'],
    ['chore: release 1.0.0 [skip ci]', 'c.txt'],
  ])

  it('passes on a completed/success run of the newest non-release commit', () => {
    const result = runIn(repo.dir, ghRun('completed', 'success'), 'ci_green master')
    expect(result.exitCode).toBe(0)
  })

  it('asks gh for the non-release head, skipping the [skip ci] release commit', () => {
    const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD~1'], { cwd: repo.dir })
      .stdout.toString()
      .trim()
    // the function discards gh's stderr, so the stub records its arguments in a file
    runIn(repo.dir, `echo "$*" > gh-args; ${ghRun('completed', 'success')}`, 'ci_green master')
    const args = readFileSync(join(repo.dir, 'gh-args'), 'utf8')
    expect(args).toContain(`--commit ${head}`)
    expect(args).toContain('--workflow CI')
    expect(args).toContain('--event push')
  })

  it.each<[string, string]>([
    ['completed', 'failure'],
    ['completed', 'cancelled'],
    ['in_progress', ''],
    ['queued', ''],
  ])('refuses a %s/%s run', (status, conclusion) => {
    const result = runIn(repo.dir, ghRun(status, conclusion), 'ci_green master')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(`'${status}/${conclusion}'`)
    expect(result.stderr).toContain('green CI')
  })

  it('refuses when there is no run for the commit', () => {
    const result = runIn(repo.dir, 'true', 'ci_green master')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("'no run'")
  })

  it('refuses when gh fails', () => {
    const result = runIn(repo.dir, 'return 1', 'ci_green master')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("'no run'")
  })

  it('refuses without a branch', () => {
    expect(runIn(repo.dir, ghRun('completed', 'success'), 'ci_green').exitCode).toBe(1)
  })

  it('refuses when origin/<branch> does not exist', () => {
    const result = runIn(repo.dir, ghRun('completed', 'success'), 'ci_green nope')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('no non-release commit')
  })
})

describe('package_commit_present', () => {
  const pkg = 'packages/basalt-ui'
  const present = (dir: string, tag: string): Run =>
    run('cd "$1"; shift; package_commit_present "$@"', dir, tag, 'master', pkg)

  it('passes with a package commit after the tag', () => {
    const repo = repoWith([['feat: old', `${pkg}/a.ts`]])
    repo.tag('v1.0.0')
    repo.commit('fix: new', `${pkg}/b.ts`)
    expect(present(repo.dir, 'v1.0.0').exitCode).toBe(0)
  })

  it('passes without a tag when the package was ever touched', () => {
    const repo = repoWith([['feat: old', `${pkg}/a.ts`]])
    expect(present(repo.dir, '').exitCode).toBe(0)
  })

  it('refuses when only root files changed since the tag', () => {
    const repo = repoWith([['feat: old', `${pkg}/a.ts`]])
    repo.tag('v1.0.0')
    repo.commit('feat: root only', 'root.txt')
    const result = present(repo.dir, 'v1.0.0')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('needs a package commit')
  })

  it('refuses when the tag cannot be read', () => {
    const repo = repoWith([['feat: old', `${pkg}/a.ts`]])
    const result = present(repo.dir, 'v9.9.9')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('cannot read')
  })
})

describe('sourcing and direct runs', () => {
  it('sourcing leaves errexit, nounset and pipefail off', () => {
    const result = run('[[ $- != *e* && $- != *u* ]] && ! shopt -oq pipefail && echo clean')
    expect(result.stdout).toBe('clean')
  })

  it('a direct run still parses its mode argument (usage error, exit 2)', () => {
    const result = Bun.spawnSync(['bash', script, 'bogus'], { stdout: 'pipe', stderr: 'pipe' })
    expect(result.exitCode).toBe(2)
  })
})
