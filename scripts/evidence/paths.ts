import { resolve } from 'node:path'
import { isInside } from './compare-board'

/** Shared roots for the design-parity harness: images and text are local (gitignored). */
export const REPO_ROOT = resolve(import.meta.dirname, '../..')
/** PNGs and `board.html`; gitignored (public repo, unlicensed benchmark). */
export const IMG_ROOT = resolve(REPO_ROOT, '.design-parity')
export const IMG_KEEL = resolve(IMG_ROOT, 'keel')
/** Local text artefacts: BENCHMARK.md, keel/*.{md,json}, <label>/compare.json (gitignored with `.evidence/`). */
export const PARITY_DIR = resolve(REPO_ROOT, '.evidence/design-parity')

/** Boards write images, so they must stay out of the text tree and inside this repo. */
export function assertOutDir(outDir: string): void {
  const dir = resolve(outDir)
  if (dir === PARITY_DIR || isInside(PARITY_DIR, dir)) {
    throw new Error(
      `--out ${dir} is under ${PARITY_DIR}: images must never be committed (use .design-parity/)`,
    )
  }
  if (dir === REPO_ROOT || !isInside(REPO_ROOT, dir)) {
    throw new Error(`--out ${dir} must be a directory inside the repo (${REPO_ROOT})`)
  }
}
