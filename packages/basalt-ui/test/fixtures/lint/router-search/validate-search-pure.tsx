// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ range: window.localStorage.getItem('range') ?? input.range }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ range: document.cookie, q: input.q }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ range: sessionStorage.getItem('r') }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ at: input.at ?? Date.now() }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ id: input.id ?? Math.random().toString(36) }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: z.object({ at: z.date().default(() => new Date()) }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ range: typeof input.range === 'string' ? input.range : '7d' }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: z.object({ at: z.coerce.date().optional(), id: z.string().optional() }),
})

// @valid
const route = createFileRoute('/runs')({ validateSearch: runsSearch })

// @valid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ at: input.at ? new Date(input.at) : undefined, ok: Date.parse('x') }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: (input) => ({ window: input.window, document: input.document }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ id: s.id ?? crypto.randomUUID() }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ id: s.id ?? globalThis.crypto.randomUUID() }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ n: s.n ?? crypto.getRandomValues(new Uint8Array(1))[0] }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ crypto: s.crypto, id: s.id }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ q: s.q ?? new URLSearchParams(location.search).get('q') }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ at: s.at ?? performance.now() }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ lang: s.lang ?? navigator.language }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ q: s.q ?? window.location.hash }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: ({ location }) => ({ location }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ ...s, from: history.state?.from }),
})

// @invalid
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ ...s, wide: screen.width > 1200 }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: ({ history, screen }) => ({ history, screen: screen ?? 'list' }),
})

// @valid
const location = useLocation()
const route = createFileRoute('/runs')({
  validateSearch: (s) => ({ at: s.at, path: location.pathname }),
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: (s) => {
    const location = String(s.location)
    return { location, performance: s.performance, navigator: s.navigator }
  },
})

// @valid
const route = createFileRoute('/runs')({
  validateSearch: (s) => {
    function pick(location) {
      return String(location)
    }
    return { at: pick(s.at) }
  },
})
