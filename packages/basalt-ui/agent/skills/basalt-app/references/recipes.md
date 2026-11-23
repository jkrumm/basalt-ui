# Recipes

A recipe is the shipped answer to a pattern basalt composes but does not export: a compiled example in `node_modules/basalt-ui/docs/recipes/<name>.md`, its region built by the playground typecheck. Read the one that matches before writing the pattern; a missing export is a recipe, never a local copy. One line per recipe: when to use it, then the file. A new recipe adds its own line here.

- [add-page](node_modules/basalt-ui/docs/recipes/add-page.md): adding a destination to an AppShell app: one file route, one nav entry
- [app-shell](node_modules/basalt-ui/docs/recipes/app-shell.md): mounting the application frame once, in the `_app` layout route
- [ai-approvals-sources](node_modules/basalt-ui/docs/recipes/ai-approvals-sources.md): a chat asks before a tool runs and cites sources, which `partView` leaves to the app
- [ai-artifacts](node_modules/basalt-ui/docs/recipes/ai-artifacts.md): a model produces a document, a block, code or an html preview that opens beside the chat and keeps its versions
- [ai-blocks](node_modules/basalt-ui/docs/recipes/ai-blocks.md): a model may show a stat, chart, table, callout, list or layout in the chat, as typed blocks that stay on-brand
- [ai-card](node_modules/basalt-ui/docs/recipes/ai-card.md): a card shows a model summary that streams in (a personalised or generated note), held at one height
- [ai-external-runtime](node_modules/basalt-ui/docs/recipes/ai-external-runtime.md): a chat runs on TanStack AI, AG-UI or assistant-ui and still renders through partView
- [ai-sdk-tools](node_modules/basalt-ui/docs/recipes/ai-sdk-tools.md): a model shows typed blocks through one AI SDK tool, with a route handler and a client that renders the part through the catalog
- [dependent-validation](node_modules/basalt-ui/docs/recipes/dependent-validation.md): a form validates with one Standard Schema, with a rule across fields and one field the server decides
- [board](node_modules/basalt-ui/docs/recipes/board.md): columns of KanbanCards that move between states, by drag and by the card menu, with an optimistic save
- [chat-thread](node_modules/basalt-ui/docs/recipes/chat-thread.md): an AI chat thread: streamed replies through Message and partView, the Composer, one live region, a scroller that stays at the bottom
- [chat-thread-composer](node_modules/basalt-ui/docs/recipes/chat-thread-composer.md): wiring the Composer to a chat: mentions sent as ids beside the text, files and a model choice
- [chat-thread-scroll](node_modules/basalt-ui/docs/recipes/chat-thread-scroll.md): a scroller that follows a streaming reply to the bottom, releases on a scroll up and survives a late image or the keyboard closing
- [file-drop](node_modules/basalt-ui/docs/recipes/file-drop.md): a form takes a file from the person, by a picker first and by dropping onto the page as an enhancement
- [field-array](node_modules/basalt-ui/docs/recipes/field-array.md): a form repeats a row of fields (lines, cameras, splits) that the person adds and removes
- [inner-nav](node_modules/basalt-ui/docs/recipes/inner-nav.md): a page of sibling sections or records with a list beside the one open pane (settings)
- [form-guard](node_modules/basalt-ui/docs/recipes/form-guard.md): a form with a Save action must not be left with unsaved edits, by a link, Back or a closed tab
- [markdown](node_modules/basalt-ui/docs/recipes/markdown.md): render model or author text with code, diagrams and headings, on an article page
- [mdx](node_modules/basalt-ui/docs/recipes/mdx.md): render authored MDX with the same look as `Prose`, and block unsafe links
- [memory-state](node_modules/basalt-ui/docs/recipes/memory-state.md): live client state across routes (a timer, a selection) that a basalt control must read and write
- [optimistic](node_modules/basalt-ui/docs/recipes/optimistic.md): a save should show its result in the cached record before the server answers, and undo itself when the server refuses
- [remembered-values](node_modules/basalt-ui/docs/recipes/remembered-values.md): a page's filter (a time window) should reopen at the value the user last chose, which 2.x did with a `persist` mirror on a `createSearchStore` field
- [seam-bar](node_modules/basalt-ui/docs/recipes/seam-bar.md): a part-of-whole bar you draw yourself (HTML parts in a row), with focus, dimming and a readout
- [seam-linked](node_modules/basalt-ui/docs/recipes/seam-linked.md): a chart and a scrolling list of groups (versions, releases) beside it that share one focus
- [seam-track](node_modules/basalt-ui/docs/recipes/seam-track.md): marks on a time or value track you draw yourself (a waterfall of spans, a lane), with an axis, row labels and focus
- [storage-adapter](node_modules/basalt-ui/docs/recipes/storage-adapter.md): device preferences (rail, folds) must follow the person, so `persisted` reads and writes a server
- [timeline](node_modules/basalt-ui/docs/recipes/timeline.md): dated bars on a shared time axis, read-only, in a card frame
- [two-pane](node_modules/basalt-ui/docs/recipes/two-pane.md): charts stacked on one x (a price over a momentum line) that share one crosshair, one x chip and one plot box
- [websocket-transport](node_modules/basalt-ui/docs/recipes/websocket-transport.md): the server pushes over a WebSocket, not SSE, and a channel must still reconnect, resume and stop on a refused token
- [view-switch](node_modules/basalt-ui/docs/recipes/view-switch.md): one dataset shows as a dependency chain, nested rows or a table and the visitor can link to each
- [saved-views](node_modules/basalt-ui/docs/recipes/saved-views.md): a table's search, filters, sort, columns, widths, row height and grouping are worth naming and coming back to
- [export](node_modules/basalt-ui/docs/recipes/export.md): a table needs a CSV of its rows, because the table itself has no export
- [shot-state](node_modules/basalt-ui/docs/recipes/shot-state.md): a page's empty, loading and error states must be scored by `basalt-ui shot`
