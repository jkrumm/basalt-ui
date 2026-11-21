# apps/marketing/src: rules for a page

The root `apps/marketing/AGENTS.md` points here. Read this before changing a page, component, island, layout or guide under `src/`.

- Render a basalt part with no `client:` directive. A part that needs one is the `DataTable` or `Chart` tag
  (their directive is the tag's `interactive` and `load` props), or belongs in `src/islands/`:
  `client:visible` below the fold, `client:idle` above it when not urgent, `client:load` only for
  the first tap, `client:only="react"` only for a part that measures its box (a chart), with a
  fallback of the same height.
- One `BasaltProvider` per island, never around the page; parts that share state share an island.
- A node passed to a part is a named slot (`<Fragment slot="meta">`), never JSX inside an object
  prop: Astro hands that over as an Astro template and the build fails.
- Keep every URL: the site is linked from npm, GitHub and search results.
- `prefetch` stays off: Starlight would turn it on and put a module script on every page.
