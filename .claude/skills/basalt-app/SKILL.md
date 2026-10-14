---
name: basalt-app
description: Scaffold, wire, verify or upgrade a basalt-ui app — `basalt-ui init`, `doctor`, `sync`, and the 1.x to 2.0 upgrade path.
when_to_use: User is adding basalt-ui to an app, wiring BasaltProvider / BasaltShell / the vite preset, upgrading basalt-ui, refreshing the shipped rules, or wiring a freshness check in CI. Also when /basalt-design reports no DESIGN.md.
---

Procedure only; the law is `.claude/rules/basalt-*.md`.

## Scaffold

1. `bun add basalt-ui && bunx basalt-ui init` (the only `bunx` call; use `./node_modules/.bin/basalt-ui` after).
2. Check the seeded `src/main.tsx` (`init` writes it when absent); `basalt-ui/styles.css` is the only stylesheet import:

```tsx
import 'basalt-ui/styles.css'
import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import { routeTree } from './routeTree.gen'

const router = createBasaltRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
// createRoot(root).render(<BasaltProvider router={router} />)
```

3. If you use `basalt-ui/controls-dates`, import `@mantine/dates/styles.layer.css` after `basalt-ui/styles.css` (core must precede dates in `@layer mantine`).
4. Install the peers of each subpath you import: read its `Install: bun add …` line in `node_modules/basalt-ui/llms.txt`.
5. In `vite.config.ts` spread `...basaltViteConfig({ port, apiTarget })` and register, in this order, `plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), ...basaltAppPlugin({ name, description })]`. Run `bun add -d @tanstack/router-plugin` and import `tanstackRouter` from `@tanstack/router-plugin/vite`.
6. Run `vite build` once so the plugin writes `src/routeTree.gen.ts`; commit it (`tsc -b` fails without it).
7. In `src/routes/__root.tsx`: `<BasaltShell brand={{ name }} nav={NAV}><Outlet /></BasaltShell>`; build `NAV` with `defineNav` in `src/lib/nav.tsx`.
8. Add a page as a file route, and link to it with `navTarget`:

```tsx
// src/routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  staticData: { title: 'Dashboard' }, // the breadcrumb and page title
  component: Dashboard,
})
// src/lib/nav.tsx item: { id: 'dashboard', label: 'Dashboard', link: linkOptions({ to: '/dashboard' }) }
// anywhere: <Link {...navTarget(NAV, 'dashboard')}>Dashboard</Link>
```

9. Fill in `DESIGN.md` (identity, series dictionary, deviations).

## Add a chat

1. Install the `basalt-ui/agent` peers from its `Install:` line in `llms.txt`.
2. Implement `ThreadsStore` (in memory here), pick a transport, compose the feed:

```tsx
type Thread = AgentThread<AgentPart>
const blank = (id: string): Thread => ({
  id,
  messages: [],
  outcome: null,
  status: 'pending',
  read: true,
  createdAt: 0,
  updatedAt: 0,
})

function useMemoryStore(): ThreadsStore<AgentPart> {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeId, select] = useState<string | null>(null)
  const patch = (id: string, f: (t: Thread) => Partial<Thread>) =>
    setThreads((all) => all.map((t) => (t.id === id ? { ...t, ...f(t) } : t)))
  return {
    threads,
    activeId,
    select,
    hydrated: true,
    error: undefined,
    create: () => {
      const id = crypto.randomUUID()
      setThreads((all) => [...all, blank(id)])
      return id
    },
    appendMessage: (id, m) => patch(id, (t) => ({ messages: [...t.messages, m] })),
    setOutcome: (id, outcome) => patch(id, () => ({ outcome })),
    setStatus: (id, status) => patch(id, () => ({ status })),
    markRead: (id) => patch(id, () => ({ read: true })),
    setResumeToken: () => {},
    remove: (id) => setThreads((all) => all.filter((t) => t.id !== id)),
    clear: () => setThreads([]),
  }
}

const transport = aiSdkTransport<AgentPart>({ api: '/api/chat' })
// a mock: { async *stream(input: string) { yield { id: crypto.randomUUID(), type: 'text' as const, text: input } } }

export function Chat() {
  const store = useMemoryStore()
  const { runs, start, stop } = useAgentThreadRuns({
    transport,
    store,
    resolveOutcome: (t) => ({
      title: 'Chat',
      summary: `${t.messages.length} turns`,
      status: 'done',
    }),
  })
  return (
    <ThreadFeed
      threads={store.threads}
      activeId={store.activeId}
      onSelect={store.select}
      renderRow={(t) => {
        const run = runs.get(t.id)
        const live = run === undefined ? {} : { liveParts: run.parts, liveStatus: run.status }
        return (
          <ThreadFeedRow
            key={t.id}
            thread={t}
            expanded
            onToggle={() => {}}
            {...live}
            onSend={({ text }) => start(t.id, text)}
            onStop={() => stop(t.id)}
          />
        )
      }}
    />
  )
}
```

3. `ThreadFeedRow` carries the `Composer`; tune it with `composerProps`.

## Verify

1. `./node_modules/.bin/basalt-ui doctor`; read to the last line. `SKIPPED` exits non-zero.
2. Fix every finding doctor prints, then rerun until it is clean.
3. `bun run lint:basalt` (`oxlint . && basalt-ui check-theme`); fix every finding at its source.
4. `bunx tsc --noEmit`; fix every error without `as never` or `any`.

## Refresh after any upgrade

1. `./node_modules/.bin/basalt-ui sync` (`--check` in CI, `--force` overwrites local edits).
2. Read its output: edited files are skipped, retired files are deleted, the AGENTS.md block is rewritten.

## Upgrade 1.x to 2.0

1. `bun add basalt-ui@latest`, then `./node_modules/.bin/basalt-ui sync`; it prunes retired managed files and rewrites the AGENTS.md block.
2. `./node_modules/.bin/basalt-ui doctor`; fix each of doctor's checks: a tsconfig that does not extend the shipped base, `basalt/*` rule ids the plugin no longer has, and imports of subpaths 2.0 dropped.
3. Work through `MIGRATING.md` § 2.0 (in the installed package): one row per removal or move; apply each that your code touches.
4. Run the Verify steps above.

## Not a React app

1. `bunx basalt-ui tokens:css --out src/tokens.css` and `bunx basalt-ui fonts:css --out src/fonts.css`.
2. Set `"basalt": { "profile": "tokens-only" }` in `package.json` by hand.
