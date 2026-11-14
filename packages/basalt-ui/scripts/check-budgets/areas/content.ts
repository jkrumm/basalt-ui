/**
 * Area: content — the `./content` subpath, G2 freeze. Value symbols are exact. Byte rows count the
 * static closure only (the entry chunk and the chunks it imports statically): shiki languages and
 * beautiful-mermaid are lazy chunks a consumer pays for on first use, and counting them reads 810 KB.
 * Seeds are the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section
 * 6), ratcheted down only (gzip B minus `base0`, peers bundled).
 */
import { gzipSync } from 'node:zlib'

import type { RowDef } from '../lib'
import { readSurface } from '../lib'
import { bundleSource, base0Gzip, reExportAll, reExportNamed } from '../ui-bundle'

const REGION_COMMENT = /^[ \t]*\/\/#(?:end)?region.*\n?/gm
const STATIC_IMPORT =
  /(?:^|[;}\s])(?:import|export)\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g

/** Gzip bytes of the entry chunk and every chunk it reaches by a static import, minus `base0`. */
async function staticClosure(source: string): Promise<number> {
  const app = await bundleSource(source)
  const byName = new Map(app.chunks.map((chunk) => [chunk.fileName, chunk]))
  const entry = app.chunks.find((chunk) => chunk.fileName.startsWith('basalt-ui'))
  if (entry === undefined) throw new Error('content budgets: the fixture build has no entry chunk')
  const seen = new Set<string>()
  const queue = [entry.fileName]
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    if (seen.has(name)) continue
    seen.add(name)
    for (const m of byName.get(name)?.code.matchAll(STATIC_IMPORT) ?? []) queue.push(m[1] ?? '')
  }
  const bytes = [...seen].reduce(
    (sum, name) =>
      sum + gzipSync((byName.get(name)?.code ?? '').replace(REGION_COMMENT, '')).length,
    0,
  )
  return bytes - (await base0Gzip())
}

export const rows: readonly RowDef[] = [
  {
    id: 'content-symbols',
    order: 450,
    label: 'public value symbols, ./content (exact, export-surface shard)',
    ceiling: 2,
    measure: () => readSurface()['./content']?.length ?? 0,
  },
  {
    id: 'content-subpath',
    order: 451,
    label: 'content, whole barrel static closure (gzip B minus base0, src/content, peers bundled)',
    // 74040 B measured.
    ceiling: 78000,
    measure: () => staticClosure(reExportAll({ content: 'content/index' })),
  },
  {
    id: 'content-markdown',
    order: 452,
    label: 'content Markdown static closure (gzip B minus base0, src/content, peers bundled)',
    // 74015 B measured. Informative target 60 KB (ai-mdx P8), not a pin; the seed is the measurement.
    ceiling: 78000,
    measure: () => staticClosure(reExportNamed('content/markdown', ['Markdown'])),
  },
]
