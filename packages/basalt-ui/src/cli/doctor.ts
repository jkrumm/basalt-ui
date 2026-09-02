/**
 * `doctor` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only.
 * Imports its shared plumbing (config/project resolution, the toolchain-seam inspectors, the
 * managed-file manifest path) back from `./index`, this package's shared CLI helpers.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import type { BasaltConfig } from './index'
import {
  MANIFEST_PATH,
  basaltBinCommand,
  basaltPresetEntry,
  conflictingProfileFlags,
  declaredProfile,
  findBasaltInstall,
  findRepoRoot,
  inspectLefthookGate,
  parseJsonc,
  readBasaltConfig,
  readIfExists,
  resolveProjectDir,
  shippedAssetPath,
} from './index'
import { findManifestAbove, parentInstallAdvice } from './sync'

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
 * First run of digits in a semver range string (`^7.0.15` → `7`), or null if there is none.
 *
 * Duplicated verbatim in `configs/oxlint-plugin.js` — that file must stay import-free from this
 * package (it loads via `jsPlugins` out of a consumer's node_modules, before this package's own
 * code is necessarily resolvable), so the duplication is structural, not an oversight. Keep both
 * copies in sync by hand; a future parsing fix (pre-release suffixes, say) must land in both.
 */
function majorOf(range: string | undefined): number | null {
  if (typeof range !== 'string') return null
  const match = range.match(/\d+/)
  return match === null ? null : Number(match[0])
}

/** The `ai` package's declared major major per dependency FIELD in `dir`'s own `package.json`. */
const AI_MAJOR_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const
type AiMajorField = (typeof AI_MAJOR_FIELDS)[number]

/**
 * The `ai` package's major per dependency field, all within THIS package.json — not walked across
 * workspace packages (that discovery was deleted with the rest of the multi-repo machinery). A
 * skew here is still real: a package declaring `dependencies.ai: 5` alongside
 * `peerDependencies.ai: 7` asks its own consumers for a different major than it itself runs.
 */
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

/**
 * Splits `basalt.aiMajorSkewReason` into a validated reason (or null) plus whether the key was
 * present at all but failed validation. A present-but-invalid value (anything other than a
 * non-empty string — including a bare `true`) is treated as absent for the pass/fail decision, same
 * as a missing key, but doctor's failure message still calls out that the key exists and is
 * malformed rather than silently falling back to the plain "no exemption" message — a forgotten key
 * and a broken one are different mistakes and deserve different guidance.
 */
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
 * Check a consumer repo's basalt integration and print a pass/warn report.
 *
 * Narrowed to what a single-directory-scoped run can actually verify — no workspace-glob walking,
 * no ascend/descend project discovery (see {@link resolveProjectDir}). Four checks, numbered in
 * the order they run and print:
 *
 * Hard failures (exit non-zero):
 *   1. `.basalt/manifest.json` exists (`basalt-ui init` was run).
 *   2. `oxlint-preset` ("rules in sync"): the consumer's `.oxlintrc.json` extends the shipped
 *      preset AND that path resolves. `init` keeps an existing config, so the framework's whole
 *      lint half can be silently off — one repo carried six real violations invisibly across five
 *      minors this way.
 *   4. `ai-major-parity`: within THIS package.json, `dependencies`/`devDependencies`/
 *      `peerDependencies` agree on the `ai` package's major. `basalt/ai-sdk-major` (the oxlint
 *      plugin rule) already catches this per linted FILE against its nearest package.json; this
 *      check exists for the shape a lint run cannot see — a package whose own manifest asks its
 *      dependents for one major while it itself runs another. A detected skew is exempt-able via
 *      `basalt.aiMajorSkewReason` (a non-empty reason string, not a bare `true`); missing or
 *      invalid still hard-fails as if the key were absent. A declared reason when the majors
 *      already agree warns that the exemption is stale.
 *
 * Warning (non-fatal):
 *   3. `lefthook-preset` ("lefthook wired"): a pre-commit command runs `check-theme`, read from
 *      `lefthook dump --format json` (resolves `extends`/`include`/`root:` the way lefthook itself
 *      does — see {@link inspectLefthookGate}). No lefthook config at all is a pass (a consumer may
 *      gate elsewhere); a config that resolves but wires no guard command warns; a config lefthook
 *      dump could not read at all (binary missing, or the dump failed) warns and says so, rather
 *      than inventing a verdict.
 *
 * Returns the exit code: 0 = all good, 1 = one or more hard failures.
 */
export function doctor(invocationCwd: string = process.cwd(), flags: string[] = []): number {
  if (conflictingProfileFlags(flags)) {
    console.error('basalt-ui doctor: --tokens-only and --framework are alternatives — pass one.')
    return 1
  }
  const project = resolveProjectDir(invocationCwd)
  const cwd = project.dir
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

  if (project.relocatedFrom !== null) {
    lines.push(`  → BASALT_CWD relocated from ${project.relocatedFrom} to ${cwd}.\n`)
  }

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

  // ── Hard check 2: the consumer's oxlint config extends the shipped preset ──
  // `init` KEEPS an existing `.oxlintrc.json`, so a repo can carry the whole scaffold with the
  // framework's lint half switched off and nothing anywhere saying so. One repo ran five minors
  // that way and surfaced six real `basalt/no-raw-font-size` errors the moment it was wired.
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
          '.oxlintrc.json does not parse as JSON/JSONC — cannot tell whether it extends the preset',
        )
      } else {
        const entry = basaltPresetEntry(parsed['extends'])
        const correct = shippedAssetPath(install, cwd, 'configs/oxlint.json')
        if (entry === null) {
          fail(
            '.oxlintrc.json does NOT extend the shipped preset — every basalt/* design rule is off ' +
              `and oxlint reports green without them. Add "extends": ["${correct}"], or re-run ` +
              '`basalt-ui init --merge-lint` to splice it in.',
          )
        } else if (!existsSync(resolve(cwd, entry))) {
          fail(
            `.oxlintrc.json extends "${entry}", which does not exist (${resolve(cwd, entry)}) — ` +
              'oxlint refuses to start on a missing extends target (`NotFound`), so nothing is ' +
              `linted at all. Repoint it at "${correct}", where basalt-ui actually resolves.`,
          )
        } else {
          pass(`.oxlintrc.json extends the shipped basalt-ui oxlint preset (${entry})`)
        }
      }
    }
  }

  // ── Warn check 3: the pre-commit hook actually runs the guard ──────────────
  // Read via `lefthook dump --format json`, which resolves `extends`/`include`/remote configs/
  // `root:` the way lefthook itself does — see {@link inspectLefthookGate}.
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

  // ── Hard check 4: ai package major version parity within THIS package.json ─
  // basalt/ai-sdk-major (the lint rule) is per-file against the NEAREST package.json, so a lint
  // run scoped to one workspace package only ever sees that package's own `ai` major and is
  // perfectly happy. This check reads the SAME package.json across its dependencies/
  // devDependencies/peerDependencies fields — the shape a lint run cannot see. Hard failure, not a
  // warning: a skewed pair throws at runtime, it doesn't just look different.
  // `basalt.aiMajorSkewReason` exempts an INTENTIONAL skew; a stale declaration (skew resolved,
  // reason still present) warns instead of passing silently.
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
            'not accepted); the exemption must carry a written reason.',
        )
      } else {
        fail(`ai package major version mismatch within this package.json: ${summary}`)
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

  // ── Report ──────────────────────────────────────────────────────────────────
  lines.push('')
  if (result.hardFailures === 0 && result.warnings === 0) {
    lines.push('All checks passed.')
  } else {
    const parts: string[] = []
    if (result.hardFailures > 0) parts.push(`${result.hardFailures} hard failure(s)`)
    parts.push(`${result.warnings} warning(s)`)
    lines.push(`${parts.join(', ')}.`)
  }
  lines.push('')

  if (result.hardFailures > 0) {
    console.error(lines.join('\n'))
    return 1
  }
  console.log(lines.join('\n'))
  return 0
}
