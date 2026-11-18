/**
 * Area: playground — route files in `apps/playground/src/routes/**`.
 */
import { join, sep } from 'node:path'

import { REPO_ROOT, walkFiles } from '../lib'
import type { RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'playground-routes',
    order: 100,
    label:
      'playground route files (apps/playground/src/routes/**, less routes/cycle/, kit/, recipes/)',
    ceiling: 15,
    // routes/cycle/ holds the improvement cycles' builds (docs/v3/CYCLES.md), cycle evidence that
    // apps/playground/src/budget.test.ts also leaves out (shell-1.20, dogfood-1.20). routes/kit/ and
    // routes/recipes/ are the reference gallery, one page per capability (Issue 2280), not demo sprawl.
    measure: () =>
      walkFiles(join(REPO_ROOT, 'apps/playground/src/routes'), /\.tsx?$/).filter(
        (path) =>
          !['cycle', 'kit', 'recipes'].some((dir) =>
            path.startsWith(join(REPO_ROOT, 'apps/playground/src/routes', dir) + sep),
          ),
      ).length,
  },
]
