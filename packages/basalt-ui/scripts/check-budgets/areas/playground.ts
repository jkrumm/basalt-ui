/**
 * Area: playground — route files in `apps/playground/src/routes/**`.
 */
import { join } from 'node:path'

import { REPO_ROOT, walkFiles } from '../lib'
import type { RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'playground-routes',
    order: 100,
    label: 'playground route files (apps/playground/src/routes/**)',
    ceiling: 15,
    measure: () => walkFiles(join(REPO_ROOT, 'apps/playground/src/routes'), /\.tsx?$/).length,
  },
]
