import { queryOptions } from '@tanstack/react-query'

/**
 * The reference pages' one domain: a parts inventory with its suppliers, purchase orders and notes, on a
 * fixed today so every countdown, relative time and day group reads the same in every shot.
 */

/** Monday 23 November 2026, 09:00 UTC: the reference pages' today. */
export const TODAY = Date.UTC(2026, 10, 23, 9, 0)

const DAY = 86_400_000

/** The calendar day `offset` days from today, as `YYYY-MM-DD`. */
const dayAt = (offset: number): string => new Date(TODAY + offset * DAY).toISOString().slice(0, 10)

export const CATEGORIES = ['fasteners', 'bearings', 'seals', 'hydraulics', 'electrical'] as const
export type Category = (typeof CATEGORIES)[number]
export const CATEGORY_LABELS: Record<Category, string> = {
  fasteners: 'Fasteners',
  bearings: 'Bearings',
  seals: 'Seals',
  hydraulics: 'Hydraulics',
  electrical: 'Electrical',
}

/** How much of a part is on the shelf against its reorder point. */
export const STOCK = ['in-stock', 'low', 'out'] as const
export type Stock = (typeof STOCK)[number]
export const STOCK_LABELS: Record<Stock, string> = {
  'in-stock': 'In stock',
  low: 'Low',
  out: 'Out',
}
export const STOCK_TONE = { 'in-stock': 'good', low: 'warn', out: 'bad' } as const

/** Where a part stands in replenishment: the board's columns, stored as the words they show. */
export const PLANS = ['No action', 'Reorder', 'On order', 'On hold'] as const
export type Plan = (typeof PLANS)[number]

export const TAGS = ['critical', 'long-lead', 'imported', 'hazmat'] as const
export const TAG_LABELS: Record<(typeof TAGS)[number], string> = {
  critical: 'Critical',
  'long-lead': 'Long lead',
  imported: 'Imported',
  hazmat: 'Hazmat',
}
export const TAG_TONE = {
  critical: 'bad',
  'long-lead': 'warn',
  imported: 'info',
  hazmat: 'warn',
} as const

export const BUYERS = ['Mara Okafor', 'Jonas Lindqvist', 'Priya Raman', 'Tomás Ferreira'] as const

export const RATINGS = ['preferred', 'approved', 'probation'] as const
export type Rating = (typeof RATINGS)[number]
export const RATING_LABELS: Record<Rating, string> = {
  preferred: 'Preferred',
  approved: 'Approved',
  probation: 'On probation',
}
export const RATING_TONE = { preferred: 'good', approved: 'info', probation: 'warn' } as const

export type Supplier = {
  id: string
  name: string
  domain: string
  city: string
  country: string
  rating: Rating
  contact: string
  contactRole: string
  email: string
  phone: string
  /** Days from order to delivery, quoted. */
  leadDays: number
  /** Share of the last 12 months' deliveries that arrived on the due day or before. */
  onTime: number
  terms: string
  since: string
}

export const SUPPLIERS: readonly Supplier[] = [
  {
    id: 'sup-1',
    name: 'Brenner Verbindungstechnik',
    domain: 'brenner-vt.example',
    city: 'Stuttgart',
    country: 'Germany',
    rating: 'preferred',
    contact: 'Katrin Brenner',
    contactRole: 'Key account manager',
    email: 'k.brenner@brenner-vt.example',
    phone: '+49 711 555 0142',
    leadDays: 9,
    onTime: 0.96,
    terms: 'Net 30',
    since: '2019-04-01',
  },
  {
    id: 'sup-2',
    name: 'Nordlager Bearings',
    domain: 'nordlager.example',
    city: 'Gothenburg',
    country: 'Sweden',
    rating: 'preferred',
    contact: 'Erik Holm',
    contactRole: 'Sales engineer',
    email: 'erik.holm@nordlager.example',
    phone: '+46 31 555 0190',
    leadDays: 14,
    onTime: 0.92,
    terms: 'Net 45',
    since: '2020-09-15',
  },
  {
    id: 'sup-3',
    name: 'Atlas Seal Co.',
    domain: 'atlasseal.example',
    city: 'Leeds',
    country: 'United Kingdom',
    rating: 'approved',
    contact: 'Hannah Pryce',
    contactRole: 'Customer service',
    email: 'orders@atlasseal.example',
    phone: '+44 113 555 0117',
    leadDays: 12,
    onTime: 0.88,
    terms: 'Net 30',
    since: '2021-02-08',
  },
  {
    id: 'sup-4',
    name: 'Fluidra Hydraulik',
    domain: 'fluidra-hyd.example',
    city: 'Linz',
    country: 'Austria',
    rating: 'probation',
    contact: 'Lukas Gruber',
    contactRole: 'Account manager',
    email: 'l.gruber@fluidra-hyd.example',
    phone: '+43 732 555 0163',
    leadDays: 21,
    onTime: 0.71,
    terms: 'Net 60',
    since: '2022-06-20',
  },
  {
    id: 'sup-5',
    name: 'Voltera Components',
    domain: 'voltera.example',
    city: 'Porto',
    country: 'Portugal',
    rating: 'approved',
    contact: 'Inês Carvalho',
    contactRole: 'Sales lead',
    email: 'ines@voltera.example',
    phone: '+351 22 555 0134',
    leadDays: 18,
    onTime: 0.9,
    terms: 'Net 30',
    since: '2023-01-10',
  },
  {
    id: 'sup-6',
    name: 'Kaneda Precision',
    domain: 'kaneda-precision.example',
    city: 'Osaka',
    country: 'Japan',
    rating: 'approved',
    contact: 'Haruto Kaneda',
    contactRole: 'Export manager',
    email: 'export@kaneda-precision.example',
    phone: '+81 6 5550 0188',
    leadDays: 35,
    onTime: 0.94,
    terms: 'Letter of credit',
    since: '2021-11-03',
  },
]

/** Last month's readings the list page's strip compares against: stock value 30 days ago, deliveries in the 7 days before. */
export const BASELINE = { stockValue: 14_920, deliveries: 5 } as const

export const supplierOf = (id: string): Supplier | undefined => SUPPLIERS.find((s) => s.id === id)

export type Part = {
  id: string
  sku: string
  name: string
  category: Category
  supplierId: string
  supplier: string
  buyer: string
  tags: readonly string[]
  stock: Stock
  plan: Plan
  onHand: number
  reorderAt: number
  /** Unit cost in EUR. */
  unitCost: number
  /** Stock value in EUR: on hand times unit cost. */
  value: number
  /** The day the next delivery of this part is due. */
  nextDelivery: string
  bin: string
}

type PartSeed = [
  sku: string,
  name: string,
  category: Category,
  supplier: string,
  onHand: number,
  reorderAt: number,
  unitCost: number,
  tags: readonly string[],
  plan: Plan,
  due: number,
]

const PART_SEEDS: readonly PartSeed[] = [
  [
    'FA-1008',
    'Hex bolt M8 x 40, A2 stainless',
    'fasteners',
    'sup-1',
    4_200,
    1_500,
    0.18,
    [],
    'No action',
    12,
  ],
  ['FA-1012', 'Hex nut M12, zinc plated', 'fasteners', 'sup-1', 860, 1_000, 0.07, [], 'Reorder', 4],
  [
    'FA-1030',
    'Socket cap screw M6 x 20',
    'fasteners',
    'sup-1',
    0,
    800,
    0.11,
    ['critical'],
    'On order',
    2,
  ],
  [
    'FA-1044',
    'Spring washer M10, DIN 127',
    'fasteners',
    'sup-1',
    5_600,
    2_000,
    0.03,
    [],
    'No action',
    20,
  ],
  [
    'FA-1051',
    'Threaded insert M5, brass',
    'fasteners',
    'sup-6',
    1_150,
    900,
    0.42,
    ['imported', 'long-lead'],
    'No action',
    31,
  ],
  [
    'BR-2204',
    'Deep groove ball bearing 6204-2RS',
    'bearings',
    'sup-2',
    140,
    200,
    3.9,
    ['critical'],
    'On order',
    6,
  ],
  [
    'BR-2206',
    'Deep groove ball bearing 6206-ZZ',
    'bearings',
    'sup-2',
    310,
    150,
    5.2,
    [],
    'No action',
    18,
  ],
  [
    'BR-2310',
    'Tapered roller bearing 32010',
    'bearings',
    'sup-2',
    22,
    40,
    24.5,
    ['long-lead'],
    'Reorder',
    9,
  ],
  [
    'BR-2402',
    'Linear bearing LM20UU',
    'bearings',
    'sup-6',
    0,
    60,
    11.8,
    ['imported', 'long-lead'],
    'On order',
    27,
  ],
  ['BR-2415', 'Pillow block UCP205', 'bearings', 'sup-2', 48, 30, 18.75, [], 'No action', 15],
  ['SE-3032', 'O-ring 32 x 3, NBR 70', 'seals', 'sup-3', 2_400, 1_000, 0.09, [], 'No action', 10],
  ['SE-3045', 'Shaft seal 45 x 62 x 8, FKM', 'seals', 'sup-3', 90, 120, 2.35, [], 'Reorder', 5],
  ['SE-3060', 'Gasket sheet 1.5 mm, aramid', 'seals', 'sup-3', 12, 10, 46.0, [], 'On hold', 40],
  ['SE-3071', 'Rod wiper 40 mm, PU', 'seals', 'sup-4', 0, 50, 3.1, ['critical'], 'Reorder', 1],
  ['HY-4010', 'Hydraulic hose DN10, 2 m', 'hydraulics', 'sup-4', 36, 40, 28.4, [], 'On order', 3],
  [
    'HY-4016',
    'Quick coupling 1/2 in, ISO A',
    'hydraulics',
    'sup-4',
    74,
    30,
    16.9,
    [],
    'No action',
    22,
  ],
  [
    'HY-4022',
    'Gear pump 8 cc/rev',
    'hydraulics',
    'sup-4',
    3,
    4,
    312.0,
    ['critical', 'long-lead'],
    'On order',
    8,
  ],
  [
    'HY-4030',
    'Hydraulic oil HLP 46, 20 l',
    'hydraulics',
    'sup-4',
    18,
    12,
    64.5,
    ['hazmat'],
    'No action',
    14,
  ],
  [
    'HY-4041',
    'Pressure gauge 0 to 250 bar',
    'hydraulics',
    'sup-6',
    9,
    6,
    38.2,
    ['imported'],
    'On hold',
    45,
  ],
  [
    'EL-5003',
    'Contactor 3-pole, 24 V coil',
    'electrical',
    'sup-5',
    26,
    20,
    42.0,
    [],
    'No action',
    16,
  ],
  [
    'EL-5011',
    'Proximity sensor M12, PNP',
    'electrical',
    'sup-5',
    11,
    25,
    27.6,
    ['critical'],
    'Reorder',
    7,
  ],
  ['EL-5024', 'Cable gland M20, IP68', 'electrical', 'sup-5', 640, 300, 0.85, [], 'No action', 25],
  [
    'EL-5030',
    'Lithium cell 18650, 3.5 Ah',
    'electrical',
    'sup-6',
    0,
    100,
    6.4,
    ['hazmat', 'imported'],
    'On hold',
    52,
  ],
  [
    'EL-5042',
    'Terminal block 4 mm², grey',
    'electrical',
    'sup-5',
    1_900,
    500,
    0.62,
    [],
    'No action',
    19,
  ],
]

const stockOf = (onHand: number, reorderAt: number): Stock =>
  onHand === 0 ? 'out' : onHand < reorderAt ? 'low' : 'in-stock'

export const PARTS: readonly Part[] = PART_SEEDS.map(
  ([sku, name, category, supplierId, onHand, reorderAt, unitCost, tags, plan, due], i) => ({
    id: sku.toLowerCase(),
    sku,
    name,
    category,
    supplierId,
    supplier: supplierOf(supplierId)?.name ?? supplierId,
    buyer: BUYERS[(i * 3 + (category === 'electrical' ? 1 : 0)) % BUYERS.length]!,
    tags,
    stock: stockOf(onHand, reorderAt),
    plan,
    onHand,
    reorderAt,
    unitCost,
    value: Math.round(onHand * unitCost * 100) / 100,
    nextDelivery: dayAt(due),
    bin: `${['A', 'B', 'C', 'D'][i % 4]}-${String(10 + ((i * 7) % 40)).padStart(2, '0')}`,
  }),
)

export const partOf = (id: string): Part | undefined => PARTS.find((p) => p.id === id)

export const ORDER_STATES = ['draft', 'sent', 'confirmed', 'partial', 'received'] as const
export type OrderState = (typeof ORDER_STATES)[number]
export const ORDER_LABELS: Record<OrderState, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partial: 'Part received',
  received: 'Received',
}
export const ORDER_TONE = {
  draft: 'neutral',
  sent: 'info',
  confirmed: 'info',
  partial: 'warn',
  received: 'good',
} as const

export type Order = {
  id: string
  number: string
  supplierId: string
  state: OrderState
  buyer: string
  ordered: string
  due: string
  lines: number
  /** Order total in EUR. */
  total: number
}

export const ORDERS: readonly Order[] = Array.from({ length: 30 }, (_, i) => {
  const supplier = SUPPLIERS[i % SUPPLIERS.length]!
  const age = 2 + ((i * 11) % 70)
  const state = ORDER_STATES[age < 6 ? 0 : age < 14 ? 1 : age < 28 ? 2 : age < 40 ? 3 : 4]
  return {
    id: `po-${142 - i}`,
    number: `PO-2026-${String(142 - i).padStart(4, '0')}`,
    supplierId: supplier.id,
    state,
    buyer: BUYERS[(i * 5) % BUYERS.length]!,
    ordered: dayAt(-age),
    due: dayAt(supplier.leadDays - age),
    lines: 1 + ((i * 7) % 9),
    total: Math.round((180 + ((i * 7919) % 9_400)) * 100) / 100,
  }
})

export const NOTE_TYPES = ['call', 'meeting', 'quality', 'email', 'memo'] as const
export type NoteType = (typeof NOTE_TYPES)[number]
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  call: 'Call',
  meeting: 'Meeting',
  quality: 'Quality issue',
  email: 'Email',
  memo: 'Memo',
}

export type Note = {
  id: string
  title: string
  type: NoteType
  body: string
  supplierId: string
  supplier: string
  part: string
  author: string
  updated: string
}

type NoteSeed = [
  title: string,
  type: NoteType,
  supplier: string,
  part: string,
  hoursAgo: number,
  body: string,
]

const NOTE_SEEDS: readonly NoteSeed[] = [
  [
    'Gear pump lead time slips to week 51',
    'call',
    'sup-4',
    'HY-4022',
    2,
    'Lukas confirmed the casting shop is two weeks behind. The 8 cc pumps ship on 14 December at the earliest; he offered the 10 cc model from stock at the same price.',
  ],
  [
    'Q1 price review',
    'meeting',
    'sup-1',
    'FA-1008',
    5,
    'Brenner holds stainless prices through March if we commit to 40,000 bolts. Zinc-plated nuts go up 4 % from January. Katrin sends the revised list by Friday.',
  ],
  [
    'Shaft seals leaking at 3 bar',
    'quality',
    'sup-3',
    'SE-3045',
    9,
    'Line 2 found weeping on four of the last batch. Lot 2611-B quarantined, 90 pieces. Atlas asked for two samples and the pressure log before they accept the claim.',
  ],
  [
    'Bearing certificates for the audit',
    'email',
    'sup-2',
    'BR-2204',
    20,
    'Erik sent the material certificates for lots 4410 to 4418. Still missing: the hardness report for 6206-ZZ. Filed under audit 2026-12.',
  ],
  [
    'Probation review: on-time rate 71 %',
    'memo',
    'sup-4',
    'HY-4010',
    26,
    'Fluidra missed 9 of the last 31 due days. One more late hose delivery before January moves the hoses to a second source; Tomás is collecting quotes.',
  ],
  [
    'Sensor substitute approved',
    'meeting',
    'sup-5',
    'EL-5011',
    30,
    'Engineering signed off the PNP sensor from the new range as a drop-in. Same thread, 2 mm longer body. Update the BOM before the next order.',
  ],
  [
    'Customs hold on lithium cells',
    'call',
    'sup-6',
    'EL-5030',
    49,
    'The forwarder needs the UN38.3 summary before the cells leave Osaka. Haruto sends it today; expect three days of delay at least.',
  ],
  [
    'Consignment stock for fasteners',
    'meeting',
    'sup-1',
    'FA-1044',
    53,
    'Brenner offered to keep washers and nuts on consignment in bay A. We pay on withdrawal. Needs a weekly count and a shelf of our own.',
  ],
  [
    'Pillow block casting marks',
    'quality',
    'sup-2',
    'BR-2415',
    74,
    'Cosmetic only: flash on the base of six housings. Accepted with a note; Nordlager adds a deburring step from the next lot.',
  ],
  [
    'New contact for Atlas orders',
    'email',
    'sup-3',
    'SE-3032',
    98,
    'Orders now go to the shared mailbox; Hannah stays our contact for claims. Updated the supplier record.',
  ],
  [
    'Hose crimp length out of spec',
    'quality',
    'sup-4',
    'HY-4010',
    120,
    'Three of twelve hoses measured 6 mm short. Returned with the 8D form. Fluidra credits the order and re-crimps on site.',
  ],
  [
    'Annual volume forecast shared',
    'memo',
    'sup-2',
    'BR-2310',
    150,
    'Sent the 2027 forecast: 2,400 tapered bearings, spread over four call-offs. Nordlager reserves capacity for the first two.',
  ],
  [
    'Contactor coil voltage mix-up',
    'call',
    'sup-5',
    'EL-5003',
    170,
    'Twelve contactors arrived with 230 V coils. Inês swaps them free of charge; the right ones ship with the next order.',
  ],
  [
    'Threaded insert drawing revision',
    'email',
    'sup-6',
    'FA-1051',
    190,
    'Revision C of the insert drawing changes the knurl. Kaneda confirmed tooling for revision C from the February lot.',
  ],
  [
    'Gasket sheet on hold',
    'memo',
    'sup-3',
    'SE-3060',
    220,
    'Aramid sheet stays on hold until the new press arrives; cutting moves in-house then. Twelve sheets cover until March.',
  ],
  [
    'Visit to Brenner, Stuttgart',
    'meeting',
    'sup-1',
    'FA-1030',
    260,
    'Saw the new heading line. Socket screws move to it in January, which halves their lead time. Asked for a sample run of M6 x 20.',
  ],
  [
    'Quick coupling price drop',
    'email',
    'sup-4',
    'HY-4016',
    300,
    'Fluidra lowers the ISO A couplings by 6 % on orders over 100 pieces. Next order goes in at the new price.',
  ],
  [
    'Terminal block colour change',
    'memo',
    'sup-5',
    'EL-5042',
    340,
    'The grey blocks change to a lighter grey from the next lot. Same part number; marking stays legible. No action.',
  ],
  [
    'Bearing price index for Q1',
    'email',
    'sup-2',
    'BR-2206',
    380,
    'Nordlager ties bearing prices to the steel index from January, reviewed each quarter. A cap of 5 % per quarter was agreed.',
  ],
  [
    'Seal kit for line 3 rebuild',
    'meeting',
    'sup-3',
    'SE-3045',
    410,
    'Line 3 is rebuilt in February. Atlas quotes a kit of every seal on the press, delivered as one box with a pick list.',
  ],
  [
    'Late sensor delivery explained',
    'call',
    'sup-5',
    'EL-5011',
    450,
    'A customs query on the sensors held the pallet for four days. Voltera now sends the declaration a day before shipping.',
  ],
  [
    'Oil drums dented on arrival',
    'quality',
    'sup-4',
    'HY-4030',
    500,
    'Two of eight drums dented, none leaking. Photos sent; Fluidra asks the carrier to pay. Drums used first.',
  ],
  [
    'Second source for hoses',
    'memo',
    'sup-4',
    'HY-4010',
    560,
    'Tomás has two quotes for DN10 hoses: one 8 % cheaper with a 12-day lead time. Decision waits on the probation review.',
  ],
  [
    'Annual audit booked',
    'email',
    'sup-1',
    'FA-1008',
    620,
    'The supplier audit at Brenner is on 3 February. Quality sends the checklist two weeks ahead.',
  ],
]

export const NOTES: readonly Note[] = NOTE_SEEDS.map(
  ([title, type, supplierId, part, hoursAgo, body], i) => ({
    id: `note-${i + 1}`,
    title,
    type,
    body,
    supplierId,
    supplier: supplierOf(supplierId)?.name ?? supplierId,
    part,
    author: BUYERS[(i * 3) % BUYERS.length]!,
    updated: new Date(TODAY - hoursAgo * 3_600_000).toISOString(),
  }),
)

/** The parts list as the app reads it: a query, so a page shows its loading, empty and error frames. */
export const partsQuery = queryOptions({
  queryKey: ['ref', 'parts'],
  queryFn: async (): Promise<readonly Part[]> => PARTS,
})

/** The notes list as the app reads it. */
export const notesQuery = queryOptions({
  queryKey: ['ref', 'notes'],
  queryFn: async (): Promise<readonly Note[]> => NOTES,
})

export type SupplierRecords = {
  orders: readonly Order[]
  parts: readonly Part[]
  notes: readonly Note[]
}

/** A supplier's related records: its orders, the parts it delivers and the notes about it. */
export const supplierRecordsQuery = (id: string) =>
  queryOptions({
    queryKey: ['ref', 'supplier', id, 'records'],
    queryFn: async (): Promise<SupplierRecords> => ({
      orders: ORDERS.filter((o) => o.supplierId === id),
      parts: PARTS.filter((p) => p.supplierId === id),
      notes: NOTES.filter((n) => n.supplierId === id),
    }),
  })
