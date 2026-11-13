# Basalt UI v3 — owner's brief (ground truth for every research and design agent)

Today is 2026-11-09. Distilled from the owner's dictated brief. Evidence and plans get tracked in the
repo (owner decision: git history helps). Owner cleared `~/IuRoot/**` patterns and code for it. The
repo is public, so secrets, tokens, real IPs and internal hostnames still never land in a tracked file.

## The decision

Basalt UI v3 is a **full rewrite from Mantine v9 to shadcn/ui** (Base UI primitives, Tailwind v4).
Not only to have the shadcn components, but to own the implementations and be able to bend them
exactly to our needs. Mantine has been the limiting factor. Treat it as a true rewrite: re-think every
concept, take nothing by default, slim down, and come out with a better product than went in. It does
not have to be perfect on the first pass; everything can still change. Charting stays **TanStack
Charts only**.

## What basalt-ui is (and must stay)

Not a component library: an **enforced framework for good UI**. The differentiators the owner loves:

- App shell and wiring: shell, sidebar, how desktop transforms to mobile, grouped composites.
- One chart system with a shared toolkit.
- **Strict lint rules** so the framework cannot be misused.
- **Shipped agent skills and rules**: how to use basalt-ui, how to build good UI, counter-steering
  AI slop, so agents produce sustainable UIs. Skills teach; rules guarantee.
- It should be nearly impossible to end up with an unprofessional result, on mobile or desktop.

## Visual and product target

Data-dense professional dashboards. Strong components, unified spacing, a good warm-gray image (not
too dark, not too light, good contrast), professional blues, colour only where it has earned its place
(never playful or childish). Fonts, colour basics and the concepts carry over and get improved.
Inspiration is in `docs/v3/inspo/` and the factory console's stat card, which the owner
explicitly wants: icon + title + subtitle header, an inset panel with value, delta badge, comparison
line, sparkline or bars with axis labels, then a footer of two stats.

## Needs to cover (a mature enterprise data-dense frontend)

App shell, layout, navigation; router wiring; forms; client state, URL state, localStorage state,
server state and keeping it fresh; persisted user settings synced to the server; form drafts that
survive leaving and reloading; notifications; global state; page state; central query fetching;
refetching, polling, SSE, WebSockets; virtual lists; SSR and hydration must be allowed; performance;
DX and UX. Site-wide (global) controls and local controls bound to the router so state lives in the
right place. Sidebars, badges, notifications, inner sidebars and controls for sub-items. Rich cards
that carry their own controls or bind to global ones and render sparklines of any form (bar, graph,
line). Kanban cards. Charts, graphs, styled tooltips. AI streaming, strong MDX components and the
wiring that makes components available to AI agents (epos teamchat and https://tuffui.com/ are the
references).

**Data table is a headline item.** Today every app effectively builds its own; it is neither mature
nor responsive. TanStack Table integration with direct filtering, sorting, selection, multiple views,
responsive transformation for phones. Learn from the best public implementations.

Each area requires the answer: **what we implement, how we guarantee it (rules), how we teach it
(skills), and what we leave open to the consumer.** Consumers have highly individual needs; we want to
help all of them while enforcing one look and language. Take-what-you-want must still yield a unified
result.

## Who we learn from

- Consumers on basalt-ui: argo (largest, uses the most concepts), rb, linewatch (no shell, only
  components, rules, setup), finances, image-gateway, email-gateway, rollhook, weatherorb,
  basalt-ui-obsidian, shutterflow (Tauri, top controls and sidebars, deep rendering UIs; on 1.40.3).
- Static sites that cannot consume our tokens today: jkrumm.com.
- Apps deliberately held off basalt-ui because of this rewrite, which show what shadcn feels like and
  what wiring they grew: `~/IuRoot/epos-ai-teamchat-athena/ui` (shadcn base-nova + assistant-ui) and
  `~/SourceRoot/software-factory/apps/console` (carries basalt-ui 2.29.0 AND shadcn + Base UI; find
  out what is really used).
- Waiting consumers: argo rewrite, shutterflow rewrite onto v3.
- Library updates in everything we use; the best open-source implementations.

## Deliverables of this planning effort

1. Full environment analysis of the consumers: what to learn, what to carry over.
2. A new concept and architecture, re-thinking every concept, with process improvements.
3. One final artifact of direction: **each library and wiring we choose for each problem** a mature
   enterprise data-dense frontend has, with what we implement, guarantee, teach, and leave open.
4. A rewrite strategy and implementation plan with model and effort choices, maximum parallelism,
   structured the way the software factory files Issues (`factory issue new`, `--after` dependency chains).

## Owner clarifications (2026-11-09, after the discovery digest)

- **Why leave Mantine: styling and tweakability are a primary reason, not a side effect.** We keep
  fighting the patterns Mantine wants: it works for us but not with us. The digest's "13 of 234
  friction rows are Mantine-structural" counts recorded defects and misses this cost. Owning and
  restyling every implementation to our taste is the point of the move. Never argue the move down
  with that number; use it only to say our own API must improve as well.
- **AI is a growing core need, not a removable extra.** Streaming, AI SDK integrations, personalised
  and generative content will reach more apps. Deleting basalt's own `./agent` chat runtime (transport,
  message merge, retry) is fine only if the AI _surface_ gets stronger: streaming markdown, MDX
  components, tool-call rendering, a generative-UI component catalog, and a first-class documented
  wiring to the AI SDK and external runtimes. If a thin runtime layer proves necessary it can return.
- **epos-ai-teamchat-athena is a committed v3 consumer.** It migrates after v3 is established and
  proven on our own repos such as argo, then the remaining consumers follow. It needs a gate in the
  rollout, and it rejected basalt before over non-optional peers, so v3 must answer that.

## Known conflict to resolve deliberately

`packages/basalt-ui/MAINTAINING.md` § The one sanctioned major says a 3.0 is never sanctioned, and
`scripts/release.sh` `version_gate` refuses every major. The owner now wants v3: the plan must change
that doctrine and gate on purpose, not route around them.
