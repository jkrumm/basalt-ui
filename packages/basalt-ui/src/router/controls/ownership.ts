/**
 * Param ownership of the stores, process-wide: a global's params are exclusive, a page store's are
 * kept apart by the route brand. Internal: `define.ts` claims at definition.
 */
import type { Scope } from './brand'
import type { AnyFieldSpec } from './field'
import { resetWidgetOwnersForTests } from './widgets'

/** Param to owning store, process-wide: a global's params are exclusive. */
const owners = new Map<string, { id: string; scope: Scope }>()

export function claimParams(id: string, scope: Scope, params: readonly string[]): void {
  const seen = new Set<string>()
  for (const param of params) {
    if (param.startsWith('w.')) {
      throw new Error(`basalt-ui: controls "${id}": "w." is a reserved param prefix ("${param}")`)
    }
    if (seen.has(param)) {
      throw new Error(`basalt-ui: controls "${id}": two fields own the param "${param}"`)
    }
    seen.add(param)
    // Page stores may share a name on different routes (argo's `window`, `from`, `to`); the brand
    // keeps their writes apart. A global's param is everywhere, so it is exclusive.
    const owner = owners.get(param)
    if (owner && owner.id !== id && (owner.scope === 'global' || scope === 'global')) {
      throw new Error(
        `basalt-ui: controls "${id}": the param "${param}" is already owned by "${owner.id}" ` +
          `(${owner.scope}); a global store's params are its own on every route`,
      )
    }
  }
  // A redefinition under the same id (HMR, a test) replaces its own claims.
  for (const [param, owner] of owners) if (owner.id === id) owners.delete(param)
  for (const param of params) owners.set(param, { id, scope })
}

/**
 * @internal Tests only. Bun runs every test file in one module registry, so a global defined by one
 * file would own its params in the next; a test file that defines throwaway stores resets first.
 */
export function resetControlsOwnersForTests(): void {
  owners.clear()
  resetWidgetOwnersForTests()
}

export function assertNoUrlThunk(id: string, fields: Record<string, AnyFieldSpec>): void {
  for (const [name, spec] of Object.entries(fields)) {
    if (!spec.lane.url || typeof spec.fallback !== 'function') continue
    throw new Error(
      `basalt-ui: controls "${id}": field "${name}" has a thunk fallback on the URL. ` +
        'validateSearch would evaluate it on every navigation and pin the result into links. ' +
        'Pass a value, or move the field off the URL ({ url: false }).',
    )
  }
}
