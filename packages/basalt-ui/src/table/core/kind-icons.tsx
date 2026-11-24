/**
 * The default header icon of each kind (docs/v3/concepts/data-table.md section 5): a 16 px glyph on
 * a 16 px grid at the 1.5 px stroke of the shipped glyphs, drawn in the header's secondary ink before
 * the label. A column names its own with `headerIcon` or turns it off with `headerIcon: false`; a
 * table turns all of them off with `headerIcons: false`. `custom` and `actions` draw none.
 */
import type { ReactElement } from 'react'
import type { IconComponent } from '../../core/ports'
import type { KindName } from './kinds-spec'

/** One stroke glyph: the paths, plus dots filled in the stroke's ink. */
function glyph(
  paths: readonly string[],
  dots: readonly [number, number, number][] = [],
): IconComponent {
  function KindIcon({
    className,
    size = 16,
  }: {
    className?: string
    size?: number | string
  }): ReactElement {
    return (
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        data-slot="table-kind-icon"
        {...(className !== undefined && { className })}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
        {dots.map(([cx, cy, r]) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
        ))}
      </svg>
    )
  }
  return KindIcon
}

const TEXT = glyph(['M3 4h10', 'M3 8h10', 'M3 12h6'])
const ENTITY = glyph([
  'M4 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V4A1.5 1.5 0 0 1 4 2.5z',
  'M5.5 6h5',
  'M5.5 9h3',
])
const LINK = glyph([
  'M6.5 9.5l3-3',
  'M7.25 4.75l.75-.75a2.47 2.47 0 0 1 3.5 3.5l-.75.75',
  'M8.75 11.25l-.75.75a2.47 2.47 0 0 1-3.5-3.5l.75-.75',
])
const PERSON = glyph([
  'M10.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  'M3 13.5c.4-2.3 2.4-3.5 5-3.5s4.6 1.2 5 3.5',
])
const TAGS = glyph(['M2.5 3.5v3.6l6.4 6.4 4.6-4.6-6.4-6.4H3.5a1 1 0 0 0-1 1z'], [[5.5, 5.5, 1]])
const TIMER = glyph(['M13 9A5 5 0 1 1 3 9a5 5 0 0 1 10 0z', 'M8 9V6.5', 'M6.5 2h3'])
const NUMBER = glyph(['M3 6h10', 'M3 10h10', 'M6.5 2.5l-1 11', 'M10.5 2.5l-1 11'])
const MONEY = glyph([
  'M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z',
  'M9.75 6.25C9.4 5.8 8.8 5.5 8 5.5c-1 0-1.75.55-1.75 1.25 0 1.75 3.5 1 3.5 2.75 0 .7-.75 1.25-1.75 1.25-.8 0-1.4-.3-1.75-.75',
  'M8 4.5v1',
  'M8 10.5v1',
])
const DATE = glyph([
  'M4 3.5h8a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V5A1.5 1.5 0 0 1 4 3.5z',
  'M2.5 7h11',
  'M5.5 2v3',
  'M10.5 2v3',
])
const CLOCK = glyph(['M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z', 'M8 5v3l2 1.5'])
const STATUS = glyph(['M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z'], [[8, 8, 2]])
const DELTA = glyph(['M2 11.5l4-4 3 3 5-5', 'M10 5.5h4v4'])
const METER = glyph(['M2.5 11.5a5.5 5.5 0 1 1 11 0', 'M8 11.5l2.5-3'])
const PROGRESS = glyph(['M3 6h10', 'M3 10h6'])
const BOOLEAN = glyph([
  'M4.5 2.5h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
  'M5.5 8l1.75 1.75L10.5 6.5',
])
const SPARK = glyph(['M1.5 8h3l2-5 3 10 2-5h3'])
const SELECT = glyph(['M5 6l3-3 3 3', 'M5 10l3 3 3-3'])

/** The icon a kind's header draws by default; `null` draws none. */
export const KIND_ICONS: Readonly<Record<KindName, IconComponent | null>> = {
  person: PERSON,
  tags: TAGS,
  countdown: TIMER,
  link: LINK,
  entity: ENTITY,
  text: TEXT,
  number: NUMBER,
  money: MONEY,
  date: DATE,
  relativeTime: CLOCK,
  status: STATUS,
  delta: DELTA,
  meter: METER,
  progress: PROGRESS,
  boolean: BOOLEAN,
  spark: SPARK,
  select: SELECT,
  actions: null,
  custom: null,
}
