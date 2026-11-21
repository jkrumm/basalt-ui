export type PeleModule = typeof import('pele/lazy')

/**
 * A load singleton over `importer`: every caller shares one attempt, and a peer that does not
 * resolve gives `null` and one dev-only console warning that names the install (and the swap for an
 * app that still has `beautiful-mermaid`), never a throw.
 */
export function createPeleLoader(
  importer: () => Promise<PeleModule>,
): () => Promise<PeleModule | null> {
  let promise: Promise<PeleModule | null> | null = null
  return () => {
    promise ??= importer().catch((error: unknown) => {
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn(
          '[basalt] MermaidDiagram: diagrams are off — the `pele` peer of basalt-ui/content did not load ' +
            `(${error instanceof Error ? error.message : String(error)}). Mermaid fences render as code. ` +
            'Install it with: bun add pele (an app that still has beautiful-mermaid: bun remove beautiful-mermaid)',
        )
      }
      return null
    })
    return promise
  }
}

/** The module loads on first use, one diagram type at a time (`pele/lazy`). */
export const loadPele = createPeleLoader(() => import('pele/lazy'))
