/**
 * `Catalog`, the `defineCatalog` product, stays assignable to the structural `CatalogLike` port
 * `expectCatalog` takes (docs/v3/concepts/ai-mdx.md section 4), checked by `tsc --noEmit`: a
 * `Catalog` that drifts from the port turns `satisfiesPort` into a compile error.
 */
import { expect, test } from 'bun:test'
import type { CatalogLike } from '../core/ports'
import type { Catalog } from './contract'

export const satisfiesPort: [Catalog] extends [CatalogLike] ? true : false = true

test('Catalog is assignable to CatalogLike', () => {
  expect(satisfiesPort).toBe(true)
})
