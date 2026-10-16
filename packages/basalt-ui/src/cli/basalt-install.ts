/** The resolved `node_modules/basalt-ui` a command acts on — a type-only leaf shared by `index` and `doctor-upgrade`. */
export type BasaltInstall = {
  /** Absolute path of the resolved `node_modules/basalt-ui` directory, or null when unresolvable. */
  dir: string | null
  /** The resolved copy's own version, or null. */
  version: string | null
  /** How it was found — `null` when unresolved. `'workspace'` is the isolated-linker case. */
  how: 'cwd' | 'ancestor' | 'workspace' | null
}
