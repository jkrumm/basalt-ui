/**
 * `init` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds routing only. Imports
 * the managed-file manifest engine back from `./index`, this package's shared CLI helpers, and the
 * oxlint-preset plugin reader from `./sync` (also called there).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { deriveSpacing } from '../tokens/core'
import type { MergeLintResult, ScaffoldFlags } from './index'
import {
  MANIFEST_PATH,
  declaredProfile,
  readBasaltConfig,
  ROUTER_SEED_DESTS,
  findBasaltInstall,
  managedFiles,
  mergeOxlintExtends,
  normalizeForLedger,
  patchPackageJson,
  placementNotices,
  pruneRetiredManagedFiles,
  readManifest,
  reconcileRoots,
  renderContext,
  reportPrune,
  resolvePlacement,
  rootsNotices,
  sha256,
  unitState,
  writeFileEnsuringDir,
  writeUnit,
} from './index'
import { seedTsconfigExtends } from './doctor-upgrade'
import { readOxlintPresetPlugins } from './sync'

/**
 * What a consumer LOSES by `init` keeping a file it already had — the half the aggregate
 * `20 written, 2 kept` never said. A kept `.oxlintrc.json` is the headline case: the framework's
 * whole lint half stays off, and every gate downstream reports green over it.
 */
const KEPT_FILE_COST: Record<string, string> = {
  'lefthook.yml':
    'the pre-commit oxlint / oxfmt / check-theme jobs are not wired — add `extends: ' +
    '[<preset>]` to your own file.',
  '.github/workflows/check.yml':
    'CI does not run check-theme or the sync drift gate — copy those steps into your own workflow.',
  'src/main.tsx':
    'change it to match node_modules/basalt-ui/agent/templates/main.tpl: import ' +
    "'basalt-ui/styles.css'; `const router = createBasaltRouter({ routeTree })`; declare " +
    "`interface Register { router: typeof router }` in module '@tanstack/react-router'; render " +
    '`<BasaltProvider router={router} />`. Without them the seeded src/lib/nav.tsx fails tsc.',
  '.oxfmtrc.json': 'your existing formatter config stands; basalt formats nothing on its own.',
  'DESIGN.md': 'the design brief Claude reads is yours, not the seeded one.',
}

/** What happened to a kept `.oxlintrc.json`, by the merge result (null: `--no-merge-lint`). */
function oxlintrcCost(merge: MergeLintResult | null): string {
  if (merge === 'added' || merge === 'already') {
    return 'now extends the shipped preset: the basalt/* design rules and the jsx-a11y / import / promise / unicorn plugins are on.'
  }
  const why =
    merge === null ? 'init ran with --no-merge-lint' : 'init could not splice the extends in'
  return (
    `the shipped oxlint preset (the basalt/* rules, jsx-a11y, import, promise, unicorn) is NOT active: ${why}, ` +
    'nothing else turns it on, and every gate stays green without it. Add the `extends` by hand.'
  )
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
  const placement = resolvePlacement(cwd)
  // A tokens-only consumer has no use for the Mantine/React scaffolds (doctor skips them there too).
  const tokensOnly = declaredProfile(readBasaltConfig(cwd), []) === 'tokens-only'
  const routerSeeds: string[] = Object.values(ROUTER_SEED_DESTS)
  const files = managedFiles(placement).filter((f) => !(tokensOnly && routerSeeds.includes(f.dest)))

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
    scaffoldFlags.noMergeLint === true ? null : mergeOxlintExtends(cwd, ctx.vars.OXLINT_PRESET_PATH)

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
      const cost = dest === '.oxlintrc.json' ? oxlintrcCost(mergeLint) : KEPT_FILE_COST[dest]
      console.log(cost === undefined ? `  · ${dest}` : `  · ${dest} — ${cost}`)
    }
  }
  // `already` / `absent` need no words: the preset is on, or the seeded config just made it so.
  const mergeMessage: Partial<Record<MergeLintResult, string>> = {
    added: `spliced "${ctx.vars.OXLINT_PRESET_PATH}" into the existing .oxlintrc.json extends`,
    unreadable: '.oxlintrc.json is not valid JSON — merge the extends entry by hand',
    'has-comments':
      '.oxlintrc.json carries comments; rewriting it would delete them (usually the reason each ' +
      `rule is off). Add "extends": ["${ctx.vars.OXLINT_PRESET_PATH}"] as the first entry by hand.`,
  }
  const mergeLine = mergeLint === null ? undefined : mergeMessage[mergeLint]
  if (mergeLine !== undefined) console.log(`basalt-ui init: oxlint — ${mergeLine}`)
  const tsconfigLine = tokensOnly ? null : seedTsconfigExtends(cwd)
  if (tsconfigLine !== null) console.log(`basalt-ui init: ${tsconfigLine}`)
  const rootsMessages = rootsNotices(rootsState)
  for (const line of rootsMessages.log) console.log(`basalt-ui init: ${line}`)
  for (const line of rootsMessages.error) console.error(`⚠ basalt-ui init: ${line}`)
  if (seededLintScript) {
    console.log(`basalt-ui init: added the "lint:basalt" script (${lintScript}) to package.json.`)
  }
  // The permanent placement skips (repo-root-shaped tooling) — one text,
  // shared with `sync`. See {@link placementNotices}.
  for (const line of placementNotices(cwd, placement)) {
    console.log(`basalt-ui init: ${line}`)
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
