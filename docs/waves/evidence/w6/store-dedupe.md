# W6 evidence — the Table v9 Store dedupe (`docs/V2-SPEC.md` § 8, owner call 2)

Owner call 2 accepted Table v9's +4 070 B gzip on one condition: the `@tanstack/react-store` / `store`
copy is **shared**, not duplicated (+6 969 B otherwise). This file proves the condition in the tree and
in emitted bytes. Base: `master` @ `4c08dc0` (Table v9 is PR #145, first commit `4d83fdf`; the commit
before it is `ba8d2cf`). Tarball: `basalt-ui` 1.41.0 packed from `4c08dc0`.

## 1. Tree

`bun pm ls --all | grep -E "@tanstack/(react-)?store"`:

| Tree                                               | `react-store`                      | `store`               | Copies |
| -------------------------------------------------- | ---------------------------------- | --------------------- | ------ |
| repo @ `4c08dc0`                                   | 0.11.2                             | 0.11.2                | 1 + 1  |
| scratch install of the packed tarball (with peers) | 0.11.2                             | 0.11.2                | 1 + 1  |
| repo @ `ba8d2cf` (before PR #145), for contrast    | 0.11.2, 0.11.0 nested under Router | 0.11.2, 0.11.0 nested | 2 + 2  |

The scratch install is `bun add <tarball> vite@8.0.16 react react-dom @mantine/core @mantine/hooks
@tanstack/react-table@9.2.8 @tanstack/react-router @tanstack/react-hotkeys@0.13.0
@tanstack/react-virtual` in an empty directory outside the repo, the same shape as
`packages/basalt-ui/scripts/pack-test.sh`.

## 2. Bundle

Entry (`entry.tsx`, in the scratch consumer): `BasaltDataTable` + `createColumnHelper` from
`basalt-ui/table`, `createRouter`/`createRootRoute`/`RouterProvider` from `@tanstack/react-router`, and
`export const lazyHotkeys = () => import('@tanstack/react-hotkeys')`. Vite production build, app mode
(a lib build leaves `process.env.NODE_ENV` unreplaced and bundles both shim variants), React,
react-dom and `@mantine/*` external, as the W1 ledger § Bytes.

```bash
SD_ENTRY=$SCRATCH/consumer/entry.tsx SD_ROOT=$SCRATCH/consumer SD_OUT=$SCRATCH/out \
  $SCRATCH/consumer/node_modules/.bin/vite build -c $SCRATCH/vite.config.mjs
bun scripts/evidence/store-dedupe.ts $SCRATCH/out          # exits 1 unless one copy of each
```

`vite.config.mjs`: `root: SD_ROOT`, `build.outDir: SD_OUT`, `build.rollupOptions.input: SD_ENTRY`,
`preserveEntrySignatures: 'strict'`, `external: [/^react($|\/)/, /^react-dom($|\/)/, /^@mantine\//]`,
optional `resolve.alias` from `SD_ALIAS`.

`scripts/evidence/store-dedupe.ts` counts three markers that survive minification, found in the
installed source (`@tanstack/store@0.11.2` `dist/alien.js` and `dist/store.js`,
`use-sync-external-store@1.6` `cjs/…/with-selector.production.js`):

| Marker       | Pattern (whitespace-tolerant)                                      | One per copy of                               |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------- |
| `engine`     | `return { link, unlink, propagate, checkDirty, shallowPropagate }` | the reactive engine every Store/atom links to |
| `storeClass` | `this.setState = this.setState.bind(this)`                         | the `Store` constructor                       |
| `shim`       | `hasValue: !1, value: null`                                        | `useSyncExternalStoreWithSelector`            |

| Build                                         | `engine` | `storeClass` | `shim` | gzip B | Chunks |
| --------------------------------------------- | -------- | ------------ | ------ | -----: | -----: |
| shared (scratch tree above)                   | 1        | 1            | 1      | 77 553 |      3 |
| negative control (nested 0.11.0 under Router) | **2**    | 1            | 1      | 79 179 |      3 |
| same entry, both store packages external      | —        | —            | —      | 74 823 |      2 |

The negative control copies the pre-fix lockfile's shape: `@tanstack/react-router/node_modules/@tanstack/{react-store,store}`
and `@tanstack/router-core/node_modules/@tanstack/store`, all 0.11.0. It makes the check discriminating:
the second engine appears (in `entry.js`, next to the shared one in the `useSelector` chunk), the script
exits 1, and the total grows **+1 626 B**. That is less than the spike's +2 899 B because
Router 0.11.0 only carries the engine here (the `Store` class and the shim stay single: the shim is the
`use-sync-external-store` package, one file in both trees). Store plus shim cost **2 730 B** in the shared
build (77 553 − 74 823).

## 3. The real number

Gzip over `dist/**/*.js` (`zlib.gzipSync`, default level, the ledger's method), `bun run build` in
`apps/playground`, a worktree outside the checkout for `ba8d2cf`.

| Build                             | Total gzip B | Chunks | `engine` copies |
| --------------------------------- | -----------: | -----: | --------------- |
| playground @ `ba8d2cf` (Table v8) |    1 345 140 |    124 | 2               |
| playground @ `4c08dc0` (Table v9) |    1 347 813 |    125 | 1               |
| **delta**                         |   **+2 673** |     +1 |                 |

`./table` alone (entry = `BasaltDataTable` + `createColumnHelper`; v8 build installs `@tanstack/react-table@8.21.3`
and the `ba8d2cf` tarball, v9 build 9.2.8 and the `4c08dc0` tarball; same externals):

| Entry              | `ba8d2cf` (v8) | `4c08dc0` (v9) |      Delta |
| ------------------ | -------------: | -------------: | ---------: |
| `./table` alone    |         35 519 |         41 242 |     +5 723 |
| `./table` + Router |         61 558 |         64 987 | **+3 429** |

**Verdict: inside the accepted +4 070 B.** With Store shared with Router the package-level delta is
+3 429 B and the playground's is +2 673 B (it also drops the duplicate engine the `ba8d2cf` tree carried).
`./table` alone, with no Router to share with, is +5 723 B: that consumer pays for Store once, which is
the condition working as written (the +6 969 B figure is the doubled case).

## Guard

- `packages/basalt-ui/scripts/pack-test.sh` fails on more than one `react-store` or `store` version in
  the scratch tree (tree level).
- `scripts/evidence/store-dedupe.ts` (bundle level, unit-tested in `store-dedupe.test.ts`) fails on any
  marker count other than 1 in a built dist.
