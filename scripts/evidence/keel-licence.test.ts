/**
 * Licence guard for the Keel benchmark (docs/waves/PLAN.md Part 3): Keel is look-only, so the only
 * Keel-derived artefacts allowed in the tree are screenshots, numbers, colour roles and our own
 * prose. This test fails on markup, CSS, class-like tokens, stray strings in the data files, and any
 * file type that could carry code or assets. The denylist holds hashes, not the words themselves,
 * so the repo never commits the benchmark's copy to guard against it.
 */
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../docs/waves/design-parity')
const KEEL = join(ROOT, 'keel')
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

const SLUGS = new Set([
  'root',
  'crew',
  'crew-scout',
  'records-companies',
  'records-people',
  'records-deals',
  'records-deals-table',
  'records-companies-oakline-freight',
  'work',
  'work-list',
])
const ROLE =
  /^(none|transparent|surface|surface-raised|sunken|subtle|strong|ink|ink-muted|ink-subtle|ink-faint|accent|positive|negative|warning|categorical|on-[a-z]+|[a-z]+-(fill|tint)|hairline-(subtle|default|strong)( \(ring shadow\))?)$/
const TYPE_KEY = /^[\d.]+px\/\d+\/(normal|[\d.]+px) (sans|mono)( caps)?( ls-?[\d.]+)?$/
const NUMERIC_KEY = /^[-\d. ]+$/
const CROP = /^patterns\/[a-z0-9-]+--(dark|light)--(desktop|mobile)\.png$/
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

const stripPaths = (text: string): string =>
  text
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w./-]+\.(?:tsx?|css|md|json):[\d,–:-]+/g, ' ')

const proseProblems = (text: string): string[] => {
  const problems: string[] = []
  if (/<\/?[a-zA-Z!]/.test(text)) problems.push('markup tag')
  if (/\b(class|classname|style|href|src)\s*=/i.test(text)) problems.push('attribute')
  if (/\b[a-z-]{3,}\s*:\s*[a-z0-9#.%()-]+(?:\s+[a-z0-9#.%()-]+){0,3}\s*;/.test(stripPaths(text)))
    problems.push('CSS declaration')
  if (/\{[^}\n]*:[^}\n]*;[^}\n]*\}/.test(text)) problems.push('CSS block')
  if (/[A-Za-z]+_[a-f0-9]{6,}|__[A-Za-z0-9]{5,}|-module__/.test(text)) problems.push('hashed class')
  if (
    /\b(?:px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|rounded|bg|ring|inset)-(?:\d|\[|[a-z]+-\d)/.test(
      text,
    )
  ) {
    problems.push('utility class')
  }
  for (const word of stripPaths(text)
    .toLowerCase()
    .match(/[a-z]+/g) ?? []) {
    if (NAME_HASHES.has(hash(word))) problems.push('benchmark name or label')
  }
  return problems
}

// ── Data walkers ─────────────────────────────────────────────────────────────────────────────

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** Every string key or value outside the prose keys must be a number, role, path or known shape. */
const dataProblems = (value: Json, path: string, accept: (s: string) => boolean): string[] => {
  if (typeof value === 'string') return accept(value) ? [] : [`${path}: unexpected string`]
  if (Array.isArray(value)) return value.flatMap((v, i) => dataProblems(v, `${path}[${i}]`, accept))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => {
      if (PROSE_KEYS.has(k) && typeof v === 'string') {
        return proseProblems(v)
          .concat(/["“”]/.test(v) ? ['quoted string'] : [])
          .map((p) => `${path}.${k}: ${p}`)
      }
      const keyOk =
        SLUGS.has(k) ||
        /^[a-zA-Z]+$/.test(k) ||
        TYPE_KEY.test(k) ||
        NUMERIC_KEY.test(k) ||
        k === 'pill' ||
        SLOT.test(k) ||
        /^[\d]+x[\d]+$/.test(k)
      const own = keyOk ? [] : [`${path}: unexpected key ${k.length > 40 ? 'too long' : 'shape'}`]
      return own.concat(dataProblems(v, `${path}.${k}`, accept))
    })
  }
  return []
}

const acceptScalesString = (s: string): boolean =>
  s === ORIGIN || SLUGS.has(s) || /^\d+x\d+$/.test(s) || /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)

const read = (path: string): string => readFileSync(path, 'utf8')

describe('keel capture licence boundary', () => {
  test('the committed tree holds only png, json and md files', () => {
    const bad = files.filter((f) => !['.png', '.json', '.md'].includes(extname(f)))
    expect(bad).toEqual([])
  })

  test('markdown and json prose carries no markup, CSS, class tokens or benchmark names', () => {
    for (const file of textFiles) {
      const text = file.endsWith('.json') ? '' : read(file)
      expect({ file, problems: proseProblems(text) }).toEqual({ file, problems: [] })
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
    const accept = (s: string): boolean =>
      s === ORIGIN ||
      ROLE.test(s) ||
      CROP.test(s) ||
      /^(absent|unverified)$/.test(s) ||
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) ||
      /^\/[a-z0-9/-]*$/.test(s) ||
      /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)
    expect(dataProblems(inventory as unknown as Json, 'inventory', accept)).toEqual([])
    for (const pattern of inventory.patterns) {
      expect(pattern.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      for (const [slot, crop] of Object.entries(pattern.crops)) {
        expect(slot).toMatch(SLOT)
        expect(existsSync(join(KEEL, crop))).toBe(true)
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
})
