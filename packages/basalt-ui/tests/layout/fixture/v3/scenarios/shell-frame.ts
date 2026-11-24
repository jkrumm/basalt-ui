/**
 * The shell-frame scenario's declaration: pure data, so the test process can import the registry.
 *
 * It mounts `AppShell` under a memory router with a `Page` inside, and provides the slots the frame
 * stamps. The rail and the tab bar are stubs until their Issues land, so the rail's inner slots
 * (`shell-rail-row`, `shell-rail-footer`) are NOT declared and the 2.x chrome cases stay skipped.
 * The render lives in `shell-frame-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

export type ShellFrameSpec = FixtureSpec & {
  shellFrame?: {
    /** Table rows in the page body (default 12). */
    rows?: number
    /** Replaces the plain table with a `DataTable` whose rows carry a `detail`, no host passed. */
    detailTable?: boolean
    /** Mounts a `PageAside` (default false). */
    aside?:
      | boolean
      | {
          dock?: 'always' | 'auto'
          width?: number
          /** Binds the aside to an open state starting here; `document.documentElement.dataset.asideState` mirrors it. */
          state?: boolean
          /** Binds the aside to a string field holding the open record's id, starting here (`''` is none). */
          record?: string
        }
    /** Mounts an open `Peek` beside the page (a long body, so its own scroll shows); closing it sets `data-peek-closed` on the document. */
    peek?: boolean
    /** The presentation the peek's kind starts in, as the device would remember it (default `peek`). */
    present?: 'peek' | 'window' | 'page'
    /** Mounts an open `Sheet` (`placement="auto"`: the right edge from 840 px). */
    sheet?:
      | boolean
      | {
          /** A text field (`field-sheet`), a long body and a footer button in the sheet. */
          form?: boolean
          /** The sheet's `snapPoints`. */
          snapPoints?: readonly ('half' | 'full')[]
        }
    /** A text field (`field-page`) in the page body, under the table. */
    pageField?: boolean
    /**
     * Mounts a `Dock` (a long body). `true` starts it open; `'toggle'` starts it closed and draws a
     * `[data-testid="dock-toggle"]` button in the page that opens and closes it, for the reflow's motion.
     */
    dock?: boolean | 'toggle'
    /** Mounts a `PageBar` with a title, a control and an action (default true). */
    bar?: boolean
    /** Mounts `compactHeader: 'hidden'`. */
    compactHeader?: 'hidden'
    /** The persisted rail state to start from. */
    rail?: 'collapsed' | 'expanded'
    /** `AppShell frame` (default `panel`). */
    frame?: 'panel' | 'flush'
    /** A `fill` page: a band and a `DataTable` as its one main part, nothing else. */
    fill?: boolean
    /** A `Card` on a padded page, above the section. */
    card?: boolean
  }
}

export const shellFrameScenario: Scenario = {
  slots: [
    'shell-skip',
    'shell-header',
    'shell-lead',
    'shell-trail',
    'shell-breadcrumb',
    'shell-rail',
    'shell-main',
    'page',
    'page-bar',
    'shell-aside',
    'page-aside',
    'peek',
    'shell-dock',
    'dock',
    'shell-tab-bar',
    'shell-surface',
  ],
  matches: (spec) => (spec as ShellFrameSpec).shellFrame !== undefined,
  async mount(spec, container) {
    const { mount } = await import('./shell-frame-mount')
    await mount(spec, container)
  },
}
