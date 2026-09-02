/**
 * `sync` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only. Imports
 * the managed-file manifest engine (`managedFiles`, `readManifest`, `writeUnit`, `reconcileRoots`,
 * …), the toolchain-seam inspectors (`inspectLefthookGate`, `basaltPresetEntry`), and project
 * resolution back from `./index`, this package's shared CLI helpers.
 */
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import { deriveSpacing } from '../tokens'
import {
  MANIFEST_PATH,
  basaltPresetEntry,
  classify,
  conflictingProfileFlags,
  declaredProfile,
  diffSummary,
  findBasaltInstall,
  inspectLefthookGate,
  isStringArray,
  managedFiles,
  normalizeForLedger,
  parseJsonc,
  pruneRetiredManagedFiles,
  readBasaltConfig,
  readIfExists,
  readManifest,
  readSource,
  reconcileRoots,
  relativePosix,
  renderContext,
  reportPrune,
  resolvePeerFlags,
  resolvePlacement,
  resolveProjectDir,
  rootsNotices,
  sha256,
  shippedAssetPath,
  unitState,
  writeFileEnsuringDir,
  writeUnit,
} from './index'

/** The oxlint plugins the shipped preset switches on — read from the preset, never restated. */
export function readOxlintPresetPlugins(pkgRoot: string): string[] {
  const raw = readSource(pkgRoot, 'configs/oxlint.json')
  if (raw === null) return []
  try {
    const plugins = (JSON.parse(raw) as { plugins?: unknown }).plugins
    return isStringArray(plugins) ? plugins : []
  } catch {
    return []
  }
}

export type SyncOptions = {
  force?: boolean
  check?: boolean
  /** The raw flag list, read for `--tokens-only` / `--framework` exactly as check-theme reads it. */
  flags?: readonly string[]
}

/**
 * The nearest ANCESTOR of `dir` (exclusive) carrying a basalt manifest, or null.
 *
 * `resolveProjectDir` resolves to exactly one directory — `BASALT_CWD` when set, else the
 * invocation cwd — and never walks. The shape that produced this function is the one that resolver
 * doesn't cover: a consumer standing in `apps/dashboard`, the package that actually depends on
 * basalt-ui, whose install lives at the repo root above it. With nothing walking up, `sync` read
 * "no manifest here" as "nothing scaffolded yet" and wrote a complete second consumer beside the
 * real one.
 */
/**
 * The sentence `sync` prints when the cwd carries no install but an ancestor does.
 *
 * Shared with `doctor` deliberately. The two commands already share `resolveProjectDir`, but not
 * the ADVICE: `sync` named the parent install (1.22.0's "stop scaffolding a second consumer" fix)
 * while `doctor`, in the same directory, kept prescribing `basalt-ui init` — so following doctor
 * literally performed the exact mistake that fix exists to prevent. One function, one sentence.
 */
export function parentInstallAdvice(cwd: string, parent: string, verb: string): string {
  return (
    `This repo's install is at ${relativePosix(cwd, parent)} (${parent}) — run ${verb} there, ` +
    'or set BASALT_CWD to it.'
  )
}

export function findManifestAbove(dir: string): string | null {
  let current = resolve(dir, '..')
  for (;;) {
    if (existsSync(resolve(current, MANIFEST_PATH))) return current
    const parent = resolve(current, '..')
    if (parent === current) return null
    current = parent
  }
}

/**
 * Reconcile managed files with the shipped versions via a sha256 three-way compare.
 *
 * - `--check` makes NO writes; exits non-zero if any managed file is out-of-date or locally drifted
 *   (a CI freshness gate), exit 0 when all current.
 * - `--force` overwrites locally-drifted files instead of skipping them.
 *
 * Runs against `resolveProjectDir(cwd)`, exactly as `check-theme` and `doctor` do — and then
 * REFUSES rather than scaffolding when the resolved project has no manifest. See
 * {@link findManifestAbove} for the failure that bought this: `sync` is the drift refresh and
 * `init` is the scaffold, so placing twenty files on a cwd that was never a consumer is a decision
 * `sync` does not get to make silently.
 */
export function sync(opts: SyncOptions = {}, invocationCwd: string = process.cwd()): number {
  const syncFlags = opts.flags ?? []
  if (conflictingProfileFlags(syncFlags)) {
    console.error('basalt-ui sync: --tokens-only and --framework are alternatives — pass one.')
    return 1
  }
  const project = resolveProjectDir(invocationCwd)
  const cwd = project.dir
  if (project.relocatedFrom !== null) {
    console.log(`basalt-ui sync: BASALT_CWD relocated from ${project.relocatedFrom} to ${cwd}.`)
  }

  // Profile before the refusal, because in a tokens-only consumer the refusal's own advice is
  // wrong: it names `basalt-ui init`, and `doctor` in the same directory at the same version says
  // in so many words that init is NOT the fix there — it places a Mantine doctrine the consumer
  // has no use for. Mirrors doctor's manifest row verbatim, and exits 0 so `sync --check` is
  // wirable into a tokens-only repo's CI (the one drift gate every other consumer runs).
  //
  // DECLARED, never inferred — the same asymmetry check-theme applies, for the same reason: the
  // answer SILENCES the whole reconciliation, and inferring it from a missing @mantine/core would
  // turn a framework consumer that keeps Mantine in a sibling package into a silent no-op.
  if (declaredProfile(readBasaltConfig(cwd), syncFlags) === 'tokens-only') {
    console.log(
      `basalt-ui sync: ${MANIFEST_PATH}: n/a — a tokens-only consumer has no scaffold to ` +
        'reconcile. The token layer is refreshed by re-running `basalt-ui tokens:css`, and ' +
        '`tokens:css --check` is its drift gate. Pass --framework to force the full profile.',
    )
    return 0
  }

  // The refusal runs BEFORE reconcileRoots, which WRITES `basalt.roots` into package.json — that
  // key is half the damage: a second `basalt` block means check-theme scans a different tree
  // depending on which directory it was invoked from.
  if (!existsSync(resolve(cwd, MANIFEST_PATH))) {
    const elsewhere = findManifestAbove(cwd)
    const wouldWrite = managedFiles(resolvePeerFlags(cwd, {}), resolvePlacement(cwd)).length
    console.error(
      `✖ basalt-ui sync: no ${MANIFEST_PATH} at ${cwd} — refusing to scaffold. ` +
        `\`sync\` refreshes an EXISTING basalt install; creating one is \`basalt-ui init\`'s ` +
        `decision, and continuing here would write ${wouldWrite} managed file(s) into this ` +
        'directory.' +
        (elsewhere === null
          ? ' No manifest exists at any ancestor either — run `basalt-ui init` here if this ' +
            'package really is meant to be a consumer.'
          : ` ${parentInstallAdvice(cwd, elsewhere, 'sync')}`),
    )
    return 1
  }

  // Before renderContext, which reads `basalt.roots` for the roots-derived template variables.
  const rootsState = reconcileRoots(cwd, { write: opts.check !== true })
  const ctx = renderContext(cwd)
  const manifest = readManifest(cwd)
  const peers = resolvePeerFlags(cwd, {})
  const placement = resolvePlacement(cwd)
  const files = managedFiles(peers, placement)

  let updated = 0
  // `created` and `recreated` were one counter, and `0 updated, 20 recreated` is what a full
  // scaffold printed — a word that means "it was here, it went missing, I put it back" describing
  // twenty files this directory never had. The ledger already knows which: an entry in
  // `manifest.files` is basalt saying it placed the file once.
  let created = 0
  let recreated = 0
  let skippedDrift = 0
  let staleForCheck = 0
  const driftLines: string[] = []
  const missingSources: string[] = []

  for (const file of files) {
    const state = unitState(file, cwd, ctx)
    if (state.desired === null) {
      missingSources.push(file.source)
      continue
    }

    const tracked = manifest.files[file.dest] !== undefined

    // `seed` is written once, then owned by the consumer — never reconciled, never reported.
    if (file.mode === 'seed') {
      if (state.current === null && !opts.check) {
        manifest.files[file.dest] = writeUnit(file, cwd, state.desired)
        if (tracked) recreated++
        else created++
      }
      continue
    }

    const kind = classify(state, manifest.files[file.dest])

    if (kind === 'current') {
      // On-disk bytes already equal `desired` exactly — record the ledger's normalized form
      // (not the raw bytes) so this entry keeps behaving like every other `writeUnit`-recorded
      // hash for a future classify() call.
      manifest.files[file.dest] = sha256(normalizeForLedger(state.desired))
      continue
    }

    if (kind === 'drifted' && !opts.force) {
      driftLines.push(diffSummary(file, state))
      staleForCheck++
      skippedDrift++
      continue
    }

    // missing | unchanged | (drifted && force) → write the shipped version.
    staleForCheck++
    if (opts.check) continue
    manifest.files[file.dest] = writeUnit(file, cwd, state.desired)
    if (kind !== 'missing') updated++
    else if (tracked) recreated++
    else created++
  }

  // Retired rules/skills: the derived namespaces (RULE_NAMES / SKILL_NAMES) are the only managed
  // sets whose MEMBERSHIP moves between versions, so this is where an upstream deletion reaches a
  // consumer. Counted into `staleForCheck` so `sync --check` is red until it is applied — a rule
  // file basalt stopped shipping is drift, and the agent goes on reading it otherwise.
  const pruned = pruneRetiredManagedFiles(cwd, manifest, files, {
    dryRun: opts.check === true,
    force: opts.force === true,
  })
  staleForCheck += pruned.removed.length + pruned.drifted.length

  // Placement notices — informational, never affect the exit code (a skipped tooling seed or a
  // relocated scaffold is a legitimate consumer choice, not a sync failure).
  if (!placement.isPackageRepoRoot) {
    console.log(
      `basalt-ui sync: skipped lefthook.yml (this package is not the repo root — repo root ` +
        `detected at ${placement.repoRoot}) — lefthook only reads config at the repo root; extend ` +
        'node_modules/basalt-ui/configs/lefthook.yml from your root lefthook.yml instead.',
    )
    console.log(
      `basalt-ui sync: skipped .github/workflows/check.yml (this package is not the repo root — ` +
        `repo root detected at ${placement.repoRoot}) — GitHub Actions only reads .github/ at the ` +
        'repo root; extend node_modules/basalt-ui/configs/check.yml from your root CI workflow instead.',
    )
  }
  if (placement.relocatedQueryClient !== null) {
    console.log(
      `basalt-ui sync: skipped src/query-client.ts (found an existing query client at ` +
        `${relative(cwd, placement.relocatedQueryClient)}) — import it from there instead of ` +
        're-seeding at the original path.',
    )
  }

  const rootsMessages = rootsNotices(rootsState)
  for (const line of rootsMessages.log) console.log(`basalt-ui sync: ${line}`)
  for (const line of rootsMessages.error) console.error(`⚠ basalt-ui sync: ${line}`)

  // The two `extends` seams sync does NOT own. Reported here because sync is the command an
  // UPGRADE runs, and an upgrade is exactly when a resolved path goes stale — 1.20.0 fixed the
  // paths `init` renders and reached no existing consumer at all. Informational: these are
  // consumer-owned files, and `doctor` is the gate that fails on them.
  const install = findBasaltInstall(cwd)
  const lefthookGate = inspectLefthookGate(placement.repoRoot)
  if (lefthookGate.kind === 'absent') {
    console.error(
      `⚠ basalt-ui sync: ${lefthookGate.file}: \`lefthook dump\` resolves the merged config and ` +
        'no pre-commit command runs check-theme — there is no pre-commit gate. Add ' +
        `"extends: [${shippedAssetPath(install, placement.repoRoot, 'configs/lefthook.yml')}]".`,
    )
  }
  const oxlintrcRaw = readIfExists(resolve(cwd, '.oxlintrc.json'))
  const oxlintEntry =
    oxlintrcRaw === null ? null : basaltPresetEntry(parseJsonc(oxlintrcRaw)?.['extends'])
  if (oxlintEntry !== null && !existsSync(resolve(cwd, oxlintEntry))) {
    console.error(
      `⚠ basalt-ui sync: .oxlintrc.json extends "${oxlintEntry}", which does not exist — oxlint ` +
        'refuses to start on a missing extends target (`NotFound`). Repoint it at ' +
        `"${shippedAssetPath(install, cwd, 'configs/oxlint.json')}".`,
    )
  }

  if (opts.check) {
    if (driftLines.length > 0) {
      console.error('basalt-ui sync --check: locally-drifted managed files:')
      for (const l of driftLines) console.error(l)
    }
    const retired = [...pruned.removed, ...pruned.drifted]
    if (retired.length > 0) {
      console.error(
        `basalt-ui sync --check: ${retired.length} retired rule/skill file(s) still present: ` +
          `${retired.join(', ')} — run \`basalt-ui sync\`.`,
      )
    }
    if (staleForCheck > 0) {
      console.error(`basalt-ui sync --check: ${staleForCheck} managed file(s) out of date.`)
      return 1
    }
    console.log('✓ basalt-ui sync --check: all managed files current.')
    return 0
  }

  manifest.basaltVersion = ctx.vars.BASALT_VERSION
  manifest.spacingScale = { ...deriveSpacing(0).scale }
  writeFileEnsuringDir(resolve(cwd, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `basalt-ui sync: ${updated} updated, ${created} created, ${recreated} recreated, ` +
      `${skippedDrift} skipped (drift), ${pruned.removed.length} retired.`,
  )
  reportPrune(pruned)
  if (driftLines.length > 0) {
    console.log('Locally-edited files were skipped (run with --force to overwrite):')
    for (const l of driftLines) console.log(l)
  }
  if (missingSources.length > 0) {
    console.log(
      `basalt-ui sync: ${missingSources.length} shipped asset(s) not present, skipped: ${missingSources.join(', ')}`,
    )
  }
  return 0
}
