/**
 * The `make evidence` lane contract. `scripts/evidence/index.ts` runs every lane and writes
 * `.evidence/<label>/<lane>.json` (gitignored) plus the committed summary md.
 */
export type LaneCtx = {
  /** Output label, e.g. `baseline-1.41`. */
  label: string
  /** `.evidence/<label>` — absolute, already created. */
  outDir: string
  /** Absolute origin of a served build of the playground (`vite preview` or static server). */
  baseUrl: string
  /** Absolute path of the playground `dist/` that is being served. */
  distDir: string
  /** Route paths under test: the `--routes` file, else derived from the playground's route files. */
  routes: string[]
  /** Launch Chrome via the layout harness's channel logic; the caller closes it. */
  openBrowser: () => Promise<import('playwright-core').Browser>
}

/** Flat, JSON-serialisable, deterministic key order. `summary` rows are what the md table shows. */
export type LaneResult = {
  lane: string
  summary: Array<{ metric: string; value: number | string; unit?: string }>
  /** Free-form detail, written to `<lane>.json`. */
  detail?: unknown
}

export type Lane = (ctx: LaneCtx) => Promise<LaneResult>
