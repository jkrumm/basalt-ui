/**
 * `docs/vite.md` is generated from this text (`renderViteDoc`) and a test pins the two; edit here.
 * Regenerate: bun packages/basalt-ui/src/vite/doc.ts
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const VITE_DOC = `Usage (vite.config.ts):

  import { basalt } from 'basalt-ui/vite'
  export default { plugins: [react(), tailwindcss(), basalt()] }

  /* src/styles.css, after @import 'tailwindcss' */
  @import '../.basalt/sources.css';

At buildStart, in dev and in every build (deploy builds run where CI does not), basalt() fails
naming the one command that fixes it:
  missing peer      an imported subpath (or a primitive or composite it reaches) needs a peer
                    that is not installed: "Run: bun add <peers>". The peers come from the
                    subpath allotment; date-picker adds react-day-picker, virtual-list adds
                    @tanstack/react-virtual. Lazy peers (shiki, beautiful-mermaid) are not gated.
  stale seed        an ejected file's recorded seedDigest differs from the installed seed plus
                    guard: "Run: basalt-ui sync". A release that does not touch the seed asks
                    nothing. origin "local" records no digest and is skipped.

With ejects (manifest.ejected rows whose root lies inside this Vite root) it adds:
  resolve.alias          ^basalt-ui/ui/<name>$ -> the local file, so npm composites follow it
  ssr.noExternal         ['basalt-ui'], so the SSR build applies the alias (ERR_MODULE_NOT_FOUND
                         without it)
  optimizeDeps.exclude   the composite subpaths (basalt-ui/page, cards, ...), so no ejected file
                         is frozen into .vite/deps
With no ejects it adds none of these.

Every run it rewrites <root>/.basalt/sources.css (gitignored) when its bytes change:
  @source "<basalt-ui>/<dir>"           per reached subpath: the imports scanned from this
                                       root, closed over declared edges, composite -> primitive
                                       and primitive -> sibling imports of the installed package
  @source not "<basalt-ui>/ui/<name>.*" per shipped primitive not reached, and per ejected one
                                       (its local file is the app's own source)
An import added in dev is picked up on the next start. sources: false skips the file.

The head (transformIndexHtml), replacing 2.x basaltAppPlugin:
  <meta charset> hoisted first, a viewport meta when the shell has none, the theme script from
  basalt-ui/theme-script (once; options: themeScript, false to omit), and the theme-color pair
  (themeColor: 'auto' = the default palette's canvas, a { light, dark } pair, or false).
  There is no anti-FOUC <style>: the script stamps data-theme before paint, tokens.css paints.
  app: { name, shortName, description, display, startUrl, scope, id, backgroundColor, icons,
         darkreader, seo, manifest, serviceWorker } adds site.webmanifest, its link, the icons
  that name rel, the apple and darkreader metas, SEO tags, and with serviceWorker the optional
  peer vite-plugin-pwa.

Open: F9 (HMR on an edited ejected file in a real dev server, with optimizeDeps.exclude) is not
claimed here; it is recorded open for v3-spike-f3-eject. Until it passes, restart the dev server
after editing an ejected file if the edit does not show.

basalt() replaces basaltAppPlugin on basalt-ui/vite; 2.x basaltViteConfig is still exported
until its migration row (replace with basalt()) retires it. Options type: Parameters<typeof basalt>[0].`

export function renderViteDoc(): string {
  return (
    '# basalt-ui/vite: basalt()\n\n' +
    'Generated from `src/vite/doc.ts`; edit it there.\n\n' +
    '```text\n' +
    `${VITE_DOC}\n` +
    '```\n'
  )
}

export const VITE_DOC_PATH = fileURLToPath(new URL('../../docs/vite.md', import.meta.url))

if (import.meta.main) writeFileSync(VITE_DOC_PATH, renderViteDoc())
