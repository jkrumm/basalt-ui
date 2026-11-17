# basalt-ui layering and packaging: agent notes

The boundary protects **layering** (`tokens` is pure data that `charts` reads, so a chart cannot fork
the palette) and **packaging** (the dist entries resolve with only `react`/`react-dom` installed —
`scripts/check-dist-layering.mjs` walks their built dist graphs, and `scripts/pack-test.sh`'s
"charts/tokens-only resolution + render" step scratch-installs the tarball and SSR-renders
`basalt-ui/charts` + `basalt-ui/tokens` live). **No peer is required**: every peer is optional in
`peerDependenciesMeta` and `tests/required-peers.test.ts` asserts the empty required set.

The UI-free layering of `./charts`/`./tokens` is held by `scripts/check-dist-layering.mjs` on the built graph.
