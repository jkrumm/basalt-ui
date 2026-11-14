# Recipes

A recipe is the shipped answer to a pattern basalt composes but does not export: a compiled example in `docs/recipes/<name>.md`, its region built by the playground typecheck. Read the one that matches before writing the pattern; a missing export is a recipe, never a local copy. One line per recipe: when to use it, then the file. A new recipe adds its own line here.

- [add-page](docs/recipes/add-page.md): adding a destination to an AppShell app: one file route, one nav entry
- [app-shell](docs/recipes/app-shell.md): mounting the application frame once, in the root route
- [ai-approvals-sources](docs/recipes/ai-approvals-sources.md): a chat asks before a tool runs, shows reasoning and cites sources, which `partView` leaves to the app
- [ai-artifacts](docs/recipes/ai-artifacts.md): a model produces a document, a block, code or an html preview that opens beside the chat and keeps its versions
- [dependent-validation](docs/recipes/dependent-validation.md): a form validates with one Standard Schema, with a rule across fields and one field the server decides
- [board](docs/recipes/board.md): columns of KanbanCards that move between states, with a menu path and an app-owned drag engine
- [chat-thread](docs/recipes/chat-thread.md): an AI chat thread: streamed replies without a bubble, a composer, one live region, a scroller that stays at the bottom
- [chat-thread-composer](docs/recipes/chat-thread-composer.md): the message box of a chat thread: Enter sends, Shift+Enter and IME composition leave the draft, a failed send gives the text back
- [chat-thread-scroll](docs/recipes/chat-thread-scroll.md): a scroller that follows a streaming reply to the bottom, releases on a scroll up and survives a late image or the keyboard closing
- [file-drop](docs/recipes/file-drop.md): a form takes a file from the person, by a picker first and by dropping onto the page as an enhancement
- [field-array](docs/recipes/field-array.md): a form repeats a row of fields (lines, cameras, splits) that the person adds and removes
- [inner-nav](docs/recipes/inner-nav.md): a page of sibling sections or records with a list beside the one open pane (settings)
- [form-guard](docs/recipes/form-guard.md): a form with a Save action must not be left with unsaved edits, by a link, Back or a closed tab
- [markdown](docs/recipes/markdown.md): render model or author text with code, diagrams and headings, on an article page
- [mdx](docs/recipes/mdx.md): render authored MDX with the same look as `Prose`, and block unsafe links
- [memory-state](docs/recipes/memory-state.md): live client state across routes (a timer, a selection) that a basalt control must read and write
- [optimistic](docs/recipes/optimistic.md): a save should show its result in the cached record before the server answers, and undo itself when the server refuses
- [remembered-values](docs/recipes/remembered-values.md): a page's filter (a time window) should reopen at the value the user last chose, which 2.x did with a `persist` mirror on a `createSearchStore` field
- [seam-bar](docs/recipes/seam-bar.md): a part-of-whole bar you draw yourself (HTML parts in a row), with focus, dimming and a readout
- [seam-linked](docs/recipes/seam-linked.md): a chart and a scrolling list of groups (versions, releases) beside it that share one focus
- [seam-track](docs/recipes/seam-track.md): marks on a time or value track you draw yourself (a waterfall of spans, a lane), with an axis, row labels and focus
- [storage-adapter](docs/recipes/storage-adapter.md): device preferences (rail, folds) must follow the person, so `persisted` reads and writes a server
- [timeline](docs/recipes/timeline.md): dated bars on a shared time axis, read-only, in a card frame
- [websocket-transport](docs/recipes/websocket-transport.md): the server pushes over a WebSocket, not SSE, and a channel must still reconnect, resume and stop on a refused token
