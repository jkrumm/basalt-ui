// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/colour-literal.tsx).

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
