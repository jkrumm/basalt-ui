/**
 * The empty tile's copy from the one string a host carries (`ChartState.empty`, `StatCard`'s
 * `emptyText`): the first sentence is the title (why it is empty), the rest the muted line (what to
 * do), as `EmptyState` reads them (SPEC § 6.11).
 */
export function splitEmptyCopy(label: string): { title: string; description: string | undefined } {
  const at = label.search(/[.!?](\s|$)/)
  if (at < 0) return { title: label, description: undefined }
  const rest = label.slice(at + 1).trim()
  const title = label.slice(0, at + (label[at] === '.' ? 0 : 1))
  return { title, description: rest === '' ? undefined : rest }
}
