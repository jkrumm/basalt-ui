/**
 * Area: agent — the shipped agent layer: rule lines in `agent/rules/*.md`.
 */
import { join } from 'node:path'

import { PKG_ROOT, totalLines, walkFiles } from '../lib'
import type { RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'rule-lines',
    order: 50,
    label: 'shipped rule lines (agent/rules/*.md)',
    // 2.0 target 450.
    ceiling: 272, // landed (W9): the shipped rules, 450 is the spec target; -5 (W31): +1 (ViewTabs law), -6 (one `paths:` glob per rule)
    measure: () => totalLines(walkFiles(join(PKG_ROOT, 'agent/rules'), /\.md$/)),
  },
]
