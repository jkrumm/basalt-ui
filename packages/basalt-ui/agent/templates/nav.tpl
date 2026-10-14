/**
 * The app's ONE navigation definition — `BasaltShell nav={NAV}` derives the desktop sidebar, the
 * mobile bar and the breadcrumb from it. Keep it a LEAF module: it must never import
 * `routeTree.gen` or `routes/__root.tsx`, so palettes and redirects can import it without closing a
 * cycle.
 *
 * Scaffold written by `basalt-ui init`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav, navGroup } from 'basalt-ui'

export const NAV = defineNav({
  groups: [
    navGroup({ id: 'main', label: 'Main' }, [
      { id: 'home', label: 'Home', link: linkOptions({ to: '/' }) },
    ]),
  ],
})
