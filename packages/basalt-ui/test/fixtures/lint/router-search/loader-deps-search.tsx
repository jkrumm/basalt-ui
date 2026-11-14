// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/colour-literal.tsx).

// @invalid
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => search })

// @invalid
const route = createFileRoute('/runs')({
  loaderDeps: ({ search: s }) => {
    return s
  },
})

// @invalid
const route = createFileRoute('/runs')({ loaderDeps: (opts) => opts.search })

// @invalid
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => ({ search }) })

// @valid
const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => ({ range: search.range }),
})

// @valid
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => search.range })

// @valid
const route = createFileRoute('/runs')({ loaderDeps: pickDeps })

// @valid
const other = { loaders: ({ search }) => search }
