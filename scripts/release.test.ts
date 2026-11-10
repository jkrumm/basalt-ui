/**
 * `release.sh`'s pure rules, sourced (not run) so nothing is dispatched: the
 * version gate (pre-GA: only the owner-flagged 3.0.0; post-GA: non-major 3.x).
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

/** version_gate <bump> <version> <ga_tag_exists> <ga_flag> */
const gate = (bump: string, version: string, gaTag: string, gaFlag: string): Run =>
  run('version_gate "$@"', bump, version, gaTag, gaFlag)

describe('version_gate — before GA (no v3.0.0 tag)', () => {
  it('accepts 3.0.0 as a major with the owner flag', () => {
    expect(gate('major', '3.0.0', '0', '1').exitCode).toBe(0)
  })

  it('refuses 3.0.0 without the flag, naming GA=1 and the owner', () => {
    const result = gate('major', '3.0.0', '0', '0')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('GA=1')
    expect(result.stderr).toContain("owner's go")
  })

  it.each<[string, string]>([
    ['patch', '2.29.1'],
    ['minor', '2.30.0'],
    ['major', '2.0.0'],
    ['minor', '3.0.0'], // 3.0.0 is only ever a major
    ['patch', '3.0.0'],
    ['minor', '3.1.0'],
    ['patch', '3.0.1'],
    ['major', '4.0.0'],
    ['major', '3.0.0-rc.1'],
    ['minor', '3.0.0-beta.2'],
    ['patch', '2.29.1-rc.1'],
    ['major', '3.0.0+build.5'],
    ['patch', '1.41.1'],
  ])('refuses %s → %s even with the flag', (bump, version) => {
    const result = gate(bump, version, '0', '1')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('before GA')
  })

  it.each<[string, string]>([
    ['patch', '2.29.1'],
    ['minor', '2.30.0'],
    ['major', '3.0.0-rc.1'],
  ])('refuses %s → %s without the flag', (bump, version) => {
    expect(gate(bump, version, '0', '0').exitCode).toBe(1)
  })
})

describe('version_gate — after GA (v3.0.0 tag exists)', () => {
  it.each<[string, string]>([
    ['minor', '3.1.0'],
    ['patch', '3.0.1'],
    ['minor', '3.10.0'],
    ['patch', '3.1.10'],
  ])('accepts %s → %s', (bump, version) => {
    expect(gate(bump, version, '1', '0').exitCode).toBe(0)
    expect(gate(bump, version, '1', '1').exitCode).toBe(0)
  })

  it.each<[string, string]>([
    ['major', '4.0.0'],
    ['major', '3.0.0'],
    ['major', '3.1.0'], // a major bump is refused whatever version it computes
    ['major', '2.0.0'],
  ])('refuses the major %s → %s, naming Major lines', (bump, version) => {
    for (const flag of ['0', '1']) {
      const result = gate(bump, version, '1', flag)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('no majors')
      expect(result.stderr).toContain('Major lines')
    }
  })

  it.each<[string, string]>([
    ['patch', '3.0.0'],
    ['minor', '3.0.0'],
  ])('refuses %s → %s as a recomputed 3.0.0', (bump, version) => {
    const result = gate(bump, version, '1', '1')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('v3.0.0 has shipped')
    expect(result.stderr).toContain('out of sync')
  })

  it.each<[string, string]>([
    ['patch', '2.29.1'],
    ['minor', '2.30.0'],
    ['patch', '1.41.1'],
    ['minor', '3.1.0-rc.1'],
    ['patch', '3.0.1+build.5'],
    ['minor', '4.1.0'],
  ])('refuses %s → %s as not a stable 3.x', (bump, version) => {
    const result = gate(bump, version, '1', '0')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('only stable 3.x')
  })
})

describe('version_gate — fails closed', () => {
  it.each<[string, string, string]>([
    ['', '3.0.0', 'unparsed bump'],
    ['unknown', '3.0.0', 'unparsed bump'],
    ['major', '', 'no computed version'],
    ['minor', '', 'no computed version'],
  ])('refuses bump %p version %p in every state', (bump, version, reason) => {
    for (const [gaTag, gaFlag] of [
      ['0', '0'],
      ['0', '1'],
      ['1', '0'],
      ['1', '1'],
    ]) {
      const result = gate(bump, version, gaTag, gaFlag)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(reason)
    }
  })

  it.each<[string, string]>([
    ['', '1'],
    ['1', ''],
    ['yes', '1'],
    ['0', '2'],
    ['', ''],
  ])('refuses ga_tag_exists %p / ga_flag %p that is not 0|1', (gaTag, gaFlag) => {
    const result = gate('major', '3.0.0', gaTag, gaFlag)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('must each be 0 or 1')
  })
})

describe('ga_tag_exists', () => {
  const repo = repoWith([['feat: first', 'a.txt']])
  const lsRemote = (body: string): Run =>
    run(`cd "$1"; shift; git() { ${body}; }; ga_tag_exists`, repo.dir)

  it('prints 1 when git ls-remote prints a v3.0.0 ref', () => {
    const result = lsRemote('echo "$*" > ls-args; printf "abc123\\trefs/tags/v3.0.0\\n"')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('1')
    expect(readFileSync(join(repo.dir, 'ls-args'), 'utf8')).toContain(
      'ls-remote --tags origin v3.0.0',
    )
  })

  it('prints 0 when git ls-remote prints nothing', () => {
    const result = lsRemote('true')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('0')
  })

  it('fails closed, printing nothing, when the remote cannot be read', () => {
    const result = lsRemote('return 128')
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('cannot read the tags')
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
    const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD~1'], {
      cwd: repo.dir,
    })
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
    const result = Bun.spawnSync(['bash', script, 'bogus'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(result.exitCode).toBe(2)
  })
})
