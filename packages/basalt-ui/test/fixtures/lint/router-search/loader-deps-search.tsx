// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).

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

// @invalid
const route = { loaderDeps: (opts) => ({ ...opts.search }) }

// @invalid
const route = { loaderDeps: (opts) => ({ all: opts.search }) }

// @valid
const route = { loaderDeps: (opts) => ({ range: opts.search.range }) }

// @invalid
// @ts
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => search as RunsSearch })

// @invalid
// @ts
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => ({ ...(search as S) }) })

// @invalid
// @ts
const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => search satisfies S })

// @invalid
// @ts
const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => {
    const { page, ...rest } = search as RunsSearch
    return { page, ...rest }
  },
})

// @invalid
const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => Object.assign({}, search),
})

// @valid
// @ts
const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => ({
    page: (search as RunsSearch).page,
    q: (search as RunsSearch).q,
  }),
})

// @valid
// @ts
const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => {
    const { page } = search as RunsSearch
    return { page }
  },
})
