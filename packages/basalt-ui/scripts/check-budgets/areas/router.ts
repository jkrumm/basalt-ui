/**
 * Area: router — the `./router` subpath's size (docs/v3/ARCHITECTURE.md section 3), G1 freeze, re-seeded at G2. Seed:
 * the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6),
 * ratcheted down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled, whole barrel).
 */
import type { Raise, RowDef } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'router-subpath',
    order: 420,
    label: 'router, whole barrel (gzip B minus base0, src/router, peers bundled)',
    // 8852 B measured before v3 shell-i9; 11904 B with `routerDefaults` + `navTarget`: the link adapter
    // opens a target through the router's own `Link` (peers bundled), which is the cost of one cast
    // instead of a hand-rolled click, preload and href path.
    // 12045 B measured at the G2 freeze, re-seeded plus 5 percent.
    ceiling: 13000,
    measure: () => measureSource(reExportAll({ router: 'router/index' })),
  },
]

export const raises: readonly Raise[] = [
  {
    ceiling: 'router-subpath',
    from: 12500,
    to: 13000,
    consumer:
      '`defineNav`, `navTarget` and `routerDefaults` from `./router`, now landed: the G2 apps rb and obsidian build their nav and router options from them (docs/v3/concepts/shell-nav-router.md section 3.4); obsidian rides the same raise',
    repo: 'rb',
  },
  {
    ceiling: 'router-subpath',
    from: 9500,
    to: 12500,
    consumer:
      '`routerDefaults` and `navTarget` from `./router`: linewatch builds its router from `createBasaltRouter` (web/src/lib/router.ts), which these replace; the link adapter opens a target through the router `Link` (docs/v3/concepts/shell-nav-router.md section 3.4)',
    repo: 'linewatch',
  },
]
