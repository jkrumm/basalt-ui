/**
 * The app's ONE navigation declaration: `AppShell nav={NAV}` derives the rail, the tab bar and the
 * breadcrumb from it. Keep it a LEAF module: it must never import `routeTree.gen` or
 * `routes/__root.tsx`, so palettes and redirects can import it without closing a cycle. Call
 * `defineNav` at module scope: link identity keys on these objects.
 *
 * Scaffold written by `basalt-ui init` to `src/lib/nav.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav } from 'basalt-ui/router'

export const NAV = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'home', label: 'Home', link: linkOptions({ to: '/' }), mobile: 'tab' }],
    },
  ],
})
