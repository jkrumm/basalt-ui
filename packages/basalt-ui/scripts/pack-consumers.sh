#!/usr/bin/env bash
#
# The install path a consumer takes, from the packed tarball in an empty directory (pack-test.sh runs
# it; on its own: scripts/pack-consumers.sh <absolute path to basalt-ui-*.tgz>):
#
# 1. app: a create-vite React app, then `init --profile app`, then `bun run build` with NO further
#    install, then a server render of the start page the router seeds write.
# 2. eject: the same app ejects `button`, edits it, builds (the edit reaches the bundle through the
#    alias `basalt()` sets) and passes `doctor`.
# 3. site: an Astro project, then `init --profile site`, then `astro build`: the static page ships no
#    module script and the island page hydrates exactly one island.
#
# A file the tarball lacks (a template `init` writes from, a preset `sync` renders) fails a step here.
set -euo pipefail

TGZ=${1:?usage: pack-consumers.sh <absolute path to basalt-ui-*.tgz>}
case "$TGZ" in /*) ;; *) echo "pack-consumers: the tarball path must be absolute"; exit 1 ;; esac
cd "$(dirname "$0")/.."
PKG="$PWD"
REPO="$PKG/../.."
pin() { node -p "require('$1').$2['$3']"; }
# The versions this repo builds and tests with, so the gate grades the artifact and not a registry
# release of minutes ago (vite as in pack-test.sh).
VITE=8.0.16
TS=$(pin "$PKG/package.json" devDependencies typescript)
TYPES_REACT=$(pin "$PKG/package.json" devDependencies @types/react)
REACT=$(pin "$REPO/apps/playground/package.json" dependencies react)
PLUGIN_REACT=$(pin "$REPO/apps/playground/package.json" devDependencies @vitejs/plugin-react)
ASTRO=$(pin "$REPO/apps/playground-astro/package.json" dependencies astro)
ASTRO_REACT=$(pin "$REPO/apps/playground-astro/package.json" dependencies @astrojs/react)

APP=$(mktemp -d)
SITE=$(mktemp -d)
trap 'rm -rf "$APP" "$SITE"' EXIT

# Quiet on success, the whole log on failure: a silent red step says nothing about the artifact.
quiet() {
  local log
  log=$(mktemp)
  if ! "$@" >"$log" 2>&1; then
    echo "pack-consumers: FAILED: $*"
    cat "$log"
    rm -f "$log"
    exit 1
  fi
  rm -f "$log"
}

echo "==> app: create-vite React app, init --profile app, build with no further install"
cd "$APP"
git init -q
cat >package.json <<'JSON'
{
  "name": "pack-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build" }
}
JSON
cat >index.html <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>pack-app</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML
cat >vite.config.ts <<'TS'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
TS
cat >tsconfig.json <<'JSON'
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }
JSON
cat >tsconfig.app.json <<'JSON'
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
JSON
cat >tsconfig.node.json <<'JSON'
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "types": [],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
JSON
mkdir -p src
cat >src/main.tsx <<'TSX'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
TSX
cat >src/App.tsx <<'TSX'
import './App.css'

export default function App() {
  return <h1>Vite + React</h1>
}
TSX
echo '.logo-spin { animation: none; }' >src/App.css
printf ':root {\n  color-scheme: light dark;\n  --code-bg: #1f2028;\n}\n' >src/index.css
quiet bun add "react@$REACT" "react-dom@$REACT"
quiet bun add --dev "vite@$VITE" "@vitejs/plugin-react@$PLUGIN_REACT" "typescript@$TS" \
  "@types/react@$TYPES_REACT" "@types/react-dom@$TYPES_REACT"
quiet bun add "$TGZ"
quiet ./node_modules/.bin/basalt-ui init --profile app --root src
[ -f src/routes/_app/index.tsx ] || { echo "FAILED: init wrote no start page"; exit 1; }
# The build `init` wired, with nothing installed after it: a peer it missed fails basalt()'s gate here.
quiet bun run build
[ -f dist/index.html ] || { echo "FAILED: no dist/index.html"; exit 1; }

echo "==> app: server render of the start page"
# The router the seeds build, on a memory history, rendered to a string. Bundled for the server with
# basalt-ui inlined, as basalt() does for an app with ejects, so its CSS imports go through Vite.
cat >render.tsx <<'TSX'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { routeTree } from './src/routeTree.gen'

export async function render(url: string): Promise<string> {
  const queryClient = new QueryClient()
  const defaults = routerDefaults()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    ...defaults.options,
    history: createMemoryHistory({ initialEntries: [url] }),
    Wrap: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  defaults.bind(router)
  await router.load()
  return renderToString(
    <BasaltProvider link={defaults.link}>
      <RouterProvider router={router} />
    </BasaltProvider>,
  )
}
TSX
cat >vite.render.config.ts <<'TS'
import { defineConfig, mergeConfig } from 'vite'
import app from './vite.config'

export default mergeConfig(app, defineConfig({ ssr: { noExternal: ['basalt-ui'] } }))
TS
quiet ./node_modules/.bin/vite build --config vite.render.config.ts --ssr render.tsx --outDir dist-render
node --input-type=module -e "
  const { render } = await import('$APP/dist-render/render.js')
  const html = await render('/')
  for (const want of ['Nothing here yet', 'data-slot=\"page\"']) {
    if (!html.includes(want)) { console.error('FAILED: the start page render lacks ' + want); process.exit(1) }
  }
  console.log('start page rendered: ' + html.length + ' bytes')
"

echo "==> app: eject button, edit it, build, doctor"
quiet ./node_modules/.bin/basalt-ui eject button --reason "pack-test: the eject round trip"
EJECTED=src/components/ui/button.tsx
[ -f "$EJECTED" ] || { echo "FAILED: eject wrote no $EJECTED"; exit 1; }
node -e "
  const fs = require('node:fs')
  const text = fs.readFileSync('$EJECTED', 'utf8')
  if (!text.includes('data-slot=\"button\"')) { console.error('FAILED: the seed has no data-slot=\"button\"'); process.exit(1) }
  fs.writeFileSync('$EJECTED', text.replace('data-slot=\"button\"', 'data-slot=\"button\"\n      data-pack-ejected=\"edited\"'))
"
quiet bun run build
grep -rqF 'data-pack-ejected' dist/assets || { echo "FAILED: the edited ejected button is not in the bundle"; exit 1; }
quiet ./node_modules/.bin/basalt-ui doctor
echo "eject round trip: the edit is in the bundle and doctor passes"

echo "==> site: Astro project, init --profile site, astro build"
cd "$SITE"
git init -q
echo '{ "name": "pack-site", "private": true, "type": "module", "scripts": { "build": "astro build" } }' >package.json
quiet bun add "astro@$ASTRO" "@astrojs/react@$ASTRO_REACT" "react@$REACT" "react-dom@$REACT" "@base-ui/react@$(pin "$PKG/package.json" peerDependencies @base-ui/react)"
quiet bun add "$TGZ"
quiet ./node_modules/.bin/basalt-ui init --profile site
# `init --profile site` prints these two as to-dos: the integration and the layout's font component.
cat >astro.config.mjs <<'JS'
import react from '@astrojs/react'
import { basaltAstro } from 'basalt-ui/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({ output: 'static', prefetch: false, integrations: [react(), basaltAstro()] })
JS
mkdir -p src/layouts src/pages src/islands
cat >src/layouts/Layout.astro <<'ASTRO'
---
import BasaltFonts from 'basalt-ui/astro/BasaltFonts.astro'
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <BasaltFonts />
    <title>pack-site</title>
  </head>
  <body><slot /></body>
</html>
ASTRO
cat >src/pages/index.astro <<'ASTRO'
---
import { SiteArticle, SiteCallout } from 'basalt-ui/static'
import Layout from '../layouts/Layout.astro'
---
<Layout>
  <SiteArticle title="Static" description="Static parts only.">
    <SiteCallout tone="info" title="No island">This page ships no client JavaScript.</SiteCallout>
  </SiteArticle>
</Layout>
ASTRO
cat >src/islands/Counter.tsx <<'TSX'
import { useState } from 'react'
import { Button } from 'basalt-ui/ui/button'

export function Counter() {
  const [count, setCount] = useState(0)
  return <Button onClick={() => setCount(count + 1)}>Clicked {count}</Button>
}
TSX
cat >src/pages/island.astro <<'ASTRO'
---
import { SiteArticle } from 'basalt-ui/static'
import Layout from '../layouts/Layout.astro'
import { Counter } from '../islands/Counter'
---
<Layout>
  <SiteArticle title="Island" description="One hydrated part.">
    <Counter client:load />
  </SiteArticle>
</Layout>
ASTRO
quiet ./node_modules/.bin/astro build
node -e "
  const fs = require('node:fs')
  const read = (f) => fs.readFileSync('dist/' + f, 'utf8')
  const modules = (html) => (html.match(/<script[^>]*type=\"module\"/g) ?? []).length
  const islands = (html) => (html.match(/<astro-island/g) ?? []).length
  const page = read('index.html'), island = read('island/index.html')
  if (modules(page) !== 0) { console.error('FAILED: the static page has a module script'); process.exit(1) }
  if (islands(page) !== 0) { console.error('FAILED: the static page has an island'); process.exit(1) }
  if (islands(island) !== 1) { console.error('FAILED: the island page has ' + islands(island) + ' islands, want 1'); process.exit(1) }
  if (!island.includes('data-slot=\"button\"')) { console.error('FAILED: the island did not render on the server'); process.exit(1) }
  console.log('site: static page 0 module scripts, island page 1 island')
"

echo "PACK CONSUMERS PASSED"
