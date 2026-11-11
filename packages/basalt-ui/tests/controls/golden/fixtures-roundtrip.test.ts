/**
 * Golden fixtures: the URL and storage strings the 2.x apps write, frozen per major. Each URL must
 * survive `parse(serialize(s)) = s` under both router parse configs (Router's default JSON codec
 * and shutterflow's string-only one), and each storage envelope must round-trip as JSON.
 */
import { describe, expect, test } from 'bun:test'
import {
  defaultParseSearch,
  defaultStringifySearch,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import argo from '../../../src/router/controls/fixtures/argo-window-stores.json'
import linewatch from '../../../src/router/controls/fixtures/linewatch-dashboard.json'
import shutterflow from '../../../src/router/controls/fixtures/shutterflow-photos-settings.json'
import cases from '../../../src/router/controls/fixtures/cases.json'

type Fixture = {
  stores: {
    id: string
    aliases?: Record<string, Record<string, string>>
    urls: { label: string; url: string }[]
    storage: { key: string; raw: string } | null
  }[]
}

const CONFIGS = {
  json: { parse: defaultParseSearch, stringify: defaultStringifySearch },
  'string-only': {
    parse: parseSearchWith((v) => v),
    stringify: stringifySearchWith((v) => String(v)),
  },
} as const

const FILES: Record<string, Fixture> = { argo, linewatch, shutterflow }

describe.each(Object.entries(FILES))('golden fixtures: %s', (_name, fixture) => {
  for (const store of fixture.stores) {
    for (const [config, codec] of Object.entries(CONFIGS)) {
      for (const { label, url } of store.urls) {
        test(`${store.id} / ${label} round-trips under ${config}`, () => {
          const s = codec.parse(url)
          expect(codec.parse(codec.stringify(s))).toEqual(s)
          // The URL names exactly the keys it declared: nothing invented, nothing dropped.
          const declared = url === '' ? [] : url.split('&').map((pair) => pair.split('=')[0] ?? '')
          expect(Object.keys(s).toSorted()).toEqual(declared.toSorted())
        })
      }
    }

    if (store.storage) {
      const { key, raw } = store.storage
      test(`${store.id} storage envelope ${key} round-trips`, () => {
        expect(key).toBe(`basalt:${store.id}`)
        const envelope = JSON.parse(raw) as { v: number; value: Record<string, unknown> }
        expect(envelope.v).toBe(1)
        expect(typeof envelope.value).toBe('object')
        expect(JSON.parse(JSON.stringify(envelope))).toEqual(envelope)
        expect(JSON.stringify(envelope)).toBe(raw)
      })
    }
  }
})

describe('alias and renamed cases', () => {
  const all = [...argo.stores, ...linewatch.stores, ...shutterflow.stores] as Fixture['stores']

  for (const a of cases.aliases) {
    test(`${a.store}.${a.field}: ${a.from} -> ${a.to}${'renamed' in a ? ' (renamed)' : ''}`, () => {
      const store = all.find((s) => s.id === a.store)
      expect(store?.aliases?.[a.field]?.[a.from]).toBe(a.to)
      expect(store?.urls.some((u) => u.url.includes(`${a.field}=${a.from}`))).toBe(true)
    })
  }

  test('the shutterflow renamed case is present', () => {
    expect(
      cases.aliases.some((a) => 'renamed' in a && a.from === 'sync' && a.to === 'storage'),
    ).toBe(true)
  })
})
