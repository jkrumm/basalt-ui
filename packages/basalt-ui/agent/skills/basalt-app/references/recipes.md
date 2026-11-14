# Recipes

A recipe is the shipped answer to a pattern basalt composes but does not export: a compiled example in `docs/recipes/<name>.md`, its region built by the playground typecheck. Read the one that matches before writing the pattern; a missing export is a recipe, never a local copy. One line per recipe: when to use it, then the file. A new recipe adds its own line here.

- [add-page](docs/recipes/add-page.md): adding a destination to an AppShell app: one file route, one nav entry
- [app-shell](docs/recipes/app-shell.md): mounting the application frame once, in the root route
- [board](docs/recipes/board.md): columns of KanbanCards that move between states, with a menu path and an app-owned drag engine
- [inner-nav](docs/recipes/inner-nav.md): a page of sibling sections or records with a list beside the one open pane (settings)
- [markdown](docs/recipes/markdown.md): render model or author text with code, diagrams and headings, on an article page
- [mdx](docs/recipes/mdx.md): render authored MDX with the same look as `Prose`, and block unsafe links
- [memory-state](docs/recipes/memory-state.md): live client state across routes (a timer, a selection) that a basalt control must read and write
- [remembered-values](docs/recipes/remembered-values.md): a page's filter (a time window) should reopen at the value the user last chose, which 2.x did with a `persist` mirror on a `createSearchStore` field
- [seam-bar](docs/recipes/seam-bar.md): a part-of-whole bar you draw yourself (HTML parts in a row), with focus, dimming and a readout
- [storage-adapter](docs/recipes/storage-adapter.md): device preferences (rail, folds) must follow the person, so `persisted` reads and writes a server
- [timeline](docs/recipes/timeline.md): dated bars on a shared time axis, read-only, in a card frame
- [websocket-transport](docs/recipes/websocket-transport.md): the server pushes over a WebSocket, not SSE, and a channel must still reconnect, resume and stop on a refused token
