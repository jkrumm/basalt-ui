# Scratch app

`src/App.tsx` exports `App`; `src/main.tsx` mounts it. Add files under `src/`. Styles are Tailwind utilities from the basalt theme (`src/app.css` is wired; do not edit it).

- `bun run build` bundles the app and the CSS and fails on a bad import.
- `bun run typecheck` runs tsc.
