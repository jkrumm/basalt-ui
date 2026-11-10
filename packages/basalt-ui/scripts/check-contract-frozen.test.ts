import { afterEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { AMENDMENT_PREFIX, checkFrozen, main, PINS_PATH, sha256 } from './check-contract-frozen'
import type { Pins } from './check-contract-frozen'

const FILE = 'packages/basalt-ui/src/core/ports.ts'
const OTHER = 'packages/basalt-ui/src/cards/contract.ts'

function input(over: {
  pins: Pins
  basePins?: Pins | null
  files?: Record<string, string>
  amended?: boolean
}) {
  const files = over.files ?? { [FILE]: 'a', [OTHER]: 'b' }
  return {
    pins: over.pins,
    basePins: over.basePins === undefined ? over.pins : over.basePins,
    amended: over.amended ?? false,
    hashOf: (path: string) => (path in files ? sha256(files[path] as string) : null),
  }
}

describe('checkFrozen', () => {
  test('unchanged passes', () => {
    const pins = { [FILE]: sha256('a') }
    expect(checkFrozen(input({ pins }))).toEqual([])
  })

  test('an edited file fails naming it', () => {
    const pins = { [FILE]: sha256('a') }
    const failures = checkFrozen(input({ pins, files: { [FILE]: 'edited' } }))
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain(FILE)
    expect(failures[0]).toContain('differs from its pin')
  })

  test('an edited file fails even with an amendment commit when the pin was not updated', () => {
    const pins = { [FILE]: sha256('a') }
    expect(checkFrozen(input({ pins, files: { [FILE]: 'edited' }, amended: true }))).toHaveLength(1)
  })

  test('a missing pinned file fails naming it', () => {
    const pins = { [FILE]: sha256('a') }
    const failures = checkFrozen(input({ pins, files: {} }))
    expect(failures[0]).toContain(FILE)
    expect(failures[0]).toContain('missing')
  })

  test('a changed pin without an amendment fails', () => {
    const failures = checkFrozen(
      input({
        pins: { [FILE]: sha256('edited') },
        basePins: { [FILE]: sha256('a') },
        files: { [FILE]: 'edited' },
      }),
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain(FILE)
    expect(failures[0]).toContain('pin changed')
  })

  test('a changed pin with an amendment commit passes', () => {
    expect(
      checkFrozen(
        input({
          pins: { [FILE]: sha256('edited') },
          basePins: { [FILE]: sha256('a') },
          files: { [FILE]: 'edited' },
          amended: true,
        }),
      ),
    ).toEqual([])
  })

  test('an added key passes without an amendment', () => {
    expect(
      checkFrozen(
        input({
          pins: { [FILE]: sha256('a'), [OTHER]: sha256('b') },
          basePins: { [FILE]: sha256('a') },
        }),
      ),
    ).toEqual([])
  })

  test('a removed key fails naming it', () => {
    const failures = checkFrozen(
      input({
        pins: { [FILE]: sha256('a') },
        basePins: { [FILE]: sha256('a'), [OTHER]: sha256('b') },
      }),
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain(OTHER)
    expect(failures[0]).toContain('removed')
  })

  test('a removed key with an amendment commit passes', () => {
    expect(
      checkFrozen(
        input({
          pins: { [FILE]: sha256('a') },
          basePins: { [FILE]: sha256('a'), [OTHER]: sha256('b') },
          amended: true,
        }),
      ),
    ).toEqual([])
  })

  test('an absent base passes', () => {
    const pins = { [FILE]: sha256('a') }
    expect(checkFrozen(input({ pins, basePins: null }))).toEqual([])
  })
})

function git(root: string, ...args: string[]) {
  const res = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  })
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`)
}

function write(root: string, path: string, content: string) {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

/** `main` with its violation report muted. */
function run(root: string): number {
  const silence = console.error
  console.error = () => {}
  try {
    return main(['--root', root, '--base', 'master'])
  } finally {
    console.error = silence
  }
}

describe('main (git plumbing)', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  function pin(root: string, content: string) {
    write(root, FILE, content)
    write(root, PINS_PATH, JSON.stringify({ [FILE]: sha256(content) }))
  }

  /** A repo whose `master` holds the pinned contract, with a feature branch checked out. */
  function repo(): string {
    const root = mkdtempSync(join(tmpdir(), 'contract-frozen-'))
    roots.push(root)
    git(root, 'init', '-q', '-b', 'master')
    pin(root, 'v1')
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '-m', 'feat: contract')
    git(root, 'checkout', '-q', '-b', 'feature')
    return root
  }

  test('an untouched branch passes', () => {
    expect(run(repo())).toBe(0)
  })

  test('a contract edit with a moved pin fails without an amendment commit', () => {
    const root = repo()
    pin(root, 'v2')
    git(root, 'commit', '-q', '-am', 'feat: change the contract')
    expect(run(root)).toBe(1)
  })

  test('a contract edit with a moved pin passes with an amendment commit', () => {
    const root = repo()
    pin(root, 'v2')
    git(root, 'commit', '-q', '-am', `${AMENDMENT_PREFIX}: widen Phase`)
    expect(run(root)).toBe(0)
  })

  test('an amendment subject that does not start the line does not count', () => {
    const root = repo()
    pin(root, 'v2')
    git(root, 'commit', '-q', '-am', `feat: ${AMENDMENT_PREFIX}`)
    expect(run(root)).toBe(1)
  })

  test('a file edited without touching the pin fails', () => {
    const root = repo()
    write(root, FILE, 'sneaky')
    git(root, 'commit', '-q', '-am', 'feat: sneak')
    expect(run(root)).toBe(1)
  })

  test('a base without a pin file passes', () => {
    const root = repo()
    git(root, 'checkout', '-q', 'master')
    git(root, 'rm', '-q', PINS_PATH)
    git(root, 'commit', '-q', '-m', 'chore: drop pins')
    git(root, 'checkout', '-q', 'feature')
    pin(root, 'v2')
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '-m', 'feat: pin v2')
    expect(run(root)).toBe(0)
  })

  test('an unknown base ref passes the base comparison', () => {
    const root = repo()
    pin(root, 'v2')
    const silence = console.error
    console.error = () => {}
    try {
      expect(main(['--root', root, '--base', 'origin/nope'])).toBe(0)
    } finally {
      console.error = silence
    }
  })
})
