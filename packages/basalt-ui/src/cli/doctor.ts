/**
 * `doctor` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only.
 * Imports its shared plumbing (config/project resolution, the toolchain-seam inspectors, the
 * managed-file manifest path) back from `./index`, this package's shared CLI helpers.
 */
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import type { BasaltConfig } from './config'
import {
  AGENTS_MD,
  LEGACY_BLOCK_HOST,
  MANIFEST_PATH,
  basaltBinCommand,
  basaltPresetEntry,
  conflictingProfileFlags,
  declaredProfile,
  findBasaltInstall,
  findRepoRoot,
  importsAgentsMd,
  inspectLefthookGate,
  OXLINT_FILES,
  OXLINT_NO_BIN,
  oxlintBinResolves,
  parseJsonc,
  readBasaltConfig,
  readIfExists,
  readManifest,
  resolveAppDir,
  resolveProjectDir,
  ROUTER_SEED_DESTS,
  sameFile,
  scannableFiles,
  scanBlock,
  shippedAssetPath,
} from './index'
import { resolveRoots } from './config'
import {
  appWiringCheck,
  droppedSubpathsCheck,
  exactPeersCheck,
  retiredLintRulesCheck,
  tsconfigBaseCheck,
  unknownConfigKeysCheck,
} from './doctor-upgrade'
import type { Check } from './doctor-upgrade'
import { findManifestAbove, parentInstallAdvice } from './sync'

/** `sameFile`, but doctor never crashes: a path that cannot be inspected is "not provably the same". */
function isSameFile(a: string, b: string): boolean {
  try {
    return sameFile(a, b)
  } catch {
    return false
  }
}

export type DoctorResult = {
  /** Number of hard failures (exit non-zero). */
  hardFailures: number
  /** Number of warnings (informational only). */
  warnings: number
  /**
   * Number of checks that could not RUN (as opposed to ran and passed). Counted separately and
   * exits non-zero on its own: under bun's isolated linker `doctor` used to drop two of its five
   * checks and still print "All checks passed", which is the same false-green this whole surface
   * exists to remove. A check that cannot run is not a check that passed.
   */
  skipped: number
}

/**
 * First run of digits in a semver range (`^7.0.15` → `7`), or null. Duplicated in
 * `configs/oxlint-plugin.js`, which must stay import-free; keep both copies in sync.
 */
function majorOf(range: string | undefined): number | null {
  if (typeof range !== 'string') return null
  const match = range.match(/\d+/)
  return match === null ? null : Number(match[0])
}

/** The `ai` package's declared major major per dependency FIELD in `dir`'s own `package.json`. */
const AI_MAJOR_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const
type AiMajorField = (typeof AI_MAJOR_FIELDS)[number]

/** The `ai` major per dependency field of THIS package.json (not walked across workspaces). */
function aiMajorsAt(dir: string): Partial<Record<AiMajorField, number>> {
  const raw = readIfExists(resolve(dir, 'package.json'))
  if (raw === null) return {}
  try {
    const pkg = JSON.parse(raw) as Partial<Record<AiMajorField, Record<string, string>>>
    const out: Partial<Record<AiMajorField, number>> = {}
    for (const field of AI_MAJOR_FIELDS) {
      const major = majorOf(pkg[field]?.['ai'])
      if (major !== null) out[field] = major
    }
    return out
  } catch {
    return {}
  }
}

/** `basalt.aiMajorSkewReason` as a validated reason, plus whether the key was present but invalid. */
function resolveAiMajorSkewReason(cfg: BasaltConfig): {
  reason: string | null
  presentButInvalid: boolean
} {
  const raw = cfg.aiMajorSkewReason
  if (raw === undefined) return { reason: null, presentButInvalid: false }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return { reason: raw, presentButInvalid: false }
  }
  return { reason: null, presentButInvalid: true }
}

/**
 * Check a consumer repo's basalt integration and print a pass/warn report. One directory, no
 * workspace walking (see {@link resolveProjectDir}). Checks, in print order:
 *
 * Hard failures (exit non-zero):
 *   1. `.basalt/manifest.json` exists.
 *   2. `install-parity`: basalt-ui resolves, and its version matches the manifest's `basaltVersion`.
 *   3. `guard-scan`: `check-theme` would scan more than zero files (shares `scannableFiles`).
 *   4. `oxlint-preset`: `.oxlintrc.json` extends the shipped preset AND that path resolves.
 *   7. `ai-major-parity`: the `ai` major agrees across this package.json's dependency fields
 *      (exempt via `basalt.aiMajorSkewReason`; a stale reason warns).
 *   8-13. `tsconfig-base`, `retired-lint-rules`, `dropped-subpaths`, `app-wiring`, `exact-peers`,
 *      `config-keys` (./doctor-upgrade);
 *      a check that cannot run is SKIPPED and exits non-zero.
 *
 * Warning (non-fatal):
 *   5. `lefthook-preset`: a pre-commit command runs `check-theme` (read via `lefthook dump`).
 *   6. `claude-md`: a project-root `CLAUDE.md` that does not import `@AGENTS.md` suppresses it.
 *
 * Returns the exit code: 0 = all good, 1 = one or more hard failures or skipped checks.
 */
export function doctor(invocationCwd: string = process.cwd(), flags: string[] = []): number {
  if (conflictingProfileFlags('doctor', flags)) return 1
  const project = resolveProjectDir(invocationCwd)
  // Inside the app package of a monorepo the manifest is above: read the install root instead.
  const aboveRoot =
    project.relocatedFrom === null && !existsSync(resolve(project.dir, MANIFEST_PATH))
      ? findManifestAbove(project.dir)
      : null
  const insideApp =
    aboveRoot !== null &&
    (() => {
      const app = resolveAppDir(aboveRoot)
      return !('error' in app) && app.dir === project.dir
    })()
  const cwd = insideApp && aboveRoot !== null ? aboveRoot : project.dir
  const cfg = readBasaltConfig(cwd)
  const result: DoctorResult = { hardFailures: 0, warnings: 0, skipped: 0 }
  const lines: string[] = [`\nbasalt-ui doctor — ${cwd}\n`]

  function pass(msg: string): void {
    lines.push(`  ✓ ${msg}`)
  }
  function warn(msg: string): void {
    lines.push(`  ⚠ ${msg}`)
    result.warnings++
  }
  function fail(msg: string): void {
    lines.push(`  ✖ ${msg}`)
    result.hardFailures++
  }
  function skip(msg: string): void {
    lines.push(`  ? SKIPPED ${msg}`)
    result.skipped++
  }

  if (project.relocatedFrom !== null) {
    lines.push(`  → BASALT_CWD relocated from ${project.relocatedFrom} to ${cwd}.\n`)
  }

  if (insideApp)
    lines.push(`  → ${project.dir} is the app package; checking the install root ${cwd}.\n`)

  const app = resolveAppDir(cwd)
  const appDir = 'error' in app ? cwd : app.dir
  const profile = declaredProfile(cfg, flags)
  if (profile === 'tokens-only') {
    lines.push(
      '  profile: tokens-only — checking the token layer only. `basalt-ui init` is NOT the fix\n' +
        '  here, it places a Mantine doctrine you have no use for. Pass --framework to force the\n' +
        '  full profile.\n',
    )
  }

  // ── Hard check 1: manifest exists ──────────────────────────────────────────
  const manifestAbs = resolve(cwd, MANIFEST_PATH)
  const manifestExists = existsSync(manifestAbs)
  // Non-null ⇒ this directory is a package UNDER a configured repo, not an unscaffolded consumer.
  // Every remedy below that would otherwise say "run `basalt-ui init`" points at the parent
  // instead — see {@link parentInstallAdvice}.
  const parentInstall = manifestExists ? null : findManifestAbove(cwd)
  if (profile === 'tokens-only') {
    pass(`${MANIFEST_PATH}: n/a — a tokens-only consumer has no scaffold to reconcile`)
  } else if (manifestExists) {
    pass(`${MANIFEST_PATH} exists`)
  } else if (parentInstall !== null) {
    fail(
      `${MANIFEST_PATH} missing here, but this is not an unscaffolded consumer. ` +
        `${parentInstallAdvice(cwd, parentInstall, 'doctor')} \`basalt-ui init\` is NOT the fix: ` +
        'it would scaffold a SECOND consumer beside the real one.',
    )
  } else {
    fail(`${MANIFEST_PATH} missing — run \`basalt-ui init\` to scaffold the consumer repo`)
  }

  const install = findBasaltInstall(cwd)

  // ── App placement: the agent layer is at the root, the app is where `resolveAppDir` says ────
  if ('error' in app) {
    fail(`app-dir: ${app.error}`)
  } else if (app.rel !== '') {
    pass(`app-dir: the app is ${app.rel} (agent layer and manifest stay at the install root)`)
    const ledger = readManifest(cwd).files
    for (const seed of Object.values(ROUTER_SEED_DESTS)) {
      if (ledger[seed] !== undefined && existsSync(resolve(cwd, seed))) {
        warn(
          `app-dir: ${seed} was seeded at the install root by an earlier \`sync\`, but the app is ` +
            `${app.rel} — it is dead code there. Delete it (\`sync\` seeds ${app.rel}/${seed} instead).`,
        )
      }
    }
  }

  // ── Hard check 2: install matches the manifest, and doctor says WHERE (the AGENTS-block's claim)
  const manifestVersion = profile === 'tokens-only' ? undefined : readManifest(cwd).basaltVersion
  const at = install.dir === null ? '' : `${relative(cwd, install.dir)} (${install.version})`
  if (install.dir === null) {
    fail(
      'install-parity: basalt-ui does not resolve here, above, or in a sibling workspace package. ' +
        'Fix: `bun add basalt-ui`.',
    )
  } else if (manifestVersion === undefined || install.version === manifestVersion) {
    const matches = manifestVersion === undefined ? '' : " and matches the manifest's basaltVersion"
    pass(`basalt-ui resolves at ${at}${matches}`)
  } else {
    fail(
      `install-parity: basalt-ui resolves at ${at}, but ${MANIFEST_PATH} was last written by ` +
        `${manifestVersion} — the managed layer is from a different release than the code. Run ` +
        '`basalt-ui sync` (or `bun install`, if the lockfile is what is stale).',
    )
  }

  // ── Hard check 3: the guard sees files — zero-file roots are a green guard enforcing nothing ──
  const scanned = profile === 'tokens-only' ? null : scannableFiles(cwd, cfg).length
  if (scanned === null) {
    pass('guard-scan: n/a — a tokens-only consumer runs the token lane, not the file walk')
  } else if (scanned === 0) {
    fail(
      'guard-scan: `check-theme` would scan ZERO files here — either `basalt.roots` points at ' +
        'paths that do not exist, or this is not the package the config lives in (BASALT_CWD, ' +
        'else the cwd; nothing is inferred). Fix: set `"basalt": { "roots": ["src"] }` in package.json.',
    )
  } else {
    pass(`guard-scan: check-theme covers ${scanned} file(s) under ${resolveRoots(cfg).join(', ')}`)
  }

  // ── Hard check 4: the consumer's oxlint config extends the shipped preset ──
  // `init` KEEPS an existing `.oxlintrc.json`, so the framework's lint half can be silently off.
  if (profile === 'tokens-only') {
    pass('oxlint-preset: n/a — the shipped preset is a Mantine/React preset')
  } else {
    const oxlintrcRaw = readIfExists(resolve(cwd, '.oxlintrc.json'))
    if (oxlintrcRaw === null) {
      fail(
        '.oxlintrc.json missing — the shipped oxlint preset (the basalt/* design rules) is not ' +
          'active. ' +
          (parentInstall === null
            ? 'Run `basalt-ui init` to seed it.'
            : `${parentInstallAdvice(cwd, parentInstall, 'doctor')} The preset is seeded once, at ` +
              'the install — not per package.'),
      )
    } else {
      // JSONC: oxlint accepts comments and real consumer configs carry them.
      const parsed = parseJsonc(oxlintrcRaw)
      if (parsed === null) {
        fail(
          '.oxlintrc.json does not parse as JSON/JSONC — cannot tell whether it extends the preset. ' +
            'Fix the syntax error, then re-run `basalt-ui doctor`.',
        )
      } else {
        const entry = basaltPresetEntry(parsed['extends'])
        const correct = shippedAssetPath(install, cwd, OXLINT_FILES.preset)
        if (entry === null) {
          fail(
            '.oxlintrc.json does NOT extend the shipped preset — every basalt/* design rule is off ' +
              `and oxlint reports green without them. Add "extends": ["${correct}"], or re-run ` +
              '`basalt-ui init` to splice it in (or add it by hand).',
          )
        } else if (!existsSync(resolve(cwd, entry))) {
          fail(
            `.oxlintrc.json extends "${entry}", which does not exist (${resolve(cwd, entry)}) — ` +
              'oxlint refuses to start on a missing extends target (`NotFound`), so nothing is ' +
              `linted at all. Repoint it at "${correct}", where basalt-ui actually resolves.`,
          )
        } else if (!oxlintBinResolves(cwd)) {
          warn(`.oxlintrc.json extends the shipped preset (${entry}), but ${OXLINT_NO_BIN}`)
        } else {
          pass(`.oxlintrc.json extends the shipped basalt-ui oxlint preset (${entry})`)
        }
      }
    }
  }

  // ── Warn check 5: the pre-commit hook actually runs the guard ──────────────
  // Read via `lefthook dump --format json` (see {@link inspectLefthookGate}).
  const repoRoot = findRepoRoot(cwd)
  const lefthookGate =
    profile === 'tokens-only' ? { kind: 'n/a' as const } : inspectLefthookGate(repoRoot)
  const lefthookCorrect = shippedAssetPath(install, repoRoot, 'configs/lefthook.yml')
  if (lefthookGate.kind === 'n/a') {
    pass('lefthook-preset: n/a — a tokens-only consumer wires its own hooks')
  } else if (lefthookGate.kind === 'no-file') {
    pass(`lefthook-preset: n/a — no lefthook config at ${repoRoot}`)
  } else if (lefthookGate.kind === 'wired') {
    pass(`${lefthookGate.file}: \`lefthook dump\` shows a pre-commit command running check-theme.`)
  } else if (lefthookGate.kind === 'absent') {
    warn(
      `${lefthookGate.file}: \`lefthook dump\` resolves the merged config and NO pre-commit ` +
        'command runs check-theme — the theme guard is not gating commits. Add ' +
        `"extends: [${lefthookCorrect}]", or your own command running ` +
        `\`${basaltBinCommand(install, cwd)} check-theme\`.`,
    )
  } else {
    warn(
      `${lefthookGate.file}: \`lefthook dump\` could not be run or parsed here (lefthook may not ` +
        'be installed) — treat this check as advisory. Verify by running `lefthook dump` yourself.',
    )
  }

  // ── Warn check 6: a project-root CLAUDE.md that shadows AGENTS.md ───────────
  // The managed block lives in AGENTS.md. Claude Code loads a repo-root AGENTS.md directly, but ANY
  // CLAUDE.md in or above the cwd suppresses it unless that file imports `@AGENTS.md` — so a
  // leftover CLAUDE.md means the block (and the rest of AGENTS.md) is not loaded, whether or not it
  // still carries a block. A symlink to AGENTS.md is one file and is fine. Warn only: what else
  // CLAUDE.md holds is the consumer's.
  const legacyHost = resolve(cwd, LEGACY_BLOCK_HOST)
  const legacy = profile === 'tokens-only' ? null : readIfExists(legacyHost)
  if (legacy !== null && !isSameFile(legacyHost, resolve(cwd, AGENTS_MD))) {
    const scan = scanBlock(legacy)
    const issues: string[] = []
    if (scan.problem !== null) {
      issues.push(`has a malformed basalt block (${scan.problem}) — fix it by hand, then \`sync\``)
    } else if (scan.region !== null) {
      issues.push(
        `still carries a stale basalt block — delete it by hand; \`sync\` keeps ${AGENTS_MD} current`,
      )
    }
    if (!importsAgentsMd(legacy)) {
      issues.push(
        `does not import \`@${AGENTS_MD}\`, so Claude Code loads it INSTEAD of ${AGENTS_MD} and the ` +
          `basalt block never reaches the agent — move its content into ${AGENTS_MD} and delete it, ` +
          `or add \`@${AGENTS_MD}\``,
      )
    }
    if (issues.length > 0) warn(`${LEGACY_BLOCK_HOST} ${issues.join('; and ')}.`)
  }

  // ── Hard check 7: ai package major version parity within THIS package.json ─
  // basalt/ai-sdk-major is per-file against the NEAREST package.json; this reads one package.json
  // across its dependency fields. Hard failure: a skewed pair throws at runtime. An intentional skew
  // is exempt via `basalt.aiMajorSkewReason`; a stale reason warns.
  const aiMajors = aiMajorsAt(cwd)
  const aiEntries = AI_MAJOR_FIELDS.filter((field) => aiMajors[field] !== undefined).map(
    (field) => ({ field, major: aiMajors[field] as number }),
  )
  const { reason: aiMajorSkewReason, presentButInvalid: aiMajorSkewReasonInvalid } =
    resolveAiMajorSkewReason(cfg)
  if (aiEntries.length > 0) {
    const distinctMajors = new Set(aiEntries.map((entry) => entry.major))
    if (distinctMajors.size > 1) {
      const summary = aiEntries.map((entry) => `${entry.field}@ai${entry.major}`).join(', ')
      if (aiMajorSkewReason !== null) {
        pass(
          `ai package major version mismatch within this package.json: ${summary} — exempted via ` +
            `basalt.aiMajorSkewReason: "${aiMajorSkewReason}"`,
        )
      } else if (aiMajorSkewReasonInvalid) {
        fail(
          `ai package major version mismatch within this package.json: ${summary} — ` +
            'basalt.aiMajorSkewReason is present but is not a non-empty string (a bare `true` is ' +
            'not accepted). Fix: set it to a non-empty reason string, or align the majors.',
        )
      } else {
        fail(
          `ai package major version mismatch within this package.json: ${summary}. Fix: align ` +
            'every field of this package.json on one `ai` major.',
        )
      }
    } else {
      const [major] = distinctMajors
      if (aiMajorSkewReason !== null) {
        warn(
          `basalt.aiMajorSkewReason ("${aiMajorSkewReason}") is declared but the ai package major ` +
            `already agrees within this package.json (ai@${major}) — the exemption is no longer ` +
            'needed and can be deleted.',
        )
      } else {
        pass(`ai package major is consistent within this package.json (ai@${major})`)
      }
    }
  } else {
    pass('ai-major-parity: this package.json declares no ai dependency — nothing to compare')
  }

  // ── Hard checks 8-13: strictness and the 1.x → 2.0 upgrade path (./doctor-upgrade) ──────────
  if (profile === 'tokens-only') {
    pass(
      'tsconfig-base / retired-lint-rules / dropped-subpaths / app-wiring: n/a — a tokens-only consumer',
    )
  } else {
    const upgrade: [string, Check][] = [
      ['tsconfig-base: tsconfig.json extends the shipped preset', tsconfigBaseCheck(appDir)],
      [
        'retired-lint-rules: .oxlintrc.json sets no retired basalt/* rule',
        retiredLintRulesCheck(cwd, install),
      ],
      [
        'dropped-subpaths: no import of a basalt-ui subpath the install lacks',
        droppedSubpathsCheck(cwd, cfg, install),
      ],
      [
        'app-wiring: the entry mounts BasaltProvider and the router tree is generated',
        appWiringCheck(appDir),
      ],
      ['exact-peers: installed exact-pinned peers match basalt-ui', exactPeersCheck(cwd, install)],
      [
        'config-keys: the basalt config block sets only keys basalt-ui reads',
        unknownConfigKeysCheck(cwd),
      ],
    ]
    for (const [ok, check] of upgrade) {
      if (check === null) pass(ok)
      else if ('fail' in check) fail(check.fail)
      else skip(check.skip)
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  lines.push('')
  if (result.hardFailures === 0 && result.warnings === 0 && result.skipped === 0) {
    lines.push('All checks passed.')
  } else {
    const parts: string[] = []
    if (result.hardFailures > 0) parts.push(`${result.hardFailures} hard failure(s)`)
    if (result.skipped > 0)
      parts.push(`${result.skipped} SKIPPED (a check that cannot run is not a pass)`)
    parts.push(`${result.warnings} warning(s)`)
    lines.push(`${parts.join(', ')}.`)
  }
  lines.push('')

  if (result.hardFailures > 0 || result.skipped > 0) {
    console.error(lines.join('\n'))
    return 1
  }
  console.log(lines.join('\n'))
  return 0
}
