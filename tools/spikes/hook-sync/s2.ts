/**
 * S2 (skills-agent-layer.md section 8): hook semantics. Everything here runs the stub shim
 * (`hook.mjs`) through /bin/sh with event JSON on stdin, the way Claude Code runs a hook command.
 * What a real session does with the exit code is documented behaviour (see the verdict doc), not
 * something this harness can observe: `modelActs` stays `needs owner run`.
 */
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HERE, progress, put, sh } from './util'
import type { Run } from './util'

const SHIM_SRC = join(HERE, 'hook.mjs')
const STOP_CAP = 8 // consecutive Stop blocks after which Claude Code ends the turn (docs)

/** The stub `basalt-ui` bin: `lint --hook <event>` with the event JSON on stdin. */
const BIN_SRC = `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const event = process.argv[4]
const ev = JSON.parse(fs.readFileSync(0, 'utf8'))
if (process.env.BIN_THROW) throw new Error('seeded crash')
const project = process.env.CLAUDE_PROJECT_DIR || ev.cwd
const srcDir = path.join(project, 'packages/app/src')
const all = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? all(path.join(d, e.name)) : [path.join(d, e.name)])
const files = event === 'stop' ? all(srcDir) : event === 'post-edit' ? [path.resolve(ev.cwd, ev.tool_input.file_path)] : []
const out = []
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\\n').forEach((line, i) => {
    if (/\\bp-4\\b/.test(line)) {
      out.push(path.relative(project, f) + ':' + (i + 1) + ' basalt/class-policy: p-4 on <Section>; Section owns spacing. Use gap on the parent, or eject (basalt-ui eject section --reason).')
    }
  })
}
if (out.length) { process.stderr.write(out.join('\\n') + '\\n'); process.exit(2) }
`

const OFFENDER = 'export const A = () => (\n  <Section className="p-4">hi</Section>\n)\n'
const CLEAN = 'export const B = () => <Section>hi</Section>\n'

export const hookCommand = {
  plain: (event: string) => `node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" ${event}`,
  /** Fail closed: any shim exit other than 0 and 2 (missing node, missing file) becomes exit 2. */
  wrapped: (event: string) =>
    `node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" ${event}; s=$?; case $s in 0|2) exit $s;; esac; ` +
    `echo 'basalt hook: the shim did not run (exit '$s'). Run bun install, then basalt-ui doctor.' >&2; exit 2`,
}

type ProjectOpts = { bin?: boolean; shim?: boolean; manifest?: boolean }

/** A scratch consumer: the bin sits beside the dependent package (bun's isolated linker), not at the root. */
export function buildProject(dir: string, opts: ProjectOpts = {}): void {
  const { bin = true, shim = true, manifest = true } = opts
  put(
    join(dir, 'package.json'),
    '{"name":"spike-consumer","private":true,"workspaces":["packages/*"]}\n',
  )
  put(join(dir, 'packages/app/package.json'), '{"name":"app"}\n')
  put(join(dir, 'packages/app/src/pages/ok.tsx'), CLEAN)
  put(join(dir, 'packages/app/src/pages/bad.tsx'), OFFENDER)
  if (manifest) put(join(dir, '.basalt/manifest.json'), '{"packageDir":"packages/app"}\n')
  if (shim) put(join(dir, '.basalt/hook.mjs'), readFileSync(SHIM_SRC, 'utf8'))
  if (bin) {
    const p = join(dir, 'packages/app/node_modules/.bin/basalt-ui')
    put(p, BIN_SRC)
    chmodSync(p, 0o755)
  }
}

const event = (cwd: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    session_id: 's1',
    transcript_path: '/dev/null',
    cwd,
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_use_id: 't1',
    ...extra,
  })

const edit = (cwd: string, file: string): string =>
  event(cwd, { tool_input: { file_path: file }, tool_response: { filePath: file } })

export type S2Result = Record<string, unknown> & { verdict: 'pending' | 'refuted' }

export function runS2(): S2Result {
  const root = mkdtempSync(join(tmpdir(), 'basalt-hook-sync-s2-'))
  try {
    return measure(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function measure(scratch: string): S2Result {
  let n = 0
  const fresh = (opts: ProjectOpts = {}): { dir: string; env: Record<string, string> } => {
    const dir = join(scratch, `p${n++} with space`)
    mkdirSync(join(dir, 'tmp'), { recursive: true })
    buildProject(dir, opts)
    return { dir, env: { CLAUDE_PROJECT_DIR: dir, TMPDIR: join(dir, 'tmp') } }
  }
  const post = (
    p: { dir: string; env: Record<string, string> },
    cwd: string,
    file: string,
    cmd = hookCommand.plain('post-edit'),
  ): Run => sh(cmd, { cwd, env: p.env, input: edit(cwd, file) })

  // 1. A seeded offender at PostToolUse: exit 2, finding on stderr, nothing on stdout.
  progress('s2: post-edit at the project root')
  const p = fresh()
  const abs = join(p.dir, 'packages/app/src/pages/bad.tsx')
  const atRoot = post(p, p.dir, abs)
  const clean = post(p, p.dir, join(p.dir, 'packages/app/src/pages/ok.tsx'))

  // 2. The session `cd`d into a workspace package: process cwd and event cwd move, CLAUDE_PROJECT_DIR does not.
  progress('s2: post-edit from a subdirectory cwd')
  const sub = join(p.dir, 'packages/app')
  const subAbs = post(p, sub, abs)
  const subRel = post(p, sub, 'src/pages/bad.tsx')
  const subClean = post(p, sub, 'src/pages/ok.tsx')
  const subdirCwdOk =
    [subAbs, subRel].every((r) => r.status === 2 && r.stderr.includes('src/pages/bad.tsx:2')) &&
    subClean.status === 0

  // 3. The bin missing (a fresh worktree before `bun install`), a crash in the bin, a bad event, bad stdin.
  progress('s2: failure modes of the shim')
  const noBin = fresh({ bin: false })
  const binMissing = post(noBin, noBin.dir, join(noBin.dir, 'packages/app/src/pages/bad.tsx'))
  const crash = sh(hookCommand.plain('post-edit'), {
    cwd: p.dir,
    env: { ...p.env, BIN_THROW: '1' },
    input: edit(p.dir, abs),
  })
  const unknownEvent = sh(`node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" pre-commit`, {
    cwd: p.dir,
    env: p.env,
    input: '{}',
  })
  const badStdin = sh(hookCommand.plain('post-edit'), { cwd: p.dir, env: p.env, input: 'not json' })
  const noManifest = fresh({ manifest: false })
  const manifestMissing = post(
    noManifest,
    noManifest.dir,
    join(noManifest.dir, 'packages/app/src/pages/bad.tsx'),
  )

  // 4. The shim itself cannot run: docs say every exit other than 0 and 2 is non-blocking, so the entry must close that.
  const noShim = fresh({ shim: false })
  const shimEdit = edit(noShim.dir, join(noShim.dir, 'packages/app/src/pages/bad.tsx'))
  const run = (cmd: string, env: Record<string, string | undefined>, cwd = noShim.dir): Run =>
    sh(cmd, { cwd, env, input: shimEdit })
  const noNode = { ...noShim.env, PATH: '/nonexistent' }
  const noProjectDir = { ...noShim.env, CLAUDE_PROJECT_DIR: undefined }
  const unquoted = sh('node $CLAUDE_PROJECT_DIR/.basalt/hook.mjs post-edit', {
    cwd: p.dir,
    env: p.env,
    input: edit(p.dir, abs),
  })
  const shimMissingExit = {
    shimFileGone: {
      plain: run(hookCommand.plain('post-edit'), noShim.env).status,
      wrapped: run(hookCommand.wrapped('post-edit'), noShim.env).status,
    },
    nodeGone: {
      plain: run(hookCommand.plain('post-edit'), noNode).status,
      wrapped: run(hookCommand.wrapped('post-edit'), noNode).status,
    },
    projectDirUnset: {
      plain: run(hookCommand.plain('post-edit'), noProjectDir).status,
      wrapped: run(hookCommand.wrapped('post-edit'), noProjectDir).status,
    },
    unquotedPathWithSpace: { plain: unquoted.status },
  }
  const wrappedPassesFinding = post(p, p.dir, abs, hookCommand.wrapped('post-edit'))
  const wrappedAddsNoise = !wrappedPassesFinding.stderr.includes('did not run')

  // 5. Stop: a persistent offender, the worst case where the agent never fixes it. Claude Code re-fires
  //    Stop with stop_hook_active=true after an exit 2 and ends the turn after STOP_CAP consecutive blocks.
  progress('s2: Stop loop simulation')
  const stopPolicy = (policy: string, turns: number, session: string | undefined) => {
    const q = fresh()
    const perTurn: number[] = []
    for (let t = 0; t < turns; t++) {
      let active = false
      let blocks = 0
      while (blocks < STOP_CAP) {
        const ev = event(q.dir, {
          hook_event_name: 'Stop',
          stop_hook_active: active,
          last_assistant_message: 'done',
          ...(session === undefined ? { session_id: undefined } : { session_id: session }),
        })
        const r = sh(hookCommand.plain('stop'), {
          cwd: q.dir,
          env: { ...q.env, HOOK_SPIKE_STOP_POLICY: policy },
          input: ev,
        })
        if (r.status !== 2) break
        blocks++
        active = true
      }
      perTurn.push(blocks)
    }
    return {
      policy,
      blocksPerTurn: perTurn,
      maxConsecutive: Math.max(...perTurn),
      sessionTotal: perTurn.reduce((a, b) => a + b, 0),
    }
  }
  const stopPolicies = (['none', 'flag', 'counter', 'both'] as const).map((pol) =>
    stopPolicy(pol, 4, 'sess-a'),
  )
  const counter = stopPolicies.find((s) => s.policy === 'counter')!
  const stopLoops = counter.maxConsecutive > 1
  // Counter without a session_id: every session shares one key, so a second session is silenced.
  const noId = fresh()
  const stopNoId = (): number => {
    const r = sh(hookCommand.plain('stop'), {
      cwd: noId.dir,
      env: { ...noId.env, HOOK_SPIKE_STOP_POLICY: 'counter' },
      input: event(noId.dir, { hook_event_name: 'Stop', session_id: undefined }),
    })
    return r.status ?? -1
  }
  const noIdBlocks = [stopNoId(), stopNoId()]
  const otherSession = stopPolicy('counter', 1, 'sess-b')

  // 6. Terse output: bytes the model receives for N findings in one file.
  progress('s2: output size')
  const sizes = [1, 10, 50, 500].map((count) => {
    const q = fresh()
    const file = join(q.dir, 'packages/app/src/pages/many.tsx')
    put(file, Array.from({ length: count }, () => '<Section className="p-4" />').join('\n') + '\n')
    const r = post(q, q.dir, file)
    return {
      findings: count,
      exit: r.status,
      lines: r.stderr.trimEnd().split('\n').length,
      chars: r.stderr.length,
    }
  })
  const oneFinding = sizes[0]!.chars

  const hookSideOk =
    atRoot.status === 2 &&
    atRoot.stderr.includes('basalt/class-policy') &&
    atRoot.stdout === '' &&
    clean.status === 0 &&
    subdirCwdOk &&
    [binMissing, crash, unknownEvent, badStdin, manifestMissing].every(
      (r) => r.status === 2 && r.stderr.includes('basalt hook:'),
    ) &&
    binMissing.stderr.includes('bun install')

  return {
    exit2Reaches: {
      hookSide: atRoot.status === 2 && atRoot.stdout === '' && atRoot.stderr.length > 0,
      stderrChars: atRoot.stderr.length,
      docs: 'PostToolUse exit 2: stderr is shown to Claude; the tool already ran; no other exit code feeds the model',
      modelActs: 'needs owner run',
    },
    subdirCwdOk,
    binMissingExit: binMissing.status,
    binMissingNamesFix: binMissing.stderr.includes('bun install'),
    failClosed: {
      crashExit: crash.status,
      unknownEventExit: unknownEvent.status,
      badStdinExit: badStdin.status,
      manifestMissingExit: manifestMissing.status,
    },
    shimMissingExit,
    wrappedEntryAddsNoNoise: wrappedAddsNoise,
    stopLoops,
    stop: {
      cap: STOP_CAP,
      policies: stopPolicies,
      counterWithoutSessionId: {
        secondCallExit: noIdBlocks[1],
        silencedNextSession: noIdBlocks[1] === 0,
      },
      counterNewSessionBlocksAgain: otherSession.sessionTotal === 1,
      stopHookActiveInEvent:
        'documented (Stop stdin carries stop_hook_active); not observable without a real session',
    },
    terse: {
      oneFindingChars: oneFinding,
      shimCaps: { lines: 10, chars: 2000 },
      docsCapChars: 10000,
      sizes,
    },
    shimLines: readFileSync(SHIM_SRC, 'utf8').trimEnd().split('\n').length,
    hookSideOk,
    verdict: !hookSideOk || stopLoops ? 'refuted' : 'pending',
  }
}

/** The fixture the owner runs a real interactive session against (`--owner-fixture <dir>`). */
export function writeOwnerFixture(dir: string): void {
  buildProject(dir)
  const cmd = (e: string): string =>
    `HOOK_SPIKE_LOG="$CLAUDE_PROJECT_DIR/.basalt/hook.log" ${hookCommand.wrapped(e)}`
  put(
    join(dir, '.claude/settings.json'),
    `${JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Edit|Write|MultiEdit',
              hooks: [{ type: 'command', command: cmd('post-edit') }],
            },
          ],
          Stop: [{ hooks: [{ type: 'command', command: cmd('stop') }] }],
        },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(join(dir, '.basalt/hook.log'), '')
}
