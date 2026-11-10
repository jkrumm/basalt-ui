/**
 * Area: docs — spec prose (docs/*.md, non-archive, excluding the ledger).
 */
import { join } from 'node:path'

import { REPO_ROOT, totalLines } from '../lib'
import type { RowDef } from '../lib'

/**
 * The APPEND-ONLY files under `docs/`, excluded from the prose budget because they are records
 * rather than doctrine.
 *
 * `MATURATION-LEDGER.md` is the only entry, and excluding it is a correction, not a concession:
 * the budget's job is to bound how much DOCTRINE the repo asks a reader to hold, and a ledger row
 * is the opposite of that — it is a finding, its evidence and its verdict, written down so the next
 * wave does not re-derive it. Counting it meant every wave that recorded its own outcome pushed the
 * SPECS closer to a ceiling they had not moved toward, and the only ways to stay green were to
 * delete history or raise the number. The 2026-09-09 chrome wave hit exactly that: +21 ledger lines
 * put a 2647/2650 budget at 2668 while no spec had grown at all.
 *
 * The ceiling below was lowered by the ledger's size at the moment of the split, so the remaining
 * specs are held to the same real bound they were before — the gate did not get looser.
 */
const APPEND_ONLY_DOCS = new Set(['MATURATION-LEDGER.md'])

export const rows: readonly RowDef[] = [
  // 2480 -> 3166 (W1, V2-SPEC landed beside the live 1.x specs) -> 2663 (W4 archived CHARTS-SPEC) -> 2650 (W5 folded the kind law into the code) -> 2432 (W11 archived the argo learnings, closed STATUS).
  // Each wave that archives a 1.x spec lowers it by that spec's lines; a wave that must grow the
  // spec raises it deliberately, in the commit that spends the lines.
  {
    id: 'spec-prose',
    order: 90,
    label: 'spec prose (docs/*.md, non-archive)',
    ceiling: 2432,
    measure: () => {
      const dir = join(REPO_ROOT, 'docs')
      const glob = new Bun.Glob('*.md')
      const specs = [...glob.scanSync({ cwd: dir, onlyFiles: true })]
        .filter((rel) => !APPEND_ONLY_DOCS.has(rel))
        .map((rel) => join(dir, rel))
      return totalLines(specs)
    },
  },
]
