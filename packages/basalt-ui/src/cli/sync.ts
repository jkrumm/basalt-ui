/** `sync` — split out of `src/cli/index.ts` (C2); shared plumbing is imported back from `./index`. */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { deriveSpacing } from '../tokens/core'
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
  noteRelocation,
  OXLINT_FILES,
  parseJsonc,
  placementNotices,
  pruneRetiredManagedFiles,
  readBasaltConfig,
  readIfExists,
  readManifest,
  readSource,
  reconcileRoots,
  relativePosix,
  renderContext,
  reportPrune,
  resolvePlacement,
  resolveProjectDir,
  routerSeedPlan,
  rootsNotices,
  sha256,
  shippedAssetPath,
  START_APP_NOTE,
  unitState,
  writeFileEnsuringDir,
  writeUnit,
} from './index'
import { findManifestAbove, installRootAbove } from './install-root'

/** The oxlint plugins the shipped preset switches on — read from the preset, never restated. */
export function readOxlintPresetPlugins(pkgRoot: string): string[] {
  const plugins = parseJsonc(readSource(pkgRoot, OXLINT_FILES.preset) ?? 'null')?.['plugins']
  return isStringArray(plugins) ? plugins : []
}

export type SyncOptions = {
  force?: boolean
  check?: boolean
  /** The raw flag list, read for `--tokens-only` / `--framework` exactly as check-theme reads it. */
  flags?: readonly string[]
}

/**
 * The sentence `sync` and `doctor` both print when the cwd carries no install but an ancestor does
 * (a package under a configured repo); one text, so neither prescribes a second `init`.
 */
export function parentInstallAdvice(cwd: string, parent: string, verb: string): string {
  return (
    `This repo's install is at ${relativePosix(cwd, parent)} (${parent}) — run ${verb} there, ` +
    'or set BASALT_CWD to it.'
  )
}

/**
 * Reconcile managed files with the shipped versions via a sha256 three-way compare.
 *
 * - `--check` makes NO writes; exits non-zero if any managed file is out-of-date or locally drifted
 *   (a CI freshness gate), exit 0 when all current.
 * - `--force` overwrites locally-drifted files instead of skipping them.
 *
 * Runs against `resolveProjectDir(cwd)` and REFUSES rather than scaffolding when that project has no
 * manifest: `sync` refreshes, `init` scaffolds.
 */
export function sync(opts: SyncOptions = {}, invocationCwd: string = process.cwd()): number {
  const syncFlags = opts.flags ?? []
  if (conflictingProfileFlags('sync', syncFlags)) return 1
  const project = resolveProjectDir(invocationCwd)
  noteRelocation('sync', project)
  // Inside the app package of a workspace the manifest is at the install root above: sync there.
  const installAbove = project.relocatedFrom === null ? installRootAbove(project.dir) : null
  const cwd = installAbove ?? project.dir
  if (installAbove !== null) {
    console.log(
      `basalt-ui sync: ${project.dir} is a package of the install at ${installAbove}; syncing there.`,
    )
  }

  // Profile before the refusal: init is NOT the fix for a tokens-only consumer. Declared, never
  // inferred (the answer silences the whole reconciliation); exits 0 so `sync --check` is wirable.
  if (declaredProfile(readBasaltConfig(cwd), syncFlags) === 'tokens-only') {
    console.log(
      `basalt-ui sync: ${MANIFEST_PATH}: n/a — a tokens-only consumer has no scaffold to ` +
        'reconcile. The token layer is refreshed by re-running `basalt-ui tokens:css`, and ' +
        '`tokens:css --check` is its drift gate. Pass --framework to force the full profile.',
    )
    return 0
  }

  const appError = resolvePlacement(cwd).appError
  if (appError !== null) {
    console.error(`✖ basalt-ui sync: ${appError}`)
    return 1
  }

  // Refuse BEFORE reconcileRoots, which writes `basalt.roots` into package.json.
  if (!existsSync(resolve(cwd, MANIFEST_PATH))) {
    const elsewhere = findManifestAbove(cwd)
    const refused = resolvePlacement(cwd)
    const { skipped: skippedSeeds } = routerSeedPlan(cwd, refused.appRel)
    const wouldWrite = managedFiles(refused).filter((f) => !skippedSeeds.has(f.dest)).length
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
  const placement = resolvePlacement(cwd)
  const { skip: seedSkip, skipped, shellLess } = routerSeedPlan(cwd, placement.appRel)
  const files = managedFiles(placement).filter((f) => !skipped.has(f.dest))

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

  // A code-routed app takes no router seeds: their manifest entries go; any file stays the consumer's.
  const isTracked = (d: string): boolean => manifest.files[d] !== undefined
  const codeRoutedSeeds = seedSkip === 'code-routed' ? [...skipped].filter(isTracked) : []
  if (codeRoutedSeeds.length > 0 && !opts.check) {
    for (const d of codeRoutedSeeds) delete manifest.files[d]
    console.error(
      `⚠ basalt-ui sync: code-routed app — dropped ${codeRoutedSeeds.join(', ')} from the manifest (any file is yours).`,
    )
  }

  // A shell-less app takes no nav seed: its manifest entry goes (so the next sync does not
  // resurrect it); any file stays the consumer's.
  const shellLessNav = shellLess ? [...skipped].filter(isTracked) : []
  if (shellLessNav.length > 0 && !opts.check) {
    for (const d of shellLessNav) delete manifest.files[d]
    console.error(
      `⚠ basalt-ui sync: shell-less app — dropped ${shellLessNav.join(', ')} from the manifest (any file is yours).`,
    )
  }

  // Placement notices — informational, never affecting the exit code, and PERMANENT: `--check`
  // hides them behind `--verbose` (it sits in consumers' CI chains, where three unchanging
  // "skipped" paragraphs per run are noise indistinguishable from drift) but still prints the COUNT.
  // Start added AFTER a pre-Start init: the old seeds are the consumer's now — left untouched, named.
  const startSkippedSeeds = seedSkip === 'start' ? [...skipped] : []
  const stale = startSkippedSeeds.filter((d) => isTracked(d) && existsSync(resolve(cwd, d)))
  const mounting = stale.filter((d) => !d.endsWith('nav.tsx'))
  const inert = stale.filter((d) => d.endsWith('nav.tsx'))
  const embedded =
    'Delete them and render <BasaltProvider><Outlet /></BasaltProvider> in the Start root route (embedded mode).'
  if (mounting.length > 0) {
    console.error(
      `⚠ basalt-ui sync: ${mounting.join(', ')} mount a second router inside this TanStack Start app; left untouched. ${embedded}`,
    )
  }
  if (inert.length > 0) {
    console.error(
      `⚠ basalt-ui sync: ${inert.join(', ')} was seeded before this became a Start app; it mounts nothing, so keep or delete it. Left untouched.`,
    )
  }
  if (seedSkip === 'start' && (!opts.check || syncFlags.includes('--verbose')))
    console.log(`basalt-ui sync: ${START_APP_NOTE}`)
  const placementSkips = placementNotices(cwd, placement)
  if (opts.check !== true || syncFlags.includes('--verbose')) {
    for (const line of placementSkips) console.log(`basalt-ui sync: ${line}`)
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
        `"${shippedAssetPath(install, cwd, OXLINT_FILES.preset)}".`,
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
    }
    if (staleForCheck > 0) return 1
    const n = placementSkips.length
    const skips = n === 0 ? '' : ` (${n} permanent placement skip(s) — --verbose for detail)`
    console.log(`✓ basalt-ui sync --check: all managed files current.${skips}`)
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
