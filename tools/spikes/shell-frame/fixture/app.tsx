/**
 * One fixture for S1, S6 and S8 (docs/v3/concepts/shell-nav-router.md section 6). Plain React plus
 * Tailwind 4, reproducing only the structure of sections 3.1 and 3.2: a five-area grid shell
 * (header, rail, Main as the only scrollport, aside), `Page` with a sticky in-flow `PageBar` band
 * that publishes `--page-bar-h`, and `PageAside` docked beside Main. No consumer source; every
 * string and number is synthetic. The views are selected by the URL, the harness drives them.
 *
 * ASSUMPTIONS the concept does not fix (stated in docs/v3/spikes/shell-frame.md): header 48,
 * rail 240 expanded / 64 collapsed (2.x navbarWidth), aside 320, size classes by viewport
 * compact < 840 <= medium < 1200 <= expanded, header tiers as in app.css.
 */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

const params = new URLSearchParams(location.search)
const VIEW = params.get('view') ?? 'argo'
const RAIL_PARAM = params.get('rail') ?? 'auto'
const DOCK = params.get('dock') ?? (VIEW === 'viewer' ? 'always' : 'auto')
const CONTROL = params.get('control') === 'head' // negative control: the table head ignores the band
const CONTROL_MIRROR = params.get('control') === 'mirror' // negative control: the aside height arrives 50 ms late
const ASIDE_W = 320
const RAIL_EXPANDED = 240
const RAIL_COLLAPSED = 64
const BAND_BORDER = 1
const cn = (...parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(' ')

// ── Frame state ─────────────────────────────────────────────────────────────────────────────

type SizeClass = 'compact' | 'medium' | 'expanded'
const sizeOf = (w: number): SizeClass => (w < 840 ? 'compact' : w < 1200 ? 'medium' : 'expanded')
const subscribeResize = (cb: () => void): (() => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}
// oxlint-disable-next-line basalt/raw-breakpoint -- the fixture stands in for the shell's own useSizeClass
const useWindowWidth = (): number => useSyncExternalStore(subscribeResize, () => window.innerWidth)

type Host = { mirror: (h: number) => void }
const HostCtx = createContext<Host>({ mirror: () => undefined })
type PageApi = { publish: (h: number) => void }
const PageCtx = createContext<PageApi>({ publish: () => undefined })

// ── Header, with the shutterflow cluster ─────────────────────────────────────────────────────

const Glyph = ({ className }: { className?: string }): ReactNode => (
  <svg
    aria-hidden
    className={cn('size-4 shrink-0', className)}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="8" cy="8" r="5.5" />
  </svg>
)

const Btn = ({
  children,
  className,
  ...rest
}: {
  children: ReactNode
  className?: string
  [k: string]: unknown
}): ReactNode => (
  <button
    type="button"
    className={cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-3 text-fg',
      className,
    )}
    {...rest}
  >
    {children}
  </button>
)

type Item = { id: string; label: string }

function Cluster({ size }: { size: SizeClass }): ReactNode {
  const long = size === 'expanded'
  const badges = long
    ? ['Card · 40 new', 'Queue · 3 jobs', 'Disk · 82% used']
    : ['Card 40', 'Queue 3', 'Disk 82%']
  const [menu, setMenu] = useState<Item[] | null>(null)
  const open = (e: { currentTarget: HTMLElement }): void => {
    if (menu) {
      setMenu(null)
      return
    }
    const header = e.currentTarget.closest('[data-slot=shell-header]')
    const hidden = [...(header?.querySelectorAll<HTMLElement>('[data-item]') ?? [])].filter(
      (n) => getComputedStyle(n).display === 'none',
    )
    setMenu(hidden.map((n) => ({ id: n.dataset.item ?? '', label: n.dataset.label ?? '' })))
  }
  return (
    <div
      data-slot="shell-cluster"
      className="relative flex min-w-0 flex-wrap items-center justify-end gap-2"
    >
      <div
        data-item="badges"
        data-label="Status"
        data-priority="1"
        className="flex items-center gap-1.5"
      >
        {badges.map((b) => (
          <span
            key={b}
            data-badge
            className="inline-flex h-6 items-center whitespace-nowrap rounded-full border border-line bg-inset px-2.5 text-xs"
          >
            {b}
          </span>
        ))}
      </div>
      <div
        data-item="progress"
        data-label="Export progress"
        data-priority="2"
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <span className="text-xs text-muted">Export 412 / 1,800</span>
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-inset">
          <span className="block h-full w-1/4 bg-accent" />
        </span>
      </div>
      <Btn data-item="import" data-label="Import" data-priority="3">
        <Glyph /> Import
      </Btn>
      <Btn data-item="tag" data-label="Tag selection" data-priority="3">
        <Glyph /> Tag selection
      </Btn>
      <Btn data-slot="shell-search" aria-label="Search" className="w-8 justify-center px-0">
        <Glyph />
      </Btn>
      <Btn data-slot="shell-bell" aria-label="Notifications" className="w-8 justify-center px-0">
        <Glyph />
      </Btn>
      <Btn
        data-slot="shell-kebab"
        aria-label="More actions"
        className="w-8 justify-center px-0"
        onClick={open}
      >
        <Glyph />
      </Btn>
      <span data-slot="shell-account" className="size-8 shrink-0 rounded-full bg-inset" />
      {menu && (
        <div
          role="menu"
          data-slot="shell-kebab-menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-md border border-line bg-surface p-1 shadow-lg"
        >
          {menu.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitem"
              data-kebab-item={m.id}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-inset"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Header({ size, railW }: { size: SizeClass; railW: number }): ReactNode {
  return (
    <header
      data-slot="shell-header"
      className="col-span-3 flex items-center gap-3 border-b border-line bg-surface pr-3"
      style={{ height: 'var(--header-h)' }}
    >
      <div
        data-slot="shell-lead"
        className="flex shrink-0 items-center gap-2 pl-3"
        style={{ width: Math.max(railW, 120) }}
      >
        <span className="size-5 rounded bg-accent" />
        <span className="font-semibold">Atlas</span>
      </div>
      <div data-slot="shell-breadcrumb" className="min-w-0 flex-1 truncate text-muted">
        Library / Sessions / <span className="text-fg">Alpine trip, batch 2026-11</span>
      </div>
      {size !== 'compact' && (
        <div data-slot="shell-center" className="shrink-0">
          <Btn>Last 30 days</Btn>
        </div>
      )}
      {VIEW === 'viewer' ? (
        <Cluster size={size} />
      ) : (
        <div data-slot="shell-cluster" className="flex shrink-0 items-center gap-2">
          <Btn aria-label="Notifications" className="w-8 justify-center px-0">
            <Glyph />
          </Btn>
          <span className="size-8 shrink-0 rounded-full bg-inset" />
        </div>
      )}
    </header>
  )
}

// ── Page kit ────────────────────────────────────────────────────────────────────────────────

function Page({ fill, children }: { fill?: boolean; children: ReactNode }): ReactNode {
  const host = useContext(HostCtx)
  const [h, setH] = useState(0)
  const first = useRef(true)
  // The band publishes after layout; the page re-aims a cold `#hash` on the first publish (section 4, Band).
  useLayoutEffect(() => {
    host.mirror(h)
    if (h > 0 && first.current) {
      first.current = false
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }
  }, [h, host])
  const style = {
    '--page-bar-h': `${h}px`,
    '--page-sticky-top': `${h + BAND_BORDER}px`,
  } as CSSProperties
  return (
    <PageCtx.Provider value={{ publish: setH }}>
      <div
        data-slot="page"
        data-fill={fill ? '' : undefined}
        className={cn('flex flex-col', fill ? 'min-h-full' : '')}
        style={style}
      >
        {children}
      </div>
    </PageCtx.Provider>
  )
}

function PageBar({
  title,
  parent,
  controls,
  tabs,
  actions,
}: {
  title: string
  parent: string
  controls?: string[]
  tabs?: string[]
  actions?: string[]
}): ReactNode {
  const page = useContext(PageCtx)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = (): void => {
      const h = el.getBoundingClientRect().height - BAND_BORDER
      if (h > 0) page.publish(h)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [page])
  return (
    <div
      ref={ref}
      data-slot="page-bar"
      data-sticky="band"
      data-gap="0"
      className="sticky top-0 z-20 box-content flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2.5"
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-muted">{parent} /</span>
        <h1 className="m-0 truncate text-[15px] font-semibold leading-[1.45]">{title}</h1>
      </div>
      {controls && (
        <div className="flex flex-wrap items-center gap-2">
          {controls.map((c) => (
            <Btn key={c} className="h-7 text-[13px] leading-[1.45]">
              {c}
            </Btn>
          ))}
        </div>
      )}
      {tabs && (
        <div role="tablist" className="flex items-center gap-4 text-[13px] leading-[1.45]">
          {tabs.map((t, i) => (
            <span
              key={t}
              role="tab"
              aria-selected={i === 0}
              className={cn(
                'whitespace-nowrap py-0.5',
                i === 0 ? 'border-b-2 border-accent' : 'text-muted',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {actions && (
        <div className="ml-auto flex items-center gap-2">
          {actions.map((a, i) => (
            <Btn key={a} className={cn('h-7', i === 0 && 'border-accent text-accent')}>
              {a}
            </Btn>
          ))}
        </div>
      )}
    </div>
  )
}

const Section = ({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}): ReactNode => (
  <section id={id} data-slot="section" className="scroll-mt-(--page-sticky-top) px-4 pb-6 pt-4">
    <h2 className="m-0 mb-3 text-sm font-semibold">{title}</h2>
    {children}
  </section>
)

// Two nested route layouts around every page: neither owns a scrollport, a transform or a clip.
const Nested = ({ children }: { children: ReactNode }): ReactNode => (
  <div data-layout="root" className="min-h-full">
    <div data-layout="segment" className="flex min-h-full flex-col">
      {children}
    </div>
  </div>
)

// ── Synthetic data ──────────────────────────────────────────────────────────────────────────

const hash = (n: number): string => ((n * 2654435761) >>> 0).toString(16).slice(0, 6)
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

// ── Views ───────────────────────────────────────────────────────────────────────────────────

const TOC = ['overview', 'runs', 'latency', 'errors', 'capacity']

function Argo(): ReactNode {
  return (
    <Page>
      <PageBar
        title="Fleet overview"
        parent="Runs"
        controls={['Env: prod', 'Region: all', 'Window: 24h']}
        tabs={['Summary', 'Compare', 'Trends', 'Alerts']}
        actions={['New run', 'Refresh']}
      />
      <nav data-slot="toc" className="flex gap-4 px-4 pt-3">
        {TOC.map((t) => (
          <a key={t} href={`#${t}`} className="text-accent">
            {t}
          </a>
        ))}
      </nav>
      <Section id="overview" title="Overview">
        <div className="grid grid-cols-4 gap-3">
          {range(8).map((i) => (
            <div key={i} className="h-24 rounded-lg border border-line bg-surface p-3">
              <div className="text-muted">Metric {i + 1}</div>
              <div className="text-xl font-semibold">{(i + 3) * 137}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section id="runs" title="Runs">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              {['Run', 'Status', 'Started', 'Duration', 'Region', 'Cost', 'Owner'].map((c) => (
                <th
                  key={c}
                  data-sticky="head"
                  data-gap="0"
                  className="sticky top-(--page-sticky-top) z-10 border-b border-line bg-inset px-3 py-2 font-medium"
                  style={CONTROL ? { top: 0 } : undefined}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {range(90).map((i) => (
              <tr key={i} className="h-9">
                <td className="border-b border-line px-3">run-{hash(i + 1)}</td>
                <td className="border-b border-line px-3">{i % 7 === 0 ? 'failed' : 'ok'}</td>
                <td className="border-b border-line px-3">
                  2026-11-{String((i % 28) + 1).padStart(2, '0')}
                </td>
                <td className="border-b border-line px-3">{(i * 37) % 600}s</td>
                <td className="border-b border-line px-3">r{(i % 5) + 1}</td>
                <td className="border-b border-line px-3">{((i * 13) % 90) / 10}</td>
                <td className="border-b border-line px-3">team-{hash(i + 40)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      {TOC.slice(2).map((t) => (
        <Section key={t} id={t} title={t[0]?.toUpperCase() + t.slice(1)}>
          <div className="h-96 rounded-lg border border-line bg-surface" />
        </Section>
      ))}
    </Page>
  )
}

function AstroMap(): ReactNode {
  return (
    <Page fill>
      <PageBar
        title="Terrain map"
        parent="Astro"
        controls={['Layer: cloud', 'Hour: 22:00', 'Terrain: on']}
        tabs={['Map', 'Table']}
        actions={['Export']}
      />
      <div
        data-slot="map"
        className="relative min-h-[420px] flex-1 bg-inset"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 47px, var(--line) 47px 48px), repeating-linear-gradient(90deg, transparent 0 47px, var(--line) 47px 48px)',
        }}
      >
        <div className="absolute bottom-3 left-3 rounded-md border border-line bg-surface px-3 py-2">
          Legend: 0 to 100 % cover
        </div>
      </div>
    </Page>
  )
}

const DAYS = ['Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13', 'Sat 14', 'Sun 15']
function Week(): ReactNode {
  return (
    <Page>
      <PageBar
        title="Week 46"
        parent="Calendar"
        controls={['Calendars: 3']}
        tabs={['Week', 'Month', 'Agenda']}
        actions={['Prev', 'Today', 'Next']}
      />
      <div data-slot="week" data-sticky-scope className="px-4 pb-4">
        <div
          className="sticky top-(--page-sticky-top) z-10 grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b border-line bg-surface"
          data-sticky="head"
          data-gap="0"
        >
          <span />
          {DAYS.map((d) => (
            <span key={d} className="py-2 text-center font-medium">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
          {range(24).map((hr) => (
            <div key={hr} className="contents">
              <span className="h-14 pr-2 text-right text-xs text-muted">
                {String(hr).padStart(2, '0')}:00
              </span>
              {range(7).map((d) => (
                <span key={d} className="h-14 border-b border-l border-line" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Page>
  )
}

function Month(): ReactNode {
  return (
    <Page fill>
      <PageBar
        title="November 2026"
        parent="Calendar"
        controls={['Calendars: 3']}
        tabs={['Week', 'Month', 'Agenda']}
        actions={['Prev', 'Today', 'Next']}
      />
      <div
        data-slot="month"
        className="grid min-h-[420px] flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] px-4 pb-4"
      >
        {DAYS.map((d) => (
          <span key={d} className="py-1.5 text-center text-muted">
            {d.slice(0, 3)}
          </span>
        ))}
        {range(42).map((i) => (
          <span key={i} className="border-l border-t border-line p-1 text-xs text-muted">
            {(i % 30) + 1}
          </span>
        ))}
      </div>
    </Page>
  )
}

function Agenda(): ReactNode {
  return (
    <Page>
      <PageBar
        title="Agenda"
        parent="Calendar"
        controls={['Calendars: 3']}
        tabs={['Week', 'Month', 'Agenda']}
        actions={['Prev', 'Today', 'Next']}
      />
      <div
        data-slot="agenda"
        data-sticky-scope
        className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 px-4 pt-4"
      >
        <ul className="m-0 list-none p-0">
          {range(70).map((i) => (
            <li key={i} className="flex h-14 items-center border-b border-line">
              Event {hash(i + 9)} · {String(8 + (i % 10)).padStart(2, '0')}:00
            </li>
          ))}
        </ul>
        <div
          data-sticky="col"
          data-gap="16"
          className="sticky top-[calc(var(--page-sticky-top)+16px)] h-80 self-start rounded-lg border border-line bg-surface p-3"
        >
          Day summary
        </div>
      </div>
    </Page>
  )
}

// Shutterflow viewer: no PageBar, the contact sheet keeps its own measured scroller (raw-scroll waiver).
const ratios = range(360).map((i) => 0.66 + (((i * 7919) % 100) / 100) * 1.1)
function justify(width: number, targetH: number): { r: number[]; h: number }[] {
  const rows: { r: number[]; h: number }[] = []
  let cur: number[] = []
  let sum = 0
  for (const r of ratios) {
    cur.push(r)
    sum += r
    if (sum * targetH >= width) {
      rows.push({ r: cur, h: width / sum })
      cur = []
      sum = 0
    }
  }
  if (cur.length) rows.push({ r: cur, h: targetH })
  return rows
}

function ContactSheet(): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const rows = w > 0 ? justify(w - 16, 150) : []
  return (
    <div
      ref={ref}
      data-slot="contact-sheet"
      data-w={w}
      className="h-full min-h-0 overflow-y-auto p-2"
    >
      {rows.map((row, ri) => (
        <div key={ri} data-row className="flex gap-0" style={{ height: row.h }}>
          {row.r.map((r, i) => (
            <span
              key={i}
              data-tile
              className="block h-full border-2 border-bg"
              style={{ width: r * row.h, background: `hsl(${(ri * 37 + i * 61) % 360} 28% 55%)` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Viewer(): ReactNode {
  return (
    <Page fill>
      <div className="min-h-0 flex-1">
        <ContactSheet />
      </div>
    </Page>
  )
}

const VIEWS: Record<string, { aside: boolean; render: () => ReactNode }> = {
  argo: { aside: true, render: Argo },
  map: { aside: true, render: AstroMap },
  week: { aside: true, render: Week },
  month: { aside: true, render: Month },
  agenda: { aside: true, render: Agenda },
  viewer: { aside: true, render: Viewer },
}

// ── Shell ───────────────────────────────────────────────────────────────────────────────────

const RAIL_ITEMS = ['Overview', 'Sessions', 'Library', 'Albums', 'Map', 'Jobs', 'Tags', 'Settings']

function Shell(): ReactNode {
  const width = useWindowWidth()
  const size = sizeOf(width)
  const rail =
    size === 'compact'
      ? 'hidden'
      : RAIL_PARAM === 'expanded' || RAIL_PARAM === 'collapsed'
        ? RAIL_PARAM
        : size === 'expanded'
          ? 'expanded'
          : 'collapsed'
  const railW = rail === 'hidden' ? 0 : rail === 'expanded' ? RAIL_EXPANDED : RAIL_COLLAPSED
  const view = VIEWS[VIEW] ?? VIEWS.argo
  // dock "auto": expanded and 720 px of Main left; "always": medium and expanded (section 3.2 table, DPO 17).
  const docked =
    Boolean(view?.aside) &&
    (DOCK === 'always' ? size !== 'compact' : size === 'expanded' && width - railW - ASIDE_W >= 720)
  const [barH, setBarH] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  // Scroll restoration: Main is the scrollport, restored in a layout effect after the page mounted.
  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return
    const saved = sessionStorage.getItem(`scroll:${VIEW}`)
    if (saved && !location.hash) main.scrollTop = Number(saved)
    const save = (): void => sessionStorage.setItem(`scroll:${VIEW}`, String(main.scrollTop))
    main.addEventListener('scroll', save, { passive: true })
    return () => main.removeEventListener('scroll', save)
  }, [])
  const style = {
    '--rail-w': `${railW}px`,
    '--aside-w': `${docked ? ASIDE_W : 0}px`,
    '--page-bar-h': `${barH}px`,
  } as CSSProperties
  return (
    <HostCtx.Provider
      value={{ mirror: CONTROL_MIRROR ? (h) => void setTimeout(() => setBarH(h), 50) : setBarH }}
    >
      <div
        data-slot="shell"
        data-size={size}
        data-rail={rail}
        className="grid h-dvh grid-cols-[var(--rail-w)_minmax(0,1fr)_var(--aside-w)] grid-rows-[var(--header-h)_minmax(0,1fr)] overflow-hidden"
        style={style}
      >
        <Header size={size} railW={railW} />
        <nav
          data-slot="shell-rail"
          aria-label="Primary"
          className={cn(
            'col-start-1 row-start-2 min-h-0 overflow-hidden border-r border-line bg-surface p-2',
            rail === 'hidden' && 'hidden',
          )}
        >
          {RAIL_ITEMS.map((r) => (
            <div key={r} className="flex h-9 items-center gap-2 rounded-md px-2.5">
              <Glyph />
              {rail === 'expanded' && <span className="truncate">{r}</span>}
            </div>
          ))}
        </nav>
        <main
          ref={mainRef}
          data-slot="shell-main"
          tabIndex={-1}
          className="col-start-2 row-start-2 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden"
        >
          <Nested>{view?.render()}</Nested>
        </main>
        <aside
          data-slot="shell-aside"
          aria-label="Details"
          className={cn(
            'col-start-3 row-start-2 min-h-0 overflow-hidden border-l border-line bg-surface',
            !docked && 'hidden',
          )}
        >
          <div
            data-slot="shell-aside-header"
            className="box-content flex items-center border-b border-line px-4 font-semibold"
            style={{ height: 'max(var(--page-bar-h), 40px)' }}
          >
            Details
          </div>
          <div className="h-[calc(100%-max(var(--page-bar-h),40px)-1px)] overflow-y-auto p-4">
            {range(14).map((i) => (
              <div key={i} className="flex justify-between border-b border-line py-2">
                <span className="text-muted">Field {i + 1}</span>
                <span>{hash(i + 70)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </HostCtx.Provider>
  )
}

const root = document.getElementById('app')
if (root) createRoot(root).render(<Shell />)
