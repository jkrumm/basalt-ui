# AI

What a model produced is data, never markup the app trusts. The parts own the safe path; you own which one a surface takes and what it says. Docs: [partView](docs/part-view.md), [defineBlock](docs/define-block.md), [defineCatalog](docs/define-catalog.md), [expectCatalog](docs/expect-catalog.md), [CodeBlock](docs/code-block.md), [mdxComponents](docs/mdx-components.md).

## Pick the renderer

- A message's parts (text, tool calls) render through `partView`; model text is untrusted markdown there and the level cannot be raised. It needs `react-markdown`, `remark-gfm`, `rehype-sanitize` and `remend`; `ai` and `@ai-sdk/react` are never imported, the part types are structural.
- Text outside a message (a generated summary, an artifact) is `Markdown` with `contentTrust="untrusted"`. The prop has no default, so say it.
- A typed piece of UI the model chose (a stat, a table, a chart) is a block: `defineBlock` over a composite, `defineCatalog` over the blocks, `catalog.Block` to draw one. A block is never for model text.
- Never `streamdown`: its defaults emit an attacker `<img>` and a preload link. [lint:import-boundary]

## Trust

- `trusted` means authored: text in the repo, a vault note on the allowlist, MDX the toolchain compiles. Never model text, never a field a model filled, never a string "that looks safe".
- `untrusted` has no `sanitize` and no `rehypePlugins` and draws no `<img>` (the alt text instead). `//host`, `/\host` and `data:` are blocked links, not relative ones.
- MDX is build-time only and models never write it. No `evaluate`, no `rehype-raw`, no `next-mdx-remote`.
- A block's data is untrusted too. `validate` runs in `catalog.Block` before any render: size and depth limits, then every `href`, `src`, `url` and `link` at any depth through the url policy. A URL under any other key is not checked: render it as text, never as a link.

## Four ways an agent gets the surface

| Channel                                         | State                     | Reach for it when                                            |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------ |
| Docs: `llms.txt`, `docs/<name>.md`, the skills  | shipped, generated        | you write the code: read before guessing an import or a prop |
| Recipes: `docs/recipes/<name>.md`               | shipped, compiled         | a missing export is a recipe, never a local copy             |
| Runtime catalog: `defineBlock`, `defineCatalog` | shipped, app-owned blocks | a model shows typed UI at run time                           |
| Registry, MCP server, MCP Apps theming          | not shipped               | nobody names a caller: say so, never build it                |

## Blocks

- `name` and `description` are what the model reads, so the description says when to use it and when not ("One headline number. Never for lists."). Props carry limits (`max` on every string and array); `sample` is at least one valid value.
- `limits` only tighten the default (32 KiB, depth 6). A block that needs more is a finding, not a workaround.
- Every block renders a composite at its root so `catalog.Block` can hand it the phase. A layout block that composes several composites sets `reserve`.
- The error text a refused spec returns is read by the model and ends in advice. Write it so the next call can fix itself.
- One `expectCatalog(catalog)` test per catalog: samples, limits and hostile URLs. Blocks are app-owned seeds over the composites, never a shipped set.

## Recipes

- [chat-thread](docs/recipes/chat-thread.md): the thread, the composer and the scroller; the AI SDK chat object lives in `useState`, never in module scope
- [ai-blocks](docs/recipes/ai-blocks.md): the six seed blocks and their schemas, split so a server imports the schemas alone
- [ai-sdk-tools](docs/recipes/ai-sdk-tools.md): one `show` tool over the block schemas; the client draws that part itself
- [ai-external-runtime](docs/recipes/ai-external-runtime.md): TanStack AI, AG-UI and assistant-ui messages mapped into `MessagePart`
- [ai-card](docs/recipes/ai-card.md): a streamed summary held at one height inside a card
- [mdx](docs/recipes/mdx.md): authored MDX with `mdxComponents` and the `Prose` look
- [ai-approvals-sources](docs/recipes/ai-approvals-sources.md): approve before a tool runs, reasoning, cited sources
- [ai-artifacts](docs/recipes/ai-artifacts.md): a document, block, code or preview beside the chat, with versions

## Deferred: when to ask

- Not built, each until a task names a caller: the model prompt and JSON Schema generated from a catalog, a `basalt:<name>` fence renderer, a catalog `mdxComponents`, valibot and arktype converters, chat parts (a message, a composer), an MCP server or host.
- Ask before you work around one. Say which channel, who calls it and what the recipe could not do.

not guarded:

- Never a spinner or "Thinking…" in place of the streaming shape; the block or the card holds its height.
- Never a model sentence in a toast, a title or a tooltip: it is text and goes through the same path.
