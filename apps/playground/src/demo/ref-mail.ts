/**
 * The reference mailbox: supplier correspondence about purchase orders, on the parts-inventory domain
 * and its fixed today. Each conversation is the buyer's thread with one supplier contact.
 */
import { queryOptions } from '@tanstack/react-query'
import type {
  Conversation,
  MailFolder,
  Person,
} from '../../../../packages/basalt-ui/blocks/mailbox/model'
import { SUPPLIERS, TODAY } from './ref-inventory'

const HOUR = 3_600_000

/** The reader of the mailbox: the buyer. */
export const ME: Person = { name: 'Mara Okafor', address: 'm.okafor@partsdesk.example' }

type Attached = [name: string, kind: string, size: number]
type Line = [fromSupplier: boolean, hoursAgo: number, body: string, files?: readonly Attached[]]

type Seed = {
  supplierId: string
  subject: string
  order?: string
  folder?: MailFolder
  unread?: boolean
  starred?: boolean
  lines: readonly Line[]
}

const SEEDS: readonly Seed[] = [
  {
    supplierId: 'sup-2',
    subject: 'Order confirmation PO-2026-0142',
    order: 'PO-2026-0142',
    unread: true,
    starred: true,
    lines: [
      [
        false,
        26,
        'Hello Erik,\n\nPlease find PO-2026-0142 attached: 400 deep groove bearings 6204-2RS, due on 4 December.\n\nBest regards,\nMara',
      ],
      [
        true,
        3,
        'Hi Mara,\n\nwe confirm PO-2026-0142 in full. The bearings leave Gothenburg on 1 December and arrive at your main warehouse on the 3rd.\n\nThe order confirmation is attached.\n\nKind regards,\nErik Holm',
        [['AB-88213 order confirmation.pdf', 'PDF', 214_016]],
      ],
    ],
  },
  {
    supplierId: 'sup-3',
    subject: 'Lead time change for O-ring kits',
    order: 'PO-2026-0139',
    unread: true,
    lines: [
      [
        true,
        5,
        'Dear Mara,\n\nour compound supplier had a furnace outage. O-ring kits ORK-120 ship two weeks later than confirmed, on 15 December instead of 1 December.\n\nWe can split the order and send 200 of the 500 kits from stock this week. Shall we?\n\nHannah Pryce\nAtlas Seal Co.',
      ],
    ],
  },
  {
    supplierId: 'sup-4',
    subject: 'Invoice 2026-11873 for PO-2026-0131',
    order: 'PO-2026-0131',
    lines: [
      [
        true,
        7,
        'Hello,\n\nplease find invoice 2026-11873 for PO-2026-0131 attached. Payment terms net 30.\n\nLukas Gruber',
        [['Invoice 2026-11873.pdf', 'PDF', 98_304]],
      ],
    ],
  },
  {
    supplierId: 'sup-1',
    subject: 'Re: Thread pitch on the M8 batch',
    order: 'PO-2026-0136',
    starred: true,
    lines: [
      [
        false,
        30,
        'Katrin,\n\nincoming inspection found 14 of 200 M8 bolts from batch 26-1107 out of tolerance on the thread pitch. Photos and the measurement log are attached.\n\nMara',
        [
          ['Inspection 26-1107.xlsx', 'XLSX', 46_080],
          ['Thread gauge photos.zip', 'ZIP', 3_407_872],
        ],
      ],
      [
        true,
        27,
        'Mara, thank you. We are checking the rolling dies today and come back to you tomorrow morning.\n\nKatrin',
      ],
      [
        true,
        8,
        'Mara,\n\nthe dies were worn. We replace the 200 bolts free of charge; the new batch ships on Wednesday. Please return the faulty batch with the attached RMA.\n\nKatrin Brenner',
        [['RMA-4471.pdf', 'PDF', 61_440]],
      ],
    ],
  },
  {
    supplierId: 'sup-5',
    subject: 'Price list 2027',
    lines: [
      [
        true,
        20,
        'Dear customer,\n\nour price list for 2027 is attached. Connectors rise by 3.5 %, relays stay at 2026 prices. Orders placed before 31 December keep the current prices.\n\nInês Carvalho\nVoltera Components',
        [['Voltera price list 2027.pdf', 'PDF', 1_258_291]],
      ],
    ],
  },
  {
    supplierId: 'sup-6',
    subject: 'Shipping documents PO-2026-0128',
    order: 'PO-2026-0128',
    unread: true,
    lines: [
      [
        true,
        34,
        'Dear Ms Okafor,\n\nthe linear guides for PO-2026-0128 left Yokohama today. Bill of lading and packing list are attached. ETA Hamburg 18 December.\n\nHaruto Kaneda',
        [
          ['BL KP-26-0912.pdf', 'PDF', 176_128],
          ['Packing list.pdf', 'PDF', 88_064],
        ],
      ],
    ],
  },
  {
    supplierId: 'sup-2',
    subject: 'Re: Sample request for sealed bearings',
    lines: [
      [false, 60, 'Erik, could you send five samples of the 6205-2RSH for a trial on line 2?'],
      [true, 52, "Of course. They go out with tomorrow's shipment, no charge."],
    ],
  },
  {
    supplierId: 'sup-3',
    subject: 'Quality certificate for batch 4410',
    order: 'PO-2026-0124',
    lines: [
      [
        true,
        96,
        'Hello Mara,\n\nas requested, the 3.1 certificate for batch 4410 is attached.\n\nHannah',
        [['Certificate 3.1 batch 4410.pdf', 'PDF', 302_080]],
      ],
    ],
  },
  {
    supplierId: 'sup-4',
    subject: 'Re: Hydraulic hoses, partial delivery',
    order: 'PO-2026-0120',
    lines: [
      [
        false,
        170,
        'Lukas, we received 60 of the 100 hoses on PO-2026-0120. When do the other 40 follow?',
      ],
      [true, 150, 'Hello Mara, the remaining 40 leave on Friday. Sorry for the split.'],
    ],
  },
  {
    supplierId: 'sup-1',
    subject: 'Framework agreement 2027',
    starred: true,
    lines: [
      [
        true,
        220,
        'Mara,\n\nattached is our draft for the 2027 framework agreement with the volume tiers we discussed. Could we review it in a call next week?\n\nKatrin',
        [['Framework agreement 2027 draft.docx', 'DOCX', 81_920]],
      ],
    ],
  },
  {
    supplierId: 'sup-5',
    subject: 'Delivery note PO-2026-0117',
    order: 'PO-2026-0117',
    lines: [
      [
        true,
        260,
        'Delivery note for PO-2026-0117 attached.',
        [['Delivery note 55120.pdf', 'PDF', 54_272]],
      ],
    ],
  },
  {
    supplierId: 'sup-6',
    subject: 'Re: Customs tariff code for guide rails',
    lines: [
      [
        false,
        330,
        'Haruto, customs asks for the tariff code of the LG-25 rails. Could you confirm it?',
      ],
      [true, 316, 'The tariff code is 8482 99 00. It is also on the commercial invoice.'],
    ],
  },
  {
    supplierId: 'sup-2',
    subject: 'Order confirmation PO-2026-0112',
    order: 'PO-2026-0112',
    folder: 'sent',
    lines: [[false, 400, 'Erik, PO-2026-0112 attached. Thank you.']],
  },
]

const MONTHLY: readonly [subject: string, body: string][] = [
  ['Order confirmation', 'We confirm the order in full. The confirmation is attached.'],
  ['Invoice', 'Please find the invoice attached. Payment terms as agreed.'],
  ['Delivery note', 'The goods left our warehouse today. The delivery note is attached.'],
  ['Re: Delivery date', 'The order ships one day earlier than confirmed.'],
  ['Credit note', 'For the short delivery we credit the difference, see attached.'],
]

/** Older mail, two to three per week back into last year, so the list scrolls past several months. */
const OLDER: readonly Seed[] = Array.from({ length: 60 }, (_, i) => {
  const supplier = SUPPLIERS[i % SUPPLIERS.length]!
  const [subject, body] = MONTHLY[i % MONTHLY.length]!
  const order = `PO-2026-${String(110 - i).padStart(4, '0')}`
  return {
    supplierId: supplier.id,
    subject: `${subject} ${order}`,
    order,
    folder: i % 9 === 4 ? 'archive' : 'inbox',
    lines: [[true, 480 + i * 70, `Hello Mara,\n\n${body}\n\n${supplier.contact}`]],
  } satisfies Seed
})

const personOf = (supplierId: string): Person => {
  const s = SUPPLIERS.find((x) => x.id === supplierId)
  return s === undefined
    ? { name: supplierId, address: '' }
    : { name: s.contact, address: s.email, org: s.name }
}

export const CONVERSATIONS: readonly Conversation[] = [...SEEDS, ...OLDER].map((seed, i) => {
  const supplier = personOf(seed.supplierId)
  return {
    id: `mail-${i + 1}`,
    subject: seed.subject,
    supplierId: seed.supplierId,
    supplier: supplier.org ?? seed.supplierId,
    ...(seed.order !== undefined && { order: seed.order }),
    folder: seed.folder ?? 'inbox',
    unread: seed.unread === true,
    starred: seed.starred === true,
    messages: seed.lines.map(([fromSupplier, hoursAgo, body, files], j) => ({
      id: `mail-${i + 1}-${j + 1}`,
      from: fromSupplier ? supplier : ME,
      to: fromSupplier ? 'to me' : `to ${supplier.name}`,
      at: new Date(TODAY - hoursAgo * HOUR).toISOString(),
      body,
      attachments: (files ?? []).map(([name, kind, size]) => ({ name, kind, size })),
    })),
  }
})

/** The mailbox as the app reads it: a query, so the page shows its loading, empty and error frames. */
export const mailQuery = queryOptions({
  queryKey: ['ref', 'mail'],
  queryFn: async (): Promise<readonly Conversation[]> => CONVERSATIONS,
})
