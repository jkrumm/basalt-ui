/** `basalt-ui/router` — the v3 router bridge and the app's root `BasaltProvider`. Peers: `@tanstack/react-router` (optional). */

export { defineNav } from './nav/define-nav'
export { defineControls } from './controls/define'
export type { Controls, FieldHandle, SearchOf } from './controls/define'
export { field } from './controls/field'
export type { RangeValue } from './controls/codec'
export { navTarget } from './nav-target'
export { routerDefaults } from './defaults'
export { BasaltProvider } from '../core/provider'
