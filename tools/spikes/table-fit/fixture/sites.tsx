/**
 * The synthetic sites of the table-fit spike. Each one reproduces an argo table's column kinds,
 * order, priorities and text lengths (read from argo, never copied: every row is generated here
 * from a seeded PRNG and invented words), ported to `col<T>()` kinds.
 *
 * `needs` is what the argo `renderCard` of that site shows, one entry per thing a person reads or
 * does on the card; `run.ts` checks each against the derived card plan (S4). A site with no
 * `renderCard` in argo (`spark-grid`) carries none and is S3 only.
 */
import type { ReactElement, ReactNode } from 'react'
import { col } from '../../../../packages/basalt-ui/src/table/core/kinds'
import type { KindColumn, UseDataTable } from '../../../../packages/basalt-ui/src/table/contract'

// ---- seeded data ---------------------------------------------------------------------------

function prng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pickFrom = <V,>(rand: () => number, list: readonly V[]): V =>
  list[Math.floor(rand() * list.length)] as V
const between = (rand: () => number, lo: number, hi: number): number => lo + rand() * (hi - lo)
const day = (n: number): string =>
  `2026-${String(1 + (n % 9)).padStart(2, '0')}-${String(1 + ((n * 7) % 28)).padStart(2, '0')}`

const MERCHANTS = [
  'Nordlicht Markt',
  'Brotkorb Baeckerei am Wall',
  'Stadtwerke Elbtal Energie',
  'Kleinfeld Versicherungen AG',
  'Mobilfunk Rheinland GmbH & Co. KG',
  'Tannenhof Apotheke',
  'Quellwasser Getraenke',
  'Fahrrad Ostwind',
  'Lindenblatt Buchhandlung',
  'Kaffeehaus Zum Anker',
  'Gartenfreunde Suedstadt e.V.',
  'Verkehrsverbund Mittelland',
  'Hafenkante Fischhandel',
  'Sonnenschein Photovoltaik Dienstleistungs- und Beratungsgesellschaft mbH',
  'Wiesengrund',
  'Arztpraxis Dr. Birkenfeld',
] as const

const PURPOSES = [
  '',
  'Rechnung 2026-0412',
  'SEPA-Lastschrift Mandat 4471 Beitrag Oktober',
  'Dauerauftrag Miete Oktober inkl. Nebenkosten Vorauszahlung',
  'Kartenzahlung 14.10. 18:42 Terminal 7731',
  '',
  'Erstattung zu viel gezahlter Abschlag, Ihre Rechnung vom 02.09.2026 Kundennummer 88213',
  'Jahresbeitrag',
  '',
  'Sammelueberweisung',
] as const

const ACCOUNTS = ['Girokonto', 'Haushalt', 'Kreditkarte'] as const
const CATEGORIES = [
  'Groceries',
  'Rent',
  'Insurance',
  'Energy',
  'Telecom',
  'Transport',
  'Dining out',
  'Health',
  'Subscriptions',
  'Uncategorised',
] as const
const TAGS = ['No tag', 'Business', 'Tax', 'Donation', 'Private'] as const

// ---- site model ----------------------------------------------------------------------------

/** One thing the argo card shows or lets a person do. */
export type Need = {
  label: string
  /** Column ids this need reads from. */
  cols: readonly string[]
  /**
   * `read`: text on the card. `edit`: a select the card keeps live (a `c.select`). `tap`: a
   * one-tap control (a button that commits on press), which no derived place can hold. `action`:
   * a command the card may reach through its kebab (one tap more than argo's button).
   */
  kind: 'read' | 'edit' | 'tap' | 'action'
  /** Where argo puts it, when the slot matters for hierarchy. */
  expect?: 'title' | 'value'
}

export type Site<R> = {
  id: string
  /** The argo site this stands for (file or component name). */
  argo: string
  /** Why it is in the spike, in a clause. */
  note: string
  columns: () => KindColumn<R>[]
  /** Column ids in the order that puts the card's `value` first, if argo's order does not. */
  reorder?: readonly string[]
  rows: readonly R[]
  getRowId: (row: R) => string
  props?: Partial<UseDataTable<R>>
  needs: readonly Need[]
}

// ---- ledger (argo transactions, BookingRow) ------------------------------------------------

type Booking = {
  id: string
  booked_on: string
  merchant: string
  account: string
  purpose: string
  category: string
  tax_tag: string
  amount: number
}

function bookings(count: number): Booking[] {
  const rand = prng(11)
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    booked_on: day(i * 3),
    merchant: MERCHANTS[i % MERCHANTS.length] as string,
    account: pickFrom(rand, ACCOUNTS),
    purpose: PURPOSES[(i * 3) % PURPOSES.length] as string,
    category: pickFrom(rand, CATEGORIES),
    tax_tag: pickFrom(rand, TAGS),
    amount: -Math.round(between(rand, 2, 2400) * 100) / 100 + (i % 7 === 0 ? 3100 : 0),
  }))
}

function selectOf(options: readonly string[]) {
  return (label: string) => ({
    label: () => label,
    options,
    commit: () => undefined,
  })
}

const ledgerCol = col<Booking>()
const ledger: Site<Booking> = {
  id: 'ledger',
  argo: 'transactions + BookingRow',
  note: 'the ledger: identity with a sub line, two selects, a signed amount, selection and a kebab',
  columns: () => [
    ledgerCol.date('booked_on', { header: 'Date', priority: 1 }),
    ledgerCol.entity('merchant', {
      header: 'Merchant',
      sub: (row) => [row.account, row.purpose].filter(Boolean).join(' · '),
    }),
    ledgerCol.select('category', { header: 'Category', ...selectOf(CATEGORIES)('Category') }),
    ledgerCol.select('tax_tag', {
      header: 'Tax tag',
      priority: 3,
      ...selectOf(TAGS)('Tax tag'),
    }),
    ledgerCol.money('amount', { header: 'Amount', currency: 'EUR' }),
    ledgerCol.actions([
      { key: 'rule', label: 'Always use this category', onClick: () => undefined },
    ]),
  ],
  rows: bookings(12),
  getRowId: (row) => row.id,
  props: { selection: { bulk: [{ key: 'tag', label: 'Tag', onClick: () => undefined }] } },
  needs: [
    { label: 'booking name', cols: ['merchant'], kind: 'read', expect: 'title' },
    { label: 'signed amount', cols: ['amount'], kind: 'read', expect: 'value' },
    { label: 'date', cols: ['booked_on'], kind: 'read' },
    { label: 'purpose (entity sub line)', cols: ['merchant'], kind: 'read' },
    { label: 'category select', cols: ['category'], kind: 'edit' },
    { label: 'tax tag select', cols: ['tax_tag'], kind: 'edit' },
  ],
}

// ---- tax queue -----------------------------------------------------------------------------

type QueueRow = {
  id: string
  merchant: string
  booked_on: string
  category: string
  purpose: string
  tax_tag: string
  amount: number
}

const queueRows: QueueRow[] = bookings(10).map((b) => ({
  id: b.id,
  merchant: b.merchant,
  booked_on: b.booked_on,
  category: b.category,
  purpose: b.purpose,
  tax_tag: 'No tag',
  amount: b.amount < 0 ? b.amount : -b.amount,
}))

const queueCol = col<QueueRow>()
const tax: Site<QueueRow> = {
  id: 'tax',
  argo: 'tax queue (QueueRow, not a DataTable in argo)',
  note: 'a triage queue: name, amount, date and category, then one-tap tags, a select and a merchant action',
  columns: () => [
    queueCol.entity('merchant', { header: 'Merchant' }),
    queueCol.money('amount', { header: 'Amount', currency: 'EUR' }),
    queueCol.date('booked_on', { header: 'Date', priority: 2 }),
    queueCol.text('category', { header: 'Category', priority: 2 }),
    queueCol.text('purpose', { header: 'Purpose', priority: 3 }),
    queueCol.select('tax_tag', { header: 'Tax tag', ...selectOf(TAGS)('Tax tag') }),
    queueCol.actions([
      {
        key: 'merchant',
        label: 'Tag every untagged booking of this merchant',
        onClick: () => undefined,
      },
    ]),
  ],
  rows: queueRows,
  getRowId: (row) => row.id,
  needs: [
    { label: 'booking name', cols: ['merchant'], kind: 'read', expect: 'title' },
    { label: 'signed amount', cols: ['amount'], kind: 'read', expect: 'value' },
    { label: 'date', cols: ['booked_on'], kind: 'read' },
    { label: 'category', cols: ['category'], kind: 'read' },
    { label: 'purpose', cols: ['purpose'], kind: 'read' },
    { label: 'four one-tap tag buttons (business, tax, donation, private)', cols: [], kind: 'tap' },
    { label: 'rarer-tags select', cols: ['tax_tag'], kind: 'edit' },
    { label: 'Same merchant button (kebab action)', cols: ['actions'], kind: 'action' },
  ],
}

// ---- catalog (14 columns) ------------------------------------------------------------------

type Variant = {
  slug: string
  model: string
  superseded: boolean
  effort: string
  creator: string
  released: string
  intelligence: number
  index: number | null
  cost: number | null
  time: number | null
  tokens: number | null
  speed: number | null
  priceIn: number | null
  priceOut: number | null
  iu: string
  routes: number
}

const MODELS = [
  'Claude Opus 4.5',
  'GPT-5.2 Codex',
  'Gemini 3 Pro Preview',
  'Kimi K2 Thinking',
  'DeepSeek V3.2 Speciale',
  'Qwen3 235B A22B Instruct 2507',
  'Llama 4 Maverick',
  'gpt-oss-120B',
  'Mistral Large 3',
  'GLM-4.6',
  'Grok 4 Fast Reasoning',
  'MiniMax-M2',
] as const
const EFFORTS = ['default', 'low', 'medium', 'high', 'max'] as const
const CREATORS = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Moonshot AI',
  'DeepSeek',
  'Alibaba',
  'Meta',
  'Mistral',
] as const
const IU = [
  'callable · api, bedrock',
  'callable · api',
  'not callable',
  'callable · api, bedrock, vertex',
] as const

function variants(count: number): Variant[] {
  const rand = prng(23)
  return Array.from({ length: count }, (_, i) => {
    const gap = (v: number): number | null => (i % 5 === 3 ? null : v)
    return {
      slug: `v${i}`,
      model: MODELS[i % MODELS.length] as string,
      superseded: i % 6 === 4,
      effort: EFFORTS[i % EFFORTS.length] as string,
      creator: CREATORS[i % CREATORS.length] as string,
      released: day(i * 5 + 2),
      intelligence: Math.round(between(rand, 38, 74) * 10) / 10,
      index: gap(Math.round(between(rand, 0.4, 9.9) * 100) / 100),
      cost: gap(Math.round(between(rand, 0.04, 48) * 100) / 100),
      time: gap(Math.round(between(rand, 12, 2400))),
      tokens: gap(Math.round(between(rand, 3000, 900000))),
      speed: gap(Math.round(between(rand, 18, 312))),
      priceIn: gap(Math.round(between(rand, 0.05, 15) * 100) / 100),
      priceOut: gap(Math.round(between(rand, 0.2, 75) * 100) / 100),
      iu: IU[i % IU.length] as string,
      routes: i % 4 === 0 ? 0 : (i % 5) + 1,
    }
  })
}

const vc = col<Variant>()
const catalog: Site<Variant> = {
  id: 'catalog',
  argo: 'catalog-table + CatalogCard',
  note: 'fourteen columns, graded priorities 0-11 in argo folded to three, long model names',
  columns: () => [
    vc.entity('model', { header: 'Model', sub: (r) => (r.superseded ? 'superseded' : undefined) }),
    vc.number('intelligence', { header: 'Intel.', digits: 1, priority: 1 }),
    vc.status('effort', { header: 'Effort', options: EFFORTS, priority: 2 }),
    vc.text('creator', { header: 'Creator', priority: 3 }),
    vc.date('released', { header: 'Released', priority: 3 }),
    vc.number('index', { header: 'Index', digits: 2, priority: 2 }),
    vc.money('cost', { header: '$ / task', currency: 'USD', priority: 2 }),
    vc.number('time', { header: '≈ Time (s)', priority: 3 }),
    vc.number('tokens', { header: '≈ Tokens', priority: 3 }),
    vc.number('speed', { header: 'Speed (tok/s)', priority: 3 }),
    vc.money('priceIn', { header: '$ in /1M', currency: 'USD', priority: 3 }),
    vc.money('priceOut', { header: '$ out /1M', currency: 'USD', priority: 3 }),
    vc.text('iu', { header: 'IU', priority: 3 }),
    vc.number('routes', { header: 'Routes', priority: 2 }),
  ],
  rows: variants(12),
  getRowId: (row) => row.slug,
  props: { onRowActivate: () => undefined },
  needs: [
    { label: 'model name (and superseded)', cols: ['model'], kind: 'read', expect: 'title' },
    { label: 'effort', cols: ['effort'], kind: 'read' },
    { label: 'creator', cols: ['creator'], kind: 'read' },
    { label: 'intelligence', cols: ['intelligence'], kind: 'read' },
    { label: 'index', cols: ['index'], kind: 'read' },
    { label: '$ / task', cols: ['cost'], kind: 'read' },
    { label: 'time', cols: ['time'], kind: 'read' },
    { label: 'tokens', cols: ['tokens'], kind: 'read' },
    { label: 'price in', cols: ['priceIn'], kind: 'read' },
    { label: 'price out', cols: ['priceOut'], kind: 'read' },
    { label: 'IU access', cols: ['iu'], kind: 'read' },
    { label: 'routes', cols: ['routes'], kind: 'read' },
  ],
}

// ---- slots-list (text-heavy) ---------------------------------------------------------------

type Slot = {
  key: string
  name: string
  routes: number
  billed: boolean
  reason: string
  intelligence: number | null
  index: number | null
  cost: number | null
  time: number | null
  tokens: number | null
  onMax: string
  anywhere: string
}

const SLOT_NAMES = [
  'Claude Sonnet 4.5 (high)',
  'anthropic/claude-haiku-4-5-20251001',
  'GPT-5.2 Codex (medium)',
  'Gemini 3 Flash',
  'Kimi K2 Thinking',
  'deepseek/deepseek-v3.2-speciale-reasoner',
  'Qwen3 Coder 480B A35B',
  'gpt-oss-120B (high)',
] as const
const OPTION_TEXT = [
  'Kimi K2 Thinking · +0.4 pts · 1.3x index · $0.12 / task · 3m',
  'GLM-4.6 · +1.1 pts · 2.1x index · $0.08 / task · 5m',
  'Already leanest',
  '–',
  'Claude Haiku 4.5 (high) · +0.0 pts · 1.8x index · $0.31 / task · 2m',
] as const

function slots(count: number): Slot[] {
  const rand = prng(37)
  return Array.from({ length: count }, (_, i) => {
    const none = i % 7 === 5
    return {
      key: `s${i}`,
      name: SLOT_NAMES[i % SLOT_NAMES.length] as string,
      routes: (i % 3) + 1,
      billed: i % 3 === 0,
      reason: none ? 'No Artificial Analysis row for this route' : '',
      intelligence: none ? null : Math.round(between(rand, 38, 74) * 10) / 10,
      index: none ? null : Math.round(between(rand, 0.4, 9.9) * 100) / 100,
      cost: none ? null : Math.round(between(rand, 0.04, 48) * 100) / 100,
      time: none ? null : Math.round(between(rand, 12, 2400)),
      tokens: none ? null : Math.round(between(rand, 3000, 900000)),
      onMax: OPTION_TEXT[i % OPTION_TEXT.length] as string,
      anywhere: OPTION_TEXT[(i + 2) % OPTION_TEXT.length] as string,
    }
  })
}

const sc = col<Slot>()
const slotsList: Site<Slot> = {
  id: 'slots-list',
  argo: 'slots-list',
  note: 'text-heavy: a two-line identity and two long sentence columns',
  columns: () => [
    sc.entity('name', {
      header: 'Slot',
      sub: (r) =>
        [
          `${r.routes} ${r.routes === 1 ? 'route' : 'routes'} · ${r.billed ? 'billed' : 'Max quota'}`,
          r.reason,
        ]
          .filter(Boolean)
          .join(' · '),
    }),
    sc.number('intelligence', { header: 'Intel.', digits: 1, priority: 3 }),
    sc.number('index', { header: 'Index', digits: 2, priority: 3 }),
    sc.money('cost', { header: '$ / task', currency: 'USD', priority: 3 }),
    sc.number('time', { header: '≈ Time (s)', priority: 3 }),
    sc.number('tokens', { header: '≈ Tokens', priority: 3 }),
    sc.text('onMax', { header: 'Leanest on Max', priority: 1 }),
    sc.text('anywhere', { header: 'Leanest anywhere', priority: 2 }),
  ],
  rows: slots(10),
  getRowId: (row) => row.key,
  props: { onRowActivate: () => undefined },
  needs: [
    {
      label: 'slot name, route count, billing and reason',
      cols: ['name'],
      kind: 'read',
      expect: 'title',
    },
    { label: 'intelligence', cols: ['intelligence'], kind: 'read' },
    { label: 'index', cols: ['index'], kind: 'read' },
    { label: '$ / task', cols: ['cost'], kind: 'read' },
    { label: 'time', cols: ['time'], kind: 'read' },
    { label: 'tokens', cols: ['tokens'], kind: 'read' },
    { label: 'Leanest on Max (name and measures)', cols: ['onMax'], kind: 'read' },
    { label: 'Leanest anywhere (name and measures)', cols: ['anywhere'], kind: 'read' },
  ],
}

// ---- spending ------------------------------------------------------------------------------

type Spend = {
  key: string
  category: string
  total: number
  perMonth: number
  change: number | null
  monthly: number[]
}

function sparkline(data: readonly number[], width: number, height: number): ReactElement {
  const max = Math.max(...data, 1)
  const step = width / Math.max(data.length - 1, 1)
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`)
    .join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function spending(count: number): Spend[] {
  const rand = prng(51)
  return Array.from({ length: count }, (_, i) => {
    const monthly = Array.from({ length: 6 }, () => Math.round(between(rand, 20, 900)))
    const total = monthly.reduce((a, b) => a + b, 0)
    return {
      key: `c${i}`,
      category: CATEGORIES[i % CATEGORIES.length] as string,
      total,
      perMonth: Math.round(total / 6),
      change: i % 4 === 2 ? null : Math.round(between(rand, -240, 310)),
      monthly,
    }
  })
}

const pc = col<Spend>()
const spendingSite: Site<Spend> = {
  id: 'spending',
  argo: 'spending',
  note: 'category totals with a delta and a bar sparkline',
  columns: () => [
    pc.entity('category', { header: 'Category' }),
    pc.money('total', { header: 'Total', currency: 'EUR' }),
    pc.money('perMonth', { header: 'Per month', currency: 'EUR', priority: 2 }),
    pc.delta('change', { header: 'Oct change', polarity: 'up-bad', priority: 1 }),
    pc.spark('trend', {
      header: 'Months',
      label: 'Monthly spending',
      priority: 3,
      render: (row) => sparkline(row.monthly, 96, 22),
    }),
  ],
  rows: spending(8),
  getRowId: (row) => row.key,
  props: { onRowActivate: () => undefined },
  needs: [
    { label: 'category', cols: ['category'], kind: 'read', expect: 'title' },
    { label: 'total', cols: ['total'], kind: 'read', expect: 'value' },
    { label: 'per month', cols: ['perMonth'], kind: 'read' },
    { label: 'change', cols: ['change'], kind: 'read' },
  ],
}

// ---- net-worth positions (numeric) ---------------------------------------------------------

type Position = {
  id: string
  name: string
  isin: string
  quantity: number
  price: number
  value: number
  share: number
  as_of: string
}

function positions(count: number): Position[] {
  const rand = prng(67)
  const rows = Array.from({ length: count }, (_, i) => {
    const quantity = Math.round(between(rand, 0.5, 4200) * 10000) / 10000
    const price = Math.round(between(rand, 4, 380) * 100) / 100
    return {
      id: `p${i}`,
      name: pickFrom(rand, [
        'Weltportfolio Aktien Thesaurierend',
        'Schwellenlaender Index ETF',
        'Staatsanleihen Europa 1-3J',
        'Nordwind Energie AG',
        'Rohstoff Mix',
      ] as const),
      isin: `XX${String(1000000000 + Math.floor(rand() * 8999999999))}`.slice(0, 12),
      quantity,
      price,
      value: Math.round(quantity * price * 100) / 100,
      share: 0,
      as_of: day(i + 40),
    }
  })
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  return rows.map((r) => ({ ...r, share: Math.round((r.value / total) * 1000) / 10 }))
}

const nc = col<Position>()
const netWorth: Site<Position> = {
  id: 'net-worth',
  argo: 'net-worth positions',
  note: 'numeric: five number-like columns beside a name, declared units-first as argo does',
  columns: () => [
    nc.entity('name', { header: 'Position', sub: (r) => r.isin }),
    nc.number('quantity', { header: 'Units', digits: 4, priority: 3 }),
    nc.money('price', { header: 'Price', currency: 'EUR', priority: 2 }),
    nc.money('value', { header: 'Value', currency: 'EUR', priority: 1 }),
    nc.number('share', { header: 'Share (%)', digits: 1, priority: 2 }),
    nc.date('as_of', { header: 'As of', priority: 3 }),
  ],
  reorder: ['name', 'value', 'quantity', 'price', 'share', 'as_of'],
  rows: positions(9),
  getRowId: (row) => row.id,
  needs: [
    { label: 'position name', cols: ['name'], kind: 'read', expect: 'title' },
    { label: 'value', cols: ['value'], kind: 'read', expect: 'value' },
    { label: 'units', cols: ['quantity'], kind: 'read' },
    { label: 'share of the depot', cols: ['share'], kind: 'read' },
  ],
}

// ---- recurring (three tables, one card) ----------------------------------------------------

type Series = {
  id: string
  merchant: string
  seat: string
  category: string
  cadence: string
  charge: number
  monthly: number
  next: string | null
  state: string
}

function series(count: number, seed: number): Series[] {
  const rand = prng(seed)
  const cadences = ['Monthly', 'Yearly', 'Quarterly', 'Every 2 months'] as const
  return Array.from({ length: count }, (_, i) => {
    const cadence = cadences[i % cadences.length] as string
    const charge = Math.round(between(rand, 3, 480) * 100) / 100
    const per = { Monthly: 1, Yearly: 12, Quarterly: 3, 'Every 2 months': 2 }[cadence] ?? 1
    return {
      id: `r${seed}-${i}`,
      merchant: MERCHANTS[(i + seed) % MERCHANTS.length] as string,
      seat: i % 3 === 0 ? 'Familie, 2 Personen' : '',
      category: CATEGORIES[(i + 2) % CATEGORIES.length] as string,
      cadence,
      charge,
      monthly: Math.round((charge / per) * 100) / 100,
      next: i % 5 === 4 ? null : day(i * 4 + seed),
      state: i % 2 === 0 ? 'Left out' : `Stopped ${day(i + seed)}`,
    }
  })
}

const rc = col<Series>()
const recurringColumns = (): KindColumn<Series>[] => [
  rc.entity('merchant', {
    header: 'Payee',
    sub: (r) => [r.seat, r.category].filter(Boolean).join(' · '),
  }),
  rc.text('cadence', { header: 'Paid', priority: 3 }),
  rc.money('charge', { header: 'Per charge', currency: 'EUR', priority: 2 }),
  rc.money('monthly', { header: 'Per month', currency: 'EUR', priority: 1 }),
  rc.date('next', { header: 'Next', priority: 2 }),
]
const recurringNeeds: Need[] = [
  { label: 'payee', cols: ['merchant'], kind: 'read', expect: 'title' },
  { label: 'per month', cols: ['monthly'], kind: 'read', expect: 'value' },
  { label: 'seat and category (entity sub line)', cols: ['merchant'], kind: 'read' },
  { label: 'per charge and cadence', cols: ['charge', 'cadence'], kind: 'read' },
  { label: 'next charge', cols: ['next'], kind: 'read' },
]
const recurringReorder = ['merchant', 'monthly', 'cadence', 'charge', 'next'] as const

const recurringSubscriptions: Site<Series> = {
  id: 'recurring-subscriptions',
  argo: 'recurring (Subscriptions)',
  note: 'declared charge-first as argo does: the card value should be the monthly figure',
  columns: recurringColumns,
  reorder: recurringReorder,
  rows: series(9, 101),
  getRowId: (row) => row.id,
  props: { onRowActivate: () => undefined },
  needs: recurringNeeds,
}
const recurringBills: Site<Series> = {
  ...recurringSubscriptions,
  id: 'recurring-bills',
  argo: 'recurring (Bills)',
  rows: series(5, 202),
}
const recurringApart: Site<Series> = {
  id: 'recurring-apart',
  argo: 'recurring (Stopped and left out)',
  note: 'argo renders the same card over a three-column table, so charge, cadence and next are not columns there',
  columns: () => [
    rc.entity('merchant', {
      header: 'Payee',
      sub: (r) => [r.seat, r.category].filter(Boolean).join(' · '),
    }),
    rc.text('state', { header: 'State', priority: 2 }),
    rc.money('monthly', { header: 'Per month', currency: 'EUR', priority: 1 }),
    rc.text('cadence', { header: 'Paid', priority: 3 }),
    rc.money('charge', { header: 'Per charge', currency: 'EUR', priority: 3 }),
    rc.date('next', { header: 'Next', priority: 3 }),
  ],
  reorder: ['merchant', 'monthly', 'state', 'cadence', 'charge', 'next'],
  rows: series(4, 303),
  getRowId: (row) => row.id,
  props: { onRowActivate: () => undefined },
  needs: [...recurringNeeds, { label: 'stopped / left out state', cols: ['state'], kind: 'read' }],
}

// ---- spark grid (strength tracker, S3 only) ------------------------------------------------

type Lift = {
  id: string
  exercise: string
  vel: number | null
  volume: number[]
  inol: number[]
}

const LIFTS = [
  'Barbell Back Squat',
  'Romanian Deadlift',
  'Incline Dumbbell Bench Press',
  'Weighted Pull-Up',
  'Overhead Press',
  'Bulgarian Split Squat',
  'Barbell Row',
  'Standing Calf Raise',
] as const

function lifts(count: number): Lift[] {
  const rand = prng(79)
  return Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    exercise: LIFTS[i % LIFTS.length] as string,
    vel: i % 6 === 5 ? null : Math.round(between(rand, -3.4, 4.8) * 10) / 10,
    volume: Array.from({ length: 10 }, () => Math.round(between(rand, 4, 22) * 10) / 10),
    inol: Array.from({ length: 15 }, () => Math.round(between(rand, 0.2, 1.9) * 100) / 100),
  }))
}

const NBSP = ' '
const zone = (v: number): string =>
  v < 0.4
    ? 'Too Light'
    : v < 0.7
      ? 'Recovery'
      : v <= 1
        ? 'Optimal'
        : v <= 1.5
          ? 'Hard'
          : 'Excessive'

function figureSpark(data: readonly number[], figure: (latest: number) => string): ReactNode {
  const latest = data.at(-1)
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      {sparkline(data, 80, 28)}
      <span>{latest === undefined ? '–' : figure(latest)}</span>
    </span>
  )
}

const lc = col<Lift>()
const sparkGrid: Site<Lift> = {
  id: 'spark-grid',
  argo: 'sparkline-grid-chart',
  note: 'the spark kind at argo’s own geometry: an 80 px sparkline beside a figure with its unit or zone',
  columns: () => [
    lc.entity('exercise', { header: 'Exercise' }),
    lc.delta('vel', { header: 'Trend, 28 d (%/mo)', polarity: 'up-good', priority: 1 }),
    lc.spark('volume', {
      header: 'Volume, last 10 training weeks',
      label: 'Weekly volume in tonnes',
      priority: 2,
      render: (row) => figureSpark(row.volume, (v) => `${v.toFixed(1)}${NBSP}t/wk`),
    }),
    lc.spark('inol', {
      header: 'INOL, last 15 sessions',
      label: 'INOL per session',
      priority: 3,
      render: (row) => figureSpark(row.inol, (v) => `${v.toFixed(2)}${NBSP}${zone(v)}`),
    }),
  ],
  rows: lifts(8),
  getRowId: (row) => row.id,
  needs: [],
}

// ---- registry ------------------------------------------------------------------------------

/** The tables S3 measures: argo's ledger, text-heavy and numeric tables, the catalog, the spark grid. */
export const S3_SITES = ['ledger', 'slots-list', 'net-worth', 'catalog', 'spark-grid'] as const

/** The nine card sites S4 ports: eight `renderCard` sites and the tax queue. */
export const S4_SITES = [
  'ledger',
  'catalog',
  'slots-list',
  'spending',
  'net-worth',
  'recurring-subscriptions',
  'recurring-bills',
  'recurring-apart',
  'tax',
] as const

// oxlint-disable-next-line no-explicit-any -- the registry holds sites of different row types
export const SITES: Record<string, Site<any>> = {
  ledger,
  catalog,
  'slots-list': slotsList,
  spending: spendingSite,
  'net-worth': netWorth,
  'recurring-subscriptions': recurringSubscriptions,
  'recurring-bills': recurringBills,
  'recurring-apart': recurringApart,
  tax,
  'spark-grid': sparkGrid,
}
