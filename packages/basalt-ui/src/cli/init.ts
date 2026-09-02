/**
 * `init` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only. Imports
 * the managed-file manifest engine back from `./index`, this package's shared CLI helpers, and the
 * oxlint-preset plugin reader from `./sync` (also called there).
 */
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import { deriveSpacing } from '../tokens'
import type { MergeLintResult, ScaffoldFlags } from './index'
import {
  MANIFEST_PATH,
  findBasaltInstall,
  managedFiles,
  mergeOxlintExtends,
  normalizeForLedger,
  patchPackageJson,
  pruneRetiredManagedFiles,
  readManifest,
  reconcileRoots,
  relativePosix,
  renderContext,
  reportPrune,
  resolvePeerFlags,
  resolvePlacement,
  rootsNotices,
  sha256,
  shippedAssetPath,
  unitState,
  writeFileEnsuringDir,
  writeUnit,
} from './index'
import { readOxlintPresetPlugins } from './sync'

/**
 * What a consumer LOSES by `init` keeping a file it already had — the half the aggregate
 * `20 written, 2 kept` never said. A kept `.oxlintrc.json` is the headline case: the framework's
 * whole lint half stays off, and every gate downstream reports green over it.
 */
const KEPT_FILE_COST: Record<string, string> = {
  '.oxlintrc.json':
    'the shipped oxlint preset (the basalt/* design rules AND the jsx-a11y / import / promise / ' +
    'unicorn plugins) is NOT active — nothing else turns it on, and every gate stays green ' +
    'without it. Re-run with `--merge-lint` to splice the extends in, or add it by hand.',
  'lefthook.yml':
    'the pre-commit oxlint / oxfmt / check-theme jobs are not wired — add `extends: ' +
    '[<preset>]` to your own file.',
  '.github/workflows/check.yml':
    'CI does not run check-theme or the sync drift gate — copy those steps into your own workflow.',
  '.oxfmtrc.json': 'your existing formatter config stands; basalt formats nothing on its own.',
  'DESIGN.md': 'the design brief Claude reads is yours, not the seeded one.',
}

/** Scaffold all managed files into the consumer repo, then write the manifest. Idempotent. Returns 0. */
export function init(cwd: string = process.cwd(), scaffoldFlags: ScaffoldFlags = {}): number {
  // ── Describe the repo BEFORE rendering anything ───────────────────────────
  // Every roots-derived seed (the CI oxfmt globs, DESIGN.md's series path, the default scan
  // exemption) renders from `basalt.roots`, so the key has to exist first. Writing it is what
  // stops a workspace repo scaffolding a guard that scans zero files while doctor reports green.
  const install = findBasaltInstall(cwd)
  if (install.dir === null) {
    console.error(
      `⚠ basalt-ui init: basalt-ui does not resolve from ${cwd} or any directory above it — the ` +
        'seeded `extends` paths and CI steps are being written against the repo root by assumption. ' +
        'Install basalt-ui here (or at the repo root) and re-run `basalt-ui init` so they resolve.',
    )
  }

  const rootsState = reconcileRoots(cwd, { write: true })

  // Built AFTER the roots patch — every roots-derived template variable reads the key just written.
  const ctx = renderContext(cwd)

  // `basalt-tokens.md` tells the consumer to wire `oxlint . && basalt-ui check-theme` into their
  // lint, and init's own closing message says to run check-theme next — but nothing ever added a
  // script, so the guard stayed manual for exactly as long as someone remembered it.
  const lintScript = `oxlint . && ${ctx.vars.BASALT_BIN} check-theme`
  const seededLintScript = patchPackageJson(cwd, (pkg) => {
    const scripts = (pkg['scripts'] ?? {}) as Record<string, unknown>
    if (scripts['lint:basalt'] !== undefined) return false
    pkg['scripts'] = { ...scripts, 'lint:basalt': lintScript }
    return true
  })

  const manifest = readManifest(cwd)
  const peers = resolvePeerFlags(cwd, scaffoldFlags)
  const placement = resolvePlacement(cwd)
  const files = managedFiles(peers, placement)

  const writtenFiles: string[] = []
  const keptFiles: string[] = []
  const missingSources: string[] = []

  for (const file of files) {
    const state = unitState(file, cwd, ctx)
    if (state.desired === null) {
      missingSources.push(file.source)
      continue
    }

    // Whole files (managed + seed) are skip-if-exists on init; a marker-spliced region always
    // inserts/updates itself inside its host file.
    const destExists = existsSync(resolve(cwd, file.dest))
    if (!file.markers && destExists) {
      // Already present — keep the consumer's copy untouched. Record the SHIPPED hash (normalized,
      // same ledger form `writeUnit` uses) so a later sync treats a pre-existing-but-different file
      // as locally drifted (skip unless --force), never silently clobbering a file the consumer
      // authored before init.
      manifest.files[file.dest] = sha256(normalizeForLedger(state.desired))
      keptFiles.push(file.dest)
      continue
    }

    const hash = writeUnit(file, cwd, state.desired)
    manifest.files[file.dest] = hash
    writtenFiles.push(file.dest)
  }

  // A re-`init` over an existing install reconciles the derived namespaces too — otherwise the only
  // route out of a retired rule file is `sync`, and `init` is what a consumer reaches for after an
  // upgrade that changed the doctrine set.
  const pruned = pruneRetiredManagedFiles(cwd, manifest, files)

  const mergeLint: MergeLintResult | null =
    scaffoldFlags.mergeLint === true ? mergeOxlintExtends(cwd, ctx.vars.OXLINT_PRESET_PATH) : null

  manifest.basaltVersion = ctx.vars.BASALT_VERSION
  manifest.spacingScale = { ...deriveSpacing(0).scale }
  writeFileEnsuringDir(resolve(cwd, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `basalt-ui init: ${writtenFiles.length} written, ${keptFiles.length} kept, manifest at ${MANIFEST_PATH}`,
  )
  reportPrune(pruned)
  if (missingSources.length > 0) {
    console.log(
      `basalt-ui init: ${missingSources.length} shipped asset(s) not present, skipped: ${missingSources.join(', ')}`,
    )
  }
  // Naming the kept files is the fix for the report's headline false-green: `20 written, 2 kept`
  // named neither the file nor the consequence, so a repo that already had an `.oxlintrc.json`
  // ended up with the framework's lint half off and every gate downstream reporting green.
  if (keptFiles.length > 0) {
    console.log(`\nKept (already present — basalt did not touch them):`)
    for (const dest of keptFiles) {
      const cost = KEPT_FILE_COST[dest]
      console.log(cost === undefined ? `  · ${dest}` : `  · ${dest} — ${cost}`)
    }
  }
  if (mergeLint !== null) {
    const mergeMessage: Record<MergeLintResult, string> = {
      added: `spliced "${ctx.vars.OXLINT_PRESET_PATH}" into the existing .oxlintrc.json extends`,
      already: '.oxlintrc.json already extends the shipped preset — nothing to do',
      absent:
        'no existing .oxlintrc.json to merge into (the seeded one already extends the preset)',
      unreadable: '.oxlintrc.json is not valid JSON — merge the extends entry by hand',
      'has-comments':
        '.oxlintrc.json carries comments; rewriting it would delete them (usually the reason each ' +
        `rule is off). Add "extends": ["${ctx.vars.OXLINT_PRESET_PATH}"] as the first entry by hand.`,
    }
    console.log(`basalt-ui init: --merge-lint — ${mergeMessage[mergeLint]}`)
  }
  const rootsMessages = rootsNotices(rootsState)
  for (const line of rootsMessages.log) console.log(`basalt-ui init: ${line}`)
  for (const line of rootsMessages.error) console.error(`⚠ basalt-ui init: ${line}`)
  if (seededLintScript) {
    console.log(`basalt-ui init: added the "lint:basalt" script (${lintScript}) to package.json.`)
  }
  // lefthook.yml / .github/workflows/check.yml are repo-root-shaped — neither lefthook nor GitHub
  // Actions reads config from anywhere but the repo root, so a package living in a subdirectory
  // skips both rather than relocating them into a spot nothing reads.
  if (!placement.isPackageRepoRoot) {
    console.log(
      `basalt-ui init: skipped lefthook.yml (this package is not the repo root — repo root ` +
        `detected at ${placement.repoRoot}) — lefthook only reads config at the repo root; extend ` +
        `${ctx.vars.LEFTHOOK_PRESET_PATH} from your root lefthook.yml instead, and give its ` +
        `check-theme command \`env: { BASALT_CWD: ${relativePosix(placement.repoRoot, cwd)} }\` ` +
        'so the guard runs where your basalt config actually lives.',
    )
    console.log(
      `basalt-ui init: skipped .github/workflows/check.yml (this package is not the repo root — ` +
        `repo root detected at ${placement.repoRoot}) — GitHub Actions only reads .github/ at the ` +
        `repo root; copy the steps from ${shippedAssetPath(install, placement.repoRoot, 'configs/check.yml')} ` +
        'into your root CI workflow instead.',
    )
  }
  if (placement.relocatedQueryClient !== null) {
    console.log(
      `basalt-ui init: skipped src/query-client.ts (found an existing query client at ` +
        `${relative(cwd, placement.relocatedQueryClient)}) — import it from there instead of ` +
        're-seeding at the original path.',
    )
  }
  // query-client.ts / __root.tsx reference the optional TanStack peers directly — seeding them
  // without the peer installed would ship an unresolved import. Hint how to opt in instead.
  if (!peers.hasQuery) {
    console.log(
      'basalt-ui init: skipped src/query-client.ts (no @tanstack/react-query dependency detected) — ' +
        'install it, or re-run with --with-query, to scaffold it.',
    )
  }
  if (!peers.hasRouter || !peers.hasQuery) {
    console.log(
      'basalt-ui init: skipped src/routes/__root.tsx (needs both @tanstack/react-router and ' +
        '@tanstack/react-query) — install both, or re-run with --with-router --with-query, to scaffold it.',
    )
  }
  // The guard-hook PreToolUse registration is NOT written automatically — add it manually to
  // .claude/settings.json so every Write/Edit/MultiEdit goes through the theme guard.
  console.log(
    `\nTheme guard hook: add to .claude/settings.json → hooks.PreToolUse to catch violations before they land:\n` +
      `  "hooks": {\n` +
      `    "PreToolUse": [\n` +
      `      {\n` +
      `        "matcher": "Write|Edit|MultiEdit",\n` +
      `        "hooks": [{ "type": "command", "command": "${ctx.vars.BASALT_BIN} guard-hook" }]\n` +
      `      }\n` +
      `    ]\n` +
      `  }`,
  )
  // `init` on an existing app is a LINT-DEBT EVENT, not a no-op — the shipped preset turns on whole
  // oxlint plugins the repo was never linted against, so previously-clean code lands with real
  // findings on the first run. Naming the plugins (derived from the preset, so the count can't
  // drift) is what turns that from a nasty surprise into a scheduled triage.
  const presetPlugins = readOxlintPresetPlugins(ctx.pkgRoot)
  if (presetPlugins.length > 0) {
    console.log(
      `\nLint debt: adopting the shipped oxlint preset on an EXISTING app is not a no-op — it turns ` +
        `on ${presetPlugins.length} plugins (${presetPlugins.join(', ')}) plus the basalt/* design ` +
        'rules, on code never linted against them. Run `oxlint .` now and triage the count before ' +
        'your next commit; turn a rule off in your own .oxlintrc.json with a written reason rather ' +
        'than blanket-disabling a plugin.',
    )
  }
  console.log(
    'Activate the hooks: `lefthook install` — the seeded lefthook.yml is inert until the git hooks ' +
      'are written, and looks configured either way.',
  )
  // First adoption on a previously guard-clean repo can surface a wall of findings (the 1.0 guard
  // adds several rule kinds beyond a legacy local guard) — steer toward tuning config, not mass-allow.
  console.log(
    `\nFirst run: run \`${ctx.vars.BASALT_BIN} check-theme\` next (or \`bun run lint:basalt\`), then ` +
      'tune the per-rule `basalt.*` config keys in package.json for anything that fires — do not ' +
      'mass-`theme-allow` findings. Then `basalt-ui doctor` to confirm the wiring actually took.',
  )
  return 0
}
