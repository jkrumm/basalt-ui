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

// @invalid
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => ({ ...search }) })

// @invalid
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => ({ ...search, extra: 1 }) })

// @valid
const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => ({ ...other, range: search.range }),
})

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

// @invalid
const route = createFileRoute('/runs')({
  loaderDeps: ({ search: { page, ...rest } }) => ({ page, ...rest }),
})

// @invalid
const route = createFileRoute('/runs')({ loaderDeps: ({ search: { page, ...rest } }) => rest })

// @valid
const route = createFileRoute('/runs')({
  loaderDeps: ({ search: { page, range } }) => ({ page, range }),
})
