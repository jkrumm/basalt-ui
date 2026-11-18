/**
 * Which unit-suite process runs first. A run that failed leaves the files of its failed process behind; the next run
 * starts with the processes that hold any of them, so a fix is proven in one process (seconds) before the rest of
 * the suite (minutes) runs. The order is the only thing it changes: every file still runs in the same run.
 */

/** The groups holding a file of `failedFiles` first, each part in its own order. */
export function failedFirst(groups: string[][], failedFiles: ReadonlySet<string>): string[][] {
  if (failedFiles.size === 0) return groups
  const hit = (group: string[]): boolean => group.some((file) => failedFiles.has(file))
  return [...groups.filter(hit), ...groups.filter((group) => !hit(group))]
}

/** The stored file list: anything that is not an array of strings is no memory of a failure. */
export function parseFailedFiles(raw: string): Set<string> {
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return new Set()
    return new Set(value.filter((file): file is string => typeof file === 'string'))
  } catch {
    return new Set()
  }
}
