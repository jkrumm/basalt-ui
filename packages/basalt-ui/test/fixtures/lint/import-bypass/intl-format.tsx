// Fixture: primitive-bypass/intl-format. On in the table.
// @invalid
const f = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' })
// @invalid
const f = new Intl.NumberFormat('en-US').format(n)
// @invalid
const s = d.toLocaleDateString('de-DE')
// @invalid
const s = n.toLocaleString()
// @invalid
const f = Intl.RelativeTimeFormat('en')
// @valid
const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone
// @valid
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
// @valid
const f = new Intl.PluralRules('en')
// @valid
const s = format.number(n)
// @valid
const s = list.toString()
// @valid
const s = useFormat().time(d, { hour: '2-digit' })
// @invalid
const a = <span>{(v * 100).toFixed(1)}%</span>
// @invalid
const a = <span>{`${n.toFixed(1)} ms`}</span>
// @invalid
const a = <p>{ok ? n.toFixed(2) : '-'}</p>
// @invalid
import { format } from 'date-fns'
const a = <span>{format(run.at, 'MMM d')}</span>
// @invalid
import { formatDistanceToNow as ago } from 'date-fns'
const s = ago(run.at)
// @valid
const key = `k-${n.toFixed(1)}`
// @valid
const a = <div style={{ flexBasis: `${pct.toFixed(1)}%` }} />
// @valid
const a = <Meter value={n.toFixed(1)} />
// @valid
const a = <span>{format.number(n)}</span>
// @valid
import { format } from './format'
const s = format(run.at, 'MMM d')
// @valid
import { parseISO } from 'date-fns'
const d = parseISO(text)
// @valid
// @filename recipes/dates.test.ts
const s = d.toLocaleDateString()
// @valid
// @filename recipes/dates.spec.tsx
const f = new Intl.NumberFormat('en-US')
// @valid
// @filename recipes/dates.test.tsx
const a = <span>{n.toFixed(1)}</span>
// @invalid
// @filename recipes/dates.ts
const s = d.toLocaleDateString()
// @invalid
const a = <span>{dayjs(at).format('DD.MM.YYYY')}</span>
// @invalid
const s = moment(at).utc().format('LL')
// @invalid
const s = dayjs.utc(at).format('LL')
// @valid
const s = dayjs(at).toISOString()
// @valid
const s = useFormat().time(at)
// @valid
const s = template(text).format(data)
