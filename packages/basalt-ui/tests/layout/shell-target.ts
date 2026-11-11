/**
 * Selects what the shell layout tests grade, by `LAYOUT_TARGET`.
 *
 * - `v3` (default): the empty v3 fixture (`fixture/v3`). Every case whose slots no registered
 *   scenario provides is SKIPPED, with one `skipped: <n> (<missing slots>)` line per describe.
 * - `v2`: the 2.x oracle. At module evaluation this adds a detached git worktree of `origin/v2` in a
 *   temp dir, installs its dependencies, and points the harness at ITS fixture. Each file calls
 *   `acquireShellTarget()`, which re-creates the worktree if needed and removes it in that file's
 *   `afterAll`, so nothing leaks.
 *
 * MUST BE THE FIRST IMPORT of every shell test file, and every such file calls `acquireShellTarget()`
 * before `initLayoutSuite()`. `harness/engine.ts` reads `LAYOUT_FIXTURE_ENTRY` / `LAYOUT_FIXTURE_HTML`
 * when a suite boots (v2: this module also sets them at evaluation).
 *
 * RUN v2 WITH AN EXPLICIT `shell-` PATH PREFIX, e.g.
 *   LAYOUT_TARGET=v2 bun --config=./packages/basalt-ui/tests/layout/bunfig.toml test --timeout 60000 \
 *     packages/basalt-ui/tests/layout/shell-
 * A whole-directory run (the root `test:layout` script only filters by `.layout.test.ts`) may load
 * another file first, and that file evaluates `engine.ts` with the default fixture paths before this
 * module can redirect it. That cannot be repaired from here, so the v2 target is only supported when
 * the first file bun loads is a shell one.
 */
import { afterAll, describe, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LAYOUT_TARGET } from './shell-slots'
import type { ShellSlot } from './shell-slots'
import { providedSlots } from './fixture/v3/registry'

type TestFn = (...args: Parameters<typeof test>) => void

function run(cmd: string[], cwd: string): string {
  const result = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode === 0) return result.stdout.toString().trim()
  throw new Error(
    `LAYOUT: \`${cmd.join(' ')}\` failed (exit ${result.exitCode}): ${result.stderr.toString()}`,
  )
}

let worktree: string | null = null
let repoRoot = ''

/** One path per process: bun shares this module (and `engine.ts`'s fixed paths) across files. */
const worktreePath = join(tmpdir(), `basalt-layout-v2-${process.pid}`)

/** Removes the 2.x worktree. Synchronous, idempotent, and safe to call when none exists. */
export function releaseShellTarget(): void {
  if (worktree === null) return
  const dir = worktree
  worktree = null
  Bun.spawnSync(['git', 'worktree', 'remove', '--force', dir], {
    cwd: repoRoot,
    stdout: 'ignore',
    stderr: 'ignore',
  })
  rmSync(dir, { recursive: true, force: true })
  Bun.spawnSync(['git', 'worktree', 'prune'], { cwd: repoRoot, stdout: 'ignore', stderr: 'ignore' })
}

function setupV2(): void {
  if (worktree !== null) return
  repoRoot = run(['git', 'rev-parse', '--show-toplevel'], import.meta.dir)
  const dir = worktreePath
  run(['git', 'worktree', 'add', '--detach', dir, 'origin/v2'], repoRoot)
  worktree = dir
  run(['bun', 'install', '--frozen-lockfile'], dir)
  const fixture = join(dir, 'packages/basalt-ui/tests/layout/fixture')
  const entry = join(fixture, 'main.tsx')
  const html = join(fixture, 'index.html')
  for (const file of [entry, html]) {
    if (!existsSync(file)) throw new Error(`LAYOUT: the 2.x oracle has no ${file}`)
  }
  process.env['LAYOUT_FIXTURE_ENTRY'] = entry
  process.env['LAYOUT_FIXTURE_HTML'] = html
}

/**
 * Points the engine at the v3 fixture for ONE file. The engine reads the two variables when it boots
 * a suite, and every layout file boots its own, so the variables are set per file and cleared in
 * that file's `afterAll`: a whole-directory run (`test:layout`) keeps every non-shell file on the
 * default fixture, whichever file bun loads first.
 */
function setupV3(): void {
  const fixture = new URL('./fixture/v3/', import.meta.url).pathname
  process.env['LAYOUT_FIXTURE_ENTRY'] = `${fixture}main.tsx`
  process.env['LAYOUT_FIXTURE_HTML'] = `${fixture}index.html`
  afterAll(() => {
    delete process.env['LAYOUT_FIXTURE_ENTRY']
    delete process.env['LAYOUT_FIXTURE_HTML']
  })
}

if (LAYOUT_TARGET === 'v2') setupV2()

/**
 * Call once per shell test file, before `initLayoutSuite()`. Bun evaluates this module once for all
 * files but runs each file's `afterAll`, so the 2.x worktree is created per file and removed in that
 * file's `afterAll`; `engine.ts` keeps the same (per-process) fixture path across all of them.
 * `bun test` does not reliably fire `process.on('exit')`, so the hook is the cleanup, not a backup.
 */
export function acquireShellTarget(): void {
  if (LAYOUT_TARGET !== 'v2') {
    setupV3()
    return
  }
  setupV2()
  afterAll(releaseShellTarget)
}

/**
 * A shell describe. On v2 it is a plain describe (skipped when Chrome is not `ready`). On v3 it runs
 * only when `needs` is non-empty and every slot in it is provided by the v3 fixture registry;
 * otherwise every case is registered skipped and one `skipped:` line is logged. An empty `needs`
 * counts as unprovided: a describe that names no slot has nothing v3 could serve yet.
 */
export function describeShell(
  ready: boolean,
  name: string,
  needs: readonly ShellSlot[],
  body: (test: TestFn) => void,
): void {
  if (LAYOUT_TARGET === 'v2') {
    const suite = ready ? describe : describe.skip
    suite(name, () => body(test))
    return
  }
  const provided = providedSlots()
  const missing = needs.filter((slotName) => !provided.has(slotName))
  if (ready && needs.length > 0 && missing.length === 0) {
    describe(name, () => body(test))
    return
  }
  let skipped = 0
  const skipTest: TestFn = (...args) => {
    skipped += 1
    test.skip(...args)
  }
  // A plain describe, not `describe.skip`: bun never runs a skipped describe's callback, so the
  // cases could not be counted. Every case inside is `test.skip`, so none executes. The callback
  // runs after this function returns, hence the log lives inside it.
  describe(name, () => {
    body(skipTest)
    // oxlint-disable-next-line no-console -- a skipped describe must announce what is missing
    console.log(
      `skipped: ${skipped} (${missing.length > 0 ? missing.join(', ') : 'no v3 scenario'})`,
    )
  })
}
