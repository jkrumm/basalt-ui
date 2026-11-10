/**
 * The numeric ceilings, enforced as one gate: public symbols, published subpaths, shipped rule
 * lines, spec prose, playground routes, the CLI's line count, the provider's first-paint bytes.
 *
 * This file is the entry only. Rows live one file per area in `check-budgets/areas/` (a new lane
 * adds its own file; `check-budgets/index.ts` finds it by scanning the directory). Ceilings only go
 * down: `check-budgets/ratchet.ts` compares each area file with `origin/master` and refuses a raise
 * that has no `raises` row naming a consumer repo other than argo.
 *
 * Every number prints beside its ceiling, in row order, before any exit. The default exits 1 on any
 * breach and is the gate: root `pre` runs it as `bun run check-budgets`. `--report` prints the same
 * table and exits 0 unconditionally.
 *
 * Usage: bun packages/basalt-ui/scripts/check-budgets.ts [--report]
 *
 * Importable without running: `runBudgets` and `isOwnGraphId` are the tested seam
 * (`check-budgets.test.ts`); the CLI half runs only under `import.meta.main`.
 */
import { runBudgets } from './check-budgets/index'

export { devOnlyChunks, featureRuntimeChunks, isOwnGraphId } from './check-budgets/bundle'
export { runBudgets }
export type { RunBudgetsOptions } from './check-budgets/index'

if (import.meta.main) {
  process.exit(await runBudgets({ reportOnly: process.argv.includes('--report') }))
}
