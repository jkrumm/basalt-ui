// The `basalt` config shape and helpers, shared by the dispatcher and the commands. A leaf: it
// imports nothing from `./index`.

/** Shape of the optional `"basalt"` key in a consumer's package.json. */
export type BasaltConfig = {
  /**
   * The Vite app's directory relative to the install root, for a workspace monorepo whose manifest,
   * `.claude/` and AGENTS block live at the root. App-scoped checks (`tsconfig-base`, `app-wiring`)
   * and the router seeds target it. Default: the single workspace package that depends on basalt-ui
   * and has a Vite entry, else the root itself.
   *
   * @example
   * { app: 'apps/dashboard' }
   */
  app?: string
  /**
   * Declares this app package a second basalt install beside the repo's root-owned one, for the
   * sibling-app cutover (argo, shutterflow): its manifest, presets and AGENTS block stay in the
   * app directory, its rules and skills go to the repo root as `basalt-v3-*`, and it registers no
   * hook, lefthook or CI file. Temporary: the last cutover removes it
   * (docs/v3/concepts/migration-release.md 6.1).
   *
   * @example
   * { sibling: true }
   */
  sibling?: boolean
  /**
   * Declares the app renders no `BasaltShell` (a one-page app on `BasaltProvider` + `PageBar`).
   * `false` stops `init`/`sync` placing the nav and root-route seeds — they are a pair, the root
   * route imports the nav module — and retires their manifest entries. Default: `true`. Declared,
   * never inferred: a heuristic over the app's imports mis-reads aliased and deeply nested shells.
   * `doctor` warns when `false` is declared and the entry's imports render `<BasaltShell`.
   */
  shell?: boolean
  /** Source roots the seeds and the lint preset target. Default: `['src']`. Set explicitly for a monorepo layout. */
  roots?: string[]
  /** Earned accent hue recorded in DESIGN.md `{{ACCENT_HUE}}`. Default: `blue`. */
  accentHue?: string
  /**
   * Path of the consumer's series file (the `tokens:css --extra` input), for DESIGN.md `{{SERIES_MODULE_PATH}}`.
   * Default: `<first basalt.root>/basalt.tokens.ts` — see `resolveSeriesModulePath`.
   */
  seriesModulePath?: string
  /**
   * Declares an intentional `ai` package major-version skew, exempting `doctor`'s `ai-major-parity`
   * hard check. The value IS the reason; a bare `true` is rejected. Absent or empty: the skew still
   * fails. A reason with a skew: `doctor` passes and echoes both. A reason with NO skew: `doctor`
   * warns the exemption is stale.
   *
   * @example
   * { aiMajorSkewReason: 'apps/api pinned to ai@5, apps/dashboard on ai@7 — neutralized by a '
   *   + 'producer-side TransformStream in apps/api/src/stream-transform.ts' }
   */
  aiMajorSkewReason?: string
}

export const DEFAULT_ROOT = 'src'
export const DEFAULT_ROOTS = [DEFAULT_ROOT]

/**
 * The configured source roots, or the built-in default. The ONE resolution every roots-derived seed
 * reads — an empty `roots: []` falls back rather than resolving to nothing, because a bare `??`
 * would let `[]` through and render an empty oxfmt glob into the seeded CI, reproducing the exact
 * "matches zero files" break this derivation exists to prevent.
 */
export function resolveRoots(cfg: BasaltConfig): string[] {
  return cfg.roots?.length ? cfg.roots : DEFAULT_ROOTS
}

/** A clear message when `basalt.shell` is set to something other than a boolean, else null. */
export function shellConfigError(cfg: BasaltConfig): string | null {
  const shell: unknown = cfg.shell
  return shell === undefined || typeof shell === 'boolean'
    ? null
    : `basalt.shell must be a boolean (true | false), got ${JSON.stringify(shell)}.`
}
