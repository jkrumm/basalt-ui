import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'
import type { DetailEntry, DetailHost, PageHost } from '../core/ports'
import { createAsideClaims, createBarClaims } from './core/claims'
import type { ClaimStore } from './core/claims'
import type { PageProps } from './contract'

/**
 * What `Page` hands its descendants: the two claim stores (one `PageBar` owns the band, the newest
 * `PageAside` owns the aside), whether the page is at least `@wide` wide, and the node the
 * shell-less aside column portals into. Internal: `PageBar` and `PageAside` read it, apps do not.
 */
export type PageContextValue = {
  readonly bars: ClaimStore<undefined>
  readonly asides: ClaimStore<boolean>
  /** The page container is at least the `wide` tier (50rem) wide. Server and hydration read `false`. */
  readonly wide: boolean
  /** The shell-less aside column; `null` until it mounts. */
  readonly asideSlot: HTMLElement | null
  /** The entry a `DetailHost` consumer showed, drawn by the page's `PageAside`. */
  readonly detail: DetailEntry | null
  readonly hideDetail: () => void
}

/** `null` outside a `Page`: a `PageBar` or `PageAside` then renders standalone, claiming nothing. */
export const PageContext = createContext<PageContextValue | null>(null)

/**
 * The shell's side of the page: `AppShell` provides it and `PageBar` / `PageAside` claim regions
 * through it. `null` (the default) is the shell-less page, where each region renders inline.
 */
export const PageHostContext = createContext<PageHost | null>(null)

/**
 * The page's `DetailHost`: `PageAside` hosts it. `null` while no aside is mounted, where a
 * consumer (`DataTable detail`, `SplitPage`) falls back to its own sheet. Internal.
 */
export const DetailHostContext = createContext<DetailHost | null>(null)

/** The `wide` container tier is 50rem (`--container-wide`); a `rem` is the root font size. */
const WIDE_REM = 50

function widePx(): number {
  return WIDE_REM * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
}

/** The element's own width against the `wide` tier, as an external store: no state set in an effect. */
function observeWidth(el: HTMLElement | null, notify: () => void): () => void {
  if (el === null || typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver(notify)
  observer.observe(el)
  return () => observer.disconnect()
}

const readServer = (): boolean => false

type FillStyle = CSSProperties & { '--page-fill-min'?: string }

/**
 * The root of a screen, in a shell or not. It is the page's one container (`@container`), publishes
 * `--page-bar-h` (the measured `PageBar` band, written by the bar) and `--page-sticky-top` (the
 * offset anything sticky inside the page clears: the band, zero without one), and owns the claims
 * that keep it to one `PageBar` and one `PageAside`.
 *
 * Under an `AppShell` the shell renders `<main>`, the header and the aside region; without one
 * `Page` is self-contained: the band is sticky at the nearest scrollport and the aside is a second
 * column from the `wide` container tier, a `Sheet` below it. `fill` gives the page a definite
 * height (`{ min }` keeps a floor in px) for a canvas or map that must not scroll the page.
 *
 * @useWhen a route renders a screen: its bar, its sections and an optional aside live under one Page
 * @neverWhen the screen is a long-form article (use ArticleLayout) or only a fragment of a screen (use Section)
 *
 * @example
 * <Page area="runs" fill>
 *   <PageBar title="Runs" actions={[{ id: 'new', label: 'New run', primary: true, onClick: create }]} />
 *   <Section title="Latency">…</Section>
 * </Page>
 *
 * @example
 * // A route outside any shell: a landmark with the visible h1.
 * <Page landmark>
 *   <PageBar title="Sign in" />
 *   <form>…</form>
 * </Page>
 */
export function Page({ area, fill, landmark, children }: PageProps): ReactElement {
  const host = useContext(PageHostContext)
  const [bars] = useState(createBarClaims)
  const [asides] = useState(createAsideClaims)
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [asideSlot, setAsideSlot] = useState<HTMLElement | null>(null)
  const [detail, setDetail] = useState<DetailEntry | null>(null)
  const hosted = useSyncExternalStore(
    asides.subscribe,
    () => asides.getSnapshot().count > 0,
    readServer,
  )
  const detailHost = useMemo<DetailHost | null>(
    () =>
      hosted ? { isOpen: detail !== null, show: setDetail, hide: () => setDetail(null) } : null,
    [hosted, detail],
  )
  const subscribe = useCallback((notify: () => void) => observeWidth(el, notify), [el])
  const wide = useSyncExternalStore(
    subscribe,
    () => el !== null && el.clientWidth >= widePx(),
    readServer,
  )
  const Root = landmark === true && host === null ? 'main' : 'div'
  const min = typeof fill === 'object' ? fill.min : undefined
  const style: FillStyle | undefined =
    min === undefined ? undefined : { '--page-fill-min': `${min}px` }
  return (
    <PageContext
      value={{ bars, asides, wide, asideSlot, detail, hideDetail: () => setDetail(null) }}
    >
      <DetailHostContext value={detailHost}>
        <Root
          ref={setEl}
          data-slot="page"
          data-area={area}
          data-fill={fill !== undefined && fill !== false ? '' : undefined}
          style={style}
          className={cn(
            '@container flex min-w-0 [--page-gutter:--spacing(4)] [--page-sticky-top:var(--page-bar-h,0px)]',
            fill !== undefined && fill !== false && 'h-full min-h-(--page-fill-min,0px)',
          )}
        >
          <div
            data-slot="page-main"
            className="flex min-w-0 flex-1 flex-col gap-4 px-(--page-gutter) pb-(--page-gutter)"
          >
            {children}
          </div>
          {host === null && (
            <div ref={setAsideSlot} data-slot="page-aside-slot" className="shrink-0 empty:hidden" />
          )}
        </Root>
      </DetailHostContext>
    </PageContext>
  )
}
