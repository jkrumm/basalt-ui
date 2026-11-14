/** Which install root a project-scoped command run inside a workspace package reads — one answer for `doctor` and `sync`. */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { MANIFEST_PATH } from './index'

/** The nearest ANCESTOR of `dir` (exclusive) carrying a basalt manifest, or null. */
export function findManifestAbove(dir: string): string | null {
  let current = resolve(dir, '..')
  for (;;) {
    if (existsSync(resolve(current, MANIFEST_PATH))) return current
    const parent = resolve(current, '..')
    if (parent === current) return null
    current = parent
  }
}
