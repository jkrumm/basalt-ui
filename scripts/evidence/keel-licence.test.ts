/**
 * Licence guard for the Keel benchmark (docs/waves/PLAN.md Part 3): Keel is look-only, so the only
 * Keel-derived artefacts allowed in the tree are screenshots, numbers, colour roles and our own
 * prose. This test fails on markup, CSS, class-like tokens, stray strings in the data files, and any
 * file type that could carry code or assets.
 *
 * The name denylist holds sha256 prefixes, not the words, so the repo never commits the copy it
 * guards against. It detects ACCIDENTAL copy of the names it knows; it is not a proof that no other
 * Keel text is present, and it cannot catch a word nobody listed. Positive controls below prove
 * each rule can fail.
 */
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { IMG_KEEL, PARITY_DIR, REPO_ROOT } from './paths'

const ROOT = PARITY_DIR
const KEEL = join(ROOT, 'keel')
// Images and boards live in the gitignored .design-parity/ (CI has none); text stays under ROOT.
const HAS_IMAGES = existsSync(IMG_KEEL)
const ORIGIN = 'https://keel-workspace.vercel.app'

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const files = walk(KEEL)
const textFiles = [
  ...files.filter((f) => ['.md', '.json'].includes(extname(f))),
  join(ROOT, 'BENCHMARK.md'),
]

// ── Allowed shapes ───────────────────────────────────────────────────────────────────────────

const SLUGS = [
  'records-companies-oakline-freight',
  'records-deals-table',
  'records-companies',
  'records-people',
  'records-deals',
  'crew-scout',
  'work-list',
  'root',
  'crew',
  'work',
]
const ROUTE_PATHS = [
  '/records/companies/oakline-freight',
  '/records/companies',
  '/records/people',
  '/records/deals',
  '/crew#scout',
  '/crew',
  '/work',
]
const SLUG_SET = new Set(SLUGS)
const ROLE =
  /^(none|transparent|surface|surface-raised|sunken|subtle|strong|ink|ink-muted|ink-subtle|ink-faint|accent|positive|negative|warning|categorical|on-[a-z]+|[a-z]+-(fill|tint)|hairline-(subtle|default|strong)( \(ring shadow\))?)$/
const TYPE_KEY = /^[\d.]+px\/\d+\/(normal|[\d.]+px) (sans|mono)( caps)?( ls-?[\d.]+)?$/
const NUMERIC_KEY = /^[-\d. ]+$/
const CROP = /^\.design-parity\/keel\/patterns\/[a-z0-9-]+--(dark|light)--(desktop|mobile)\.png$/
const SLOT = /^(dark|light)-(desktop|mobile)$/
const PROSE_KEYS = new Set(['name', 'notes', 'selectorNote'])

// sha256 prefixes of Keel's visible names and labels (lowercase words), never the words themselves
const NAME_HASHES = new Set([
  '3608e4bd0e693177',
  'ffb301e28a65f304',
  'fe14010b4fe83303',
  '07ae38b93d8054d8',
  '092c79e8f80e559e',
  '03b76c061bad8e30',
  'c8b6c061e8591dfe',
  '547da975cbcea755',
  '8c38706cbc8462ab',
  'fe54849f8e37aa19',
  '07f15cde5b181425',
  '456f45fddc2e725c',
  'b6c4ac412ac88223',
  '0818f33ce6e7f42d',
  'a2bdc78162b620e9',
  '619c0ed1bd04fe92',
  '1e6f4bca1865d3da',
  'faf40e847f94e5b0',
  'e574bf06a7a938ff',
  'c1d64b2d4cb30f1b',
  'b0ce1a62c37f717b',
  '31bcf00e541432c9',
  '2d140b32b0f822fa',
  'ad51b5f12c7ab902',
  'ea2699e17298243d',
  '0bc26e0941de568a',
  '818c44dda671237a',
  '68566dc699f6bb9e',
  'b9fba08ee529cff7',
  '88cf43cbf72118b6',
  'c3c42df167add9d9',
  '79fe4c43a919209a',
  '243c7b40e12b92b6',
  '2dc899c8e59c150e',
  '2d8c482556cd678a',
  '1cf8531a22348eeb',
  'bdf0fc939a65657b',
  'c0022309faf4236e',
  '44bcff24eb6751fd',
  '916ecec5449f6df0',
  '2c9e0a2585dc7406',
  '1145f5104cdafbd5',
  '80e4d1617020e166',
  '2db317222c996b63',
  '0632694b663d0e31',
  'f11fa11d1f5b5b3d',
  'c9affe7f758723c3',
  '43762f7506b7249e',
  'fc881aa34d44660e',
  '27a0f645e20497a6',
  '7b85175b455060e3',
  'dc4711f2b0c6a602',
  'c4cf94e75b6067e8',
  '62de53e346677d9e',
  '68d85a0a124d90d9',
  '156584f70e18b0a1',
  '06a8d99fc6930dbf',
])
const hash = (word: string): string => createHash('sha256').update(word).digest('hex').slice(0, 16)

// ── Prose rules ──────────────────────────────────────────────────────────────────────────────

/** Removes our own route paths and slugs (they legitimately contain route words) and link targets. */
const stripRoutes = (text: string): string => {
  let out = text.replace(/\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, ' ')
  for (const route of [...ROUTE_PATHS, ...SLUGS]) out = out.split(route).join(' ')
  return out
}

const stripCode = (text: string): string =>
  text
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w./-]+\.(?:tsx?|css|md|json):[\d,–:-]+/g, ' ')

const hasName = (text: string, names: Set<string>): boolean =>
  (
    stripRoutes(text)
      .toLowerCase()
      .match(/[a-z]+/g) ?? []
  ).some((word) => names.has(hash(word)))

const proseProblems = (text: string, names: Set<string> = NAME_HASHES): string[] => {
  const problems: string[] = []
  if (/<\/?[a-zA-Z!]/.test(text)) problems.push('markup tag')
  if (/\b(class|classname|style|href|src)\s*=/i.test(text)) problems.push('attribute')
  if (/\b[a-z-]{3,}\s*:\s*[a-z0-9#.%()-]+(?:\s+[a-z0-9#.%()-]+){0,3}\s*;/.test(stripCode(text))) {
    problems.push('CSS declaration')
  }
  if (/\{[^}\n]*:[^}\n]*;[^}\n]*\}/.test(text)) problems.push('CSS block')
  if (/[A-Za-z]+_[a-f0-9]{6,}|__[A-Za-z0-9]{5,}|-module__/.test(text)) problems.push('hashed class')
  if (
    /\b(?:px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|rounded|bg|ring|inset)-(?:\d|\[|[a-z]+-\d)/.test(
      text,
    )
  ) {
    problems.push('utility class')
  }
  if (hasName(text, names)) problems.push('benchmark name or label')
  return problems
}

// ── Data walkers ─────────────────────────────────────────────────────────────────────────────

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const keyShapeOk = (k: string): boolean =>
  SLUG_SET.has(k) ||
  /^[a-zA-Z]+$/.test(k) ||
  TYPE_KEY.test(k) ||
  NUMERIC_KEY.test(k) ||
  k === 'pill' ||
  SLOT.test(k) ||
  /^\d+x\d+$/.test(k)

/** Every string key or value outside the prose keys must be a number, role, path or known shape,
 * and no key or value may carry a denylisted name. */
const dataProblems = (
  value: Json,
  path: string,
  accept: (s: string) => boolean,
  names: Set<string> = NAME_HASHES,
): string[] => {
  if (typeof value === 'string') {
    const own = accept(value) ? [] : [`${path}: unexpected string`]
    return hasName(value, names) ? own.concat(`${path}: benchmark name or label`) : own
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => dataProblems(v, `${path}[${i}]`, accept, names))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => {
      const keyProblems: string[] = []
      if (!keyShapeOk(k)) keyProblems.push(`${path}: unexpected key shape`)
      if (hasName(k, names)) keyProblems.push(`${path}: benchmark name or label in a key`)
      if (PROSE_KEYS.has(k) && typeof v === 'string') {
        const prose = proseProblems(v, names).concat(/["“”]/.test(v) ? ['quoted string'] : [])
        return keyProblems.concat(prose.map((p) => `${path}.${k}: ${p}`))
      }
      return keyProblems.concat(dataProblems(v, `${path}.${k}`, accept, names))
    })
  }
  return []
}

const acceptScalesString = (s: string): boolean =>
  s === ORIGIN || SLUG_SET.has(s) || /^\d+x\d+$/.test(s) || /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)

const acceptInventoryString = (s: string): boolean =>
  s === ORIGIN ||
  ROLE.test(s) ||
  CROP.test(s) ||
  /^(absent|unverified)$/.test(s) ||
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) ||
  /^\/[a-z0-9/-]*$/.test(s) ||
  /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)

const acceptAll = (): boolean => true

/** Image or board files that must never be committed under docs/waves/design-parity. */
const forbiddenImages = (paths: string[]): string[] =>
  paths.filter((f) => ['.png', '.html'].includes(extname(f)))

const IMG_CROP = /^\.design-parity\/[\w.-]+(\/[\w.-]+)*\.png$/

const read = (path: string): string => readFileSync(path, 'utf8')

describe('keel capture licence boundary', () => {
  test('the committed tree holds only json and md files (no png, no html)', () => {
    const all = walk(ROOT)
    expect(forbiddenImages(all)).toEqual([])
    expect(all.filter((f) => !['.json', '.md'].includes(extname(f)))).toEqual([])
  })

  test('every crop path in inventory.json and compare.json is a .design-parity png path', () => {
    const crops: string[] = []
    const inventory = JSON.parse(read(join(KEEL, 'inventory.json'))) as {
      patterns: Array<{ crops: Record<string, string> }>
    }
    for (const p of inventory.patterns) crops.push(...Object.values(p.crops))
    for (const file of walk(ROOT).filter((f) => f.endsWith('compare.json'))) {
      const board = JSON.parse(read(file)) as {
        results: Record<string, { crops: Record<string, string> }>
      }
      for (const r of Object.values(board.results)) crops.push(...Object.values(r.crops))
    }
    expect(crops.length).toBeGreaterThan(0)
    expect(crops.filter((c) => !IMG_CROP.test(c))).toEqual([])
  })

  test('markdown and raw json text carry no markup, CSS, class tokens or benchmark names', () => {
    for (const file of textFiles) {
      expect({ file, problems: proseProblems(read(file)) }).toEqual({ file, problems: [] })
    }
  })

  test('inventory.json holds numbers, roles, paths and our own prose only', () => {
    const inventory = JSON.parse(read(join(KEEL, 'inventory.json'))) as {
      capturedAt: string
      origin: string
      patterns: Array<{
        id: string
        route: string
        crops: Record<string, string>
        slotStatus?: Record<string, string>
      }>
    }
    expect(inventory.origin).toBe(ORIGIN)
    expect(Number.isNaN(Date.parse(inventory.capturedAt))).toBe(false)
    expect(dataProblems(inventory as unknown as Json, 'inventory', acceptInventoryString)).toEqual(
      [],
    )
    for (const pattern of inventory.patterns) {
      expect(pattern.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      for (const [slot, crop] of Object.entries(pattern.crops)) {
        expect(slot).toMatch(SLOT)
        if (HAS_IMAGES) expect(existsSync(resolve(REPO_ROOT, crop))).toBe(true)
      }
      for (const [slot, status] of Object.entries(pattern.slotStatus ?? {})) {
        expect(slot).toMatch(SLOT)
        expect(['absent', 'unverified']).toContain(status)
        expect(pattern.crops[slot]).toBeUndefined()
      }
    }
  })

  test('scales.json holds histograms of numbers and slug-keyed counts only', () => {
    const scales = JSON.parse(read(join(KEEL, 'scales.json'))) as Json
    expect(dataProblems(scales, 'scales', acceptScalesString)).toEqual([])
  })

  test.skipIf(!HAS_IMAGES)(
    'every png under .design-parity/keel/ is referenced by the route index or the inventory (skipped: no local images, as in CI)',
    () => {
      const referenced = read(join(KEEL, 'ROUTES.md')) + read(join(KEEL, 'inventory.json'))
      const orphans = walk(IMG_KEEL)
        .filter((f) => extname(f) === '.png')
        .map((f) => `.design-parity/keel/${f.slice(IMG_KEEL.length + 1)}`)
        .filter((rel) => !referenced.includes(rel))
      expect(orphans).toEqual([])
    },
  )
})

describe('guard positive controls', () => {
  // A throwaway word stands in for a denylisted name, so the mechanism is tested without the list.
  const fake = new Set([hash('zorblax')])
  const mustFail: Array<[string, string]> = [
    ['markup tag', 'a <div> here'],
    ['attribute', 'see class="x"'],
    ['utility class', 'uses px-4 and gap-2'],
    ['hashed class', 'token geist_a71539c9 here'],
    ['CSS declaration', 'color: red;'],
    ['CSS block', 'a { color: red; } b'],
    ['benchmark name or label', 'the Zorblax tile'],
    ['benchmark name or label', 'the `zorblax` tile'],
  ]
  for (const [rule, text] of mustFail) {
    test(`prose: ${rule} is caught in "${text}"`, () => {
      expect(proseProblems(text, fake)).toContain(rule)
    })
  }

  test('prose: a clean sentence passes', () => {
    expect(proseProblems('A card grid with a stat panel; padding 12 and radius 8.', fake)).toEqual(
      [],
    )
  })

  test('json: a denylisted word is caught in a value, a key and raw text', () => {
    expect(dataProblems({ id: 'zorblax' }, 'j', acceptAll, fake)).toHaveLength(1)
    expect(dataProblems({ zorblax: 1 }, 'j', acceptAll, fake).length).toBeGreaterThan(0)
    expect(proseProblems(JSON.stringify({ notes: 'the zorblax tile' }), fake)).toContain(
      'benchmark name or label',
    )
    expect(
      dataProblems({ notes: 'the zorblax tile' }, 'j', acceptAll, fake).length,
    ).toBeGreaterThan(0)
  })

  test('json: an unexpected string or key shape is caught', () => {
    expect(dataProblems({ id: 'Some Copy Text' }, 'j', acceptInventoryString, fake)).toHaveLength(1)
    expect(dataProblems({ 'some key!': 1 }, 'j', acceptInventoryString, fake)).toHaveLength(1)
  })

  test('images: a synthetic board.html and x.png under the parity tree are flagged', () => {
    const html = join(ROOT, 'w99/board.html')
    const png = join(ROOT, 'keel/x.png')
    expect(forbiddenImages([html, png, join(ROOT, 'a.json')])).toEqual([html, png])
  })

  test('images: a crop path outside .design-parity does not match the shape', () => {
    expect(IMG_CROP.test('patterns/x--dark--desktop.png')).toBe(false)
    expect(IMG_CROP.test('.design-parity/keel/patterns/x--dark--desktop.png')).toBe(true)
  })

  test('the real denylist is populated', () => {
    expect(NAME_HASHES.size).toBeGreaterThan(40)
  })
})
