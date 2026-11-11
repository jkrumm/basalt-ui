/**
 * Area: gates — the surface gates (`scripts/surface-gates.ts`): zero-ceiling rows whose value is the
 * violation count. One import path per symbol, a named consumer per symbol, the peer classes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { consumerViolations, duplicateSymbols, peerClassViolations } from '../../surface-gates'
import { PKG_ROOT, Unmeasured, gate, readManifest, readSurface } from '../lib'
import type { Raise, RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'duplicate-symbols',
    order: 60,
    label: 'symbols under more than one subpath (one import path per symbol)',
    ceiling: 1, // v3 ctl-2: `field` (./router, ./state) until the 2.x state subpath retires
    measure: () => gate(duplicateSymbols(readSurface())),
  },
  {
    id: 'consumer-less-symbols',
    order: 70,
    label: 'public symbols without a named consumer (scripts/consumers.json)',
    ceiling: 0,
    measure: () => {
      const consumers = JSON.parse(
        readFileSync(join(PKG_ROOT, 'scripts/consumers.json'), 'utf8'),
      ) as Record<string, string>
      return gate(consumerViolations(readSurface(), consumers))
    },
  },
  {
    id: 'peer-classes',
    order: 80,
    label: 'peer classes (dist graph + .d.ts vs package.json)',
    ceiling: 0,
    // Needs the built dist: absent dist is `skipped`, which fails closed.
    measure: () => {
      if (!existsSync(join(PKG_ROOT, 'dist/index.js'))) {
        throw new Unmeasured('dist/ missing, run `bun run build`')
      }
      return gate(peerClassViolations(PKG_ROOT, readManifest()))
    },
  },
]

export const raises: readonly Raise[] = [
  {
    ceiling: 'duplicate-symbols',
    from: 0,
    to: 1,
    consumer:
      '`field` from `./router` (v3 defineControls) while linewatch dashboard-store.ts still imports the 2.x `./state` `field` for createSearchStore; drops back to 0 when ./state retires',
    repo: 'linewatch',
  },
]
