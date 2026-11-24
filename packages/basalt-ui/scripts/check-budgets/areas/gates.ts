/**
 * Area: gates — the surface gates (`scripts/surface-gates.ts`): zero-ceiling rows whose value is the
 * violation count. One import path per symbol, a named consumer per symbol, the peer classes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SURFACES } from '../../../src/surfaces'
import {
  consumerViolations,
  duplicateSymbols,
  peerClassViolations,
  reachedPeers,
  surfacePeerDrift,
} from '../../surface-gates'
import { PKG_ROOT, Unmeasured, gate, readGatedSurface, readManifest } from '../lib'
import type { Raises, RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'duplicate-symbols',
    order: 60,
    label: 'symbols under more than one subpath (one import path per symbol)',
    ceiling: 3, // v3 state-1 wiring: `createChannel` (root, ./data) until the teardown drops the root one; v3 page-kit: `defineOverlays` (./commands, ./page) until the 2.x commands subpath retires; v3 ctl-2: `field` (./router, ./state) until the 2.x state subpath retires; ga-exports: `BasaltProvider` (., ./router), the root its home and `./router` re-exporting it beside `routerDefaults` (the entry `init` writes)
    measure: () => gate(duplicateSymbols(readGatedSurface())),
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
      return gate(consumerViolations(readGatedSurface(), consumers))
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
  {
    id: 'surface-peers',
    order: 85,
    label: 'SURFACES optionalPeers vs the peers each subpath graph reaches (llms.txt, info)',
    ceiling: 0,
    measure: () => {
      if (!existsSync(join(PKG_ROOT, 'dist/index.js'))) {
        throw new Unmeasured('dist/ missing, run `bun run build`')
      }
      return gate(surfacePeerDrift(reachedPeers(PKG_ROOT, readManifest()), SURFACES))
    },
  },
]

export const raises: Raises = {
  'duplicate-symbols': [
    {
      from: 0,
      to: 1,
      consumer:
        '`field` from `./router` (v3 defineControls) while linewatch dashboard-store.ts still imports the 2.x `./state` `field` for createSearchStore; drops back to 0 when ./state retires',
      repo: 'linewatch',
    },
    {
      from: 1,
      to: 2,
      consumer:
        '`defineOverlays` from `./page` (the typed overlay registry on `ui/dialog`) while shutterflow shell/overlays.tsx (5 entries) still imports the 2.x `./commands` one; drops back when ./commands retires',
      repo: 'shutterflow',
    },
    {
      from: 2,
      to: 3,
      consumer:
        '`createChannel` from `./data` while the software-factory console still imports the root one; drops back when the root export retires with the 2.x teardown',
      repo: 'software-factory',
    },
  ],
}
