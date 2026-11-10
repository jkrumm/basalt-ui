import './setup'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { generateRouteTree } from './codegen'
import { brandOf, defineControls, field } from './controls'
import type { Handle } from './controls'
import { createFakeWindow, maskingHistory, plainHistory } from './history'
import { makeRouter } from './router'
import type { HarnessRouter, ParseConfig } from './router'
import { fin, garmin, globals, gym } from './stores'

/**
 * Every measurement of spike 626. `runCases()` is deterministic (no clocks, no randomness) so two
 * runs print the same JSON. `run.ts` adds the router-version delta and the verdict on top.
 */

type Raw = Record<string, unknown>
const ROOT = join(import.meta.dirname, '..')
const CONFIGS: readonly ParseConfig[] = ['json', 'stringOnly']
const VISIBLE = new Set(['month', 'from', 'to', 'year', 'range'])

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

async function open(url: string, parse: ParseConfig, mode: 'plain' | 'masked' = 'plain') {
  const fake = createFakeWindow(url)
  const history = mode === 'masked' ? maskingHistory(fake, VISIBLE) : plainHistory(fake)
  const router = makeRouter({ parse, history })
  // What the React `Transitioner` does: reload on every history notification.
  history.subscribe(() => void router.load())
  await router.load()
  return { fake, history, router }
}
type Session = Awaited<ReturnType<typeof open>>

const searchOf = (router: HarnessRouter): Raw => router.state.location.search as Raw
const valuesOf = (router: HarnessRouter): Raw => (router.state.matches.at(-1)?.search ?? {}) as Raw
const hrefOf = (router: HarnessRouter): string => router.state.location.href

async function navigateTo(session: Session, to: string, search?: Raw | ((prev: Raw) => Raw)) {
  const router = session.router as unknown as {
    navigate: (o: { to: string; search?: unknown }) => Promise<void>
  }
  await router.navigate({ to, ...(search === undefined ? {} : { search }) })
  session.history.flush()
}

const asHandle = (h: unknown): Handle<unknown> => h as Handle<unknown>

// ------------------------------------------------------------------------- S8 round-trip matrix

interface Sample {
  readonly label: string
  readonly value: unknown
}
interface Codec {
  readonly start: string
  readonly handle: Handle<unknown>
  readonly samples: readonly Sample[]
}

const sample = (...values: unknown[]): Sample[] =>
  values.map((value) => ({ label: JSON.stringify(value), value }))

const CODECS: Record<'number' | 'boolean' | 'range' | 'enum' | 'string' | 'multi', Codec[]> = {
  number: [
    { start: '/', handle: asHandle(globals.field.density), samples: sample(-3, -1, 0, 2, 3) },
  ],
  boolean: [
    { start: '/', handle: asHandle(globals.field.compact), samples: sample(true, false) },
    { start: '/gym', handle: asHandle(gym.field.done), samples: sample(false, true) },
  ],
  range: [
    {
      start: '/garmin-health',
      handle: asHandle(garmin.field.window),
      samples: sample(
        { preset: '7d', from: '', to: '' },
        { preset: '90d', from: '', to: '' },
        { preset: '30d', from: '', to: '' },
        { preset: '30d', from: '2025-01-05', to: '2025-02-01' },
        { preset: '30d', from: '2024-02-29', to: '2024-02-29' },
      ),
    },
  ],
  enum: [
    {
      start: '/finance/spending',
      handle: asHandle(fin.field.sort),
      samples: sample('amount', 'merchant', 'booked_on'),
    },
    {
      start: '/finance/spending',
      handle: asHandle(fin.field.size),
      samples: sample('25', '100', '50'),
    },
    { start: '/', handle: asHandle(globals.field.range), samples: sample('1h', '7d', '24h') },
  ],
  string: [
    {
      start: '/finance/spending',
      handle: asHandle(fin.field.search),
      samples: sample(
        'abc',
        '123',
        '007',
        '1.5',
        '1e3',
        'true',
        'false',
        'null',
        ' 5',
        '[1]',
        '{"a":1}',
        '"q"',
        'a,b',
        'x&y=z',
        '100%',
        'ä ö ü',
        'a b',
        '',
      ),
    },
  ],
  multi: [
    {
      start: '/gym',
      handle: asHandle(gym.field.muscles),
      samples: sample(['legs'], ['legs', 'chest'], ['legs', 'back', 'chest'], []),
    },
    {
      start: '/gym',
      handle: asHandle(gym.field.exercises),
      samples: sample(
        ['squat'],
        ['squat', 'row'],
        ['squat', 'bench', 'deadlift', 'row', 'press'],
        [],
      ),
    },
    { start: '/', handle: asHandle(globals.field.regions), samples: sample(['eu'], ['eu', 'us']) },
    {
      start: '/gym',
      handle: asHandle(gym.field.levels),
      samples: sample(['1'], ['2', '3'], ['1', '2', '3']),
    },
  ],
}

interface MatrixCell {
  readonly cases: number
  readonly ok: boolean
  readonly failures: readonly Raw[]
}

async function roundTrip(parse: ParseConfig): Promise<Record<keyof typeof CODECS, MatrixCell>> {
  const result = {} as Record<keyof typeof CODECS, MatrixCell>
  for (const [name, codecs] of Object.entries(CODECS) as [keyof typeof CODECS, Codec[]][]) {
    const failures: Raw[] = []
    let cases = 0
    for (const codec of codecs) {
      for (const { label, value } of codec.samples) {
        cases += 1
        const writer = await open(codec.start, parse)
        await codec.handle.set(writer.router, value)
        const href = hrefOf(writer.router)
        const reader = await open(href, parse)
        const got = codec.handle.get(valuesOf(reader.router))
        if (!same(got, value)) failures.push({ key: codec.handle.key, label, href, got })
      }
    }
    result[name] = { cases, ok: failures.length === 0, failures }
  }
  return result
}

// Decode-only: URLs written by hand, by another app, or by the other parse config.
interface Foreign {
  readonly url: string
  readonly handle: Handle<unknown>
  readonly expected: { json: unknown; stringOnly: unknown }
}
const both = (value: unknown) => ({ json: value, stringOnly: value })
const FOREIGN: readonly Foreign[] = [
  {
    url: '/gym?muscles=legs,chest',
    handle: asHandle(gym.field.muscles),
    expected: both(['legs', 'chest']),
  },
  {
    url: '/gym?muscles=legs&muscles=chest',
    handle: asHandle(gym.field.muscles),
    expected: both(['legs', 'chest']),
  },
  { url: '/gym?muscles=legs', handle: asHandle(gym.field.muscles), expected: both(['legs']) },
  { url: '/gym?muscles=zzz', handle: asHandle(gym.field.muscles), expected: both([]) },
  {
    // an app on the JSON router writes arrays as JSON; a string-only router sees one unknown token
    url: `/gym?muscles=${encodeURIComponent('["legs","chest"]')}`,
    handle: asHandle(gym.field.muscles),
    expected: { json: ['legs', 'chest'], stringOnly: [] },
  },
  { url: '/gym?levels=1', handle: asHandle(gym.field.levels), expected: both(['1']) },
  { url: '/gym?levels=1,2', handle: asHandle(gym.field.levels), expected: both(['1', '2']) },
  { url: '/gym?levels=1&levels=3', handle: asHandle(gym.field.levels), expected: both(['1', '3']) },
  { url: '/gym?exercises=', handle: asHandle(gym.field.exercises), expected: both([]) },
  {
    url: '/gym?exercises=zzz',
    handle: asHandle(gym.field.exercises),
    expected: both(['squat', 'bench', 'deadlift', 'row', 'press']),
  },
  { url: '/?density=2', handle: asHandle(globals.field.density), expected: both(2) },
  { url: '/?density=-1', handle: asHandle(globals.field.density), expected: both(-1) },
  { url: '/?density=9', handle: asHandle(globals.field.density), expected: both(3) },
  { url: '/?density=abc', handle: asHandle(globals.field.density), expected: both(0) },
  {
    url: `/?density=${encodeURIComponent('"2"')}`,
    handle: asHandle(globals.field.density),
    expected: { json: 2, stringOnly: 0 },
  },
  { url: '/?compact=true', handle: asHandle(globals.field.compact), expected: both(true) },
  { url: '/?compact=1', handle: asHandle(globals.field.compact), expected: both(true) },
  { url: '/?compact=yes', handle: asHandle(globals.field.compact), expected: both(false) },
  { url: '/gym?done=false', handle: asHandle(gym.field.done), expected: both(false) },
  { url: '/gym?done=0', handle: asHandle(gym.field.done), expected: both(false) },
  {
    url: '/finance/spending?search=123',
    handle: asHandle(fin.field.search),
    expected: both('123'),
  },
  { url: '/finance/spending?size=50', handle: asHandle(fin.field.size), expected: both('50') },
  { url: '/?range=day', handle: asHandle(globals.field.range), expected: both('24h') },
  { url: '/?range=bogus', handle: asHandle(globals.field.range), expected: both('24h') },
]

async function foreignForms(parse: ParseConfig): Promise<MatrixCell> {
  const failures: Raw[] = []
  for (const { url, handle, expected } of FOREIGN) {
    const session = await open(url, parse)
    const got = handle.get(valuesOf(session.router))
    if (!same(got, expected[parse])) failures.push({ url, expected: expected[parse], got })
  }
  return { cases: FOREIGN.length, ok: failures.length === 0, failures }
}

// -------------------------------------------------------------------------------- S8: retain

const CHILDREN = [
  '/finance/',
  '/finance/spending',
  '/finance/transactions',
  '/finance/recurring',
  '/finance/net-worth',
  '/finance/tax',
] as const
const OWN_VALIDATOR = new Set(['/finance/recurring', '/finance/net-worth', '/finance/tax'])

async function retainAcrossChildren(parse: ParseConfig) {
  let kept = 0
  let nonRetainedDropped = 0
  let leavingDrops = 0
  const failures: Raw[] = []
  for (const child of CHILDREN) {
    const from = child === '/finance/spending' ? '/finance/transactions' : '/finance/spending'
    const session = await open(`${from}?month=2025-02&year=2025&merchant=acme&range=7d`, parse)
    await navigateTo(session, child) // a bare nav link: no search
    const inside = searchOf(session.router)
    const keptHere =
      String(inside['month']) === '2025-02' &&
      String(inside['year']) === '2025' &&
      String(inside['range']) === '7d'
    if (keptHere) kept += 1
    if (inside['merchant'] === undefined) nonRetainedDropped += 1

    let leftClean = true
    for (const target of ['/garmin-health', '/']) {
      const leaving = await open(`${child}?month=2025-02&year=2025&merchant=acme&range=7d`, parse)
      await navigateTo(leaving, target)
      const outside = searchOf(leaving.router)
      // The page store's keys are dropped; the global's `range` is retained app-wide.
      if (
        outside['month'] !== undefined ||
        outside['year'] !== undefined ||
        outside['merchant'] !== undefined ||
        String(outside['range']) !== '7d'
      ) {
        leftClean = false
        failures.push({ child, target, outside })
      }
    }
    if (leftClean) leavingDrops += 1
    if (!keptHere) failures.push({ child, inside })
  }
  return {
    kept,
    of: CHILDREN.length,
    nonRetainedDropped,
    leavingDrops,
    validatorOn: {
      layoutOnly: CHILDREN.filter((child) => !OWN_VALIDATOR.has(child)).length,
      repeatedOnChild: CHILDREN.filter((child) => OWN_VALIDATOR.has(child)).length,
    },
    failures,
  }
}

async function retainTraps(parse: ParseConfig) {
  // explicit default beats a retained value
  const a = await open('/finance/spending?month=2025-02', parse)
  await navigateTo(a, '/finance/tax', { month: '' })
  const explicitDefaultBeatsRetained = searchOf(a.router)['month'] === undefined

  // clear() writes explicit undefined: a retained key is cleared
  const b = await open('/finance/spending?month=2025-02', parse)
  await fin.field.month.clear(b.router)
  const clearUnsets = searchOf(b.router)['month'] === undefined

  // omitting the key (the `delete` form) leaves it retained
  const c = await open('/finance/spending?month=2025-02', parse)
  await navigateTo(c, '/finance/spending', (prev) => {
    const { month: _month, ...rest } = prev
    return rest
  })
  const deleteKeepsRetained = String(searchOf(c.router)['month']) === '2025-02'

  // defaults are stripped from the written URL while the validated search stays complete
  const d = await open('/finance/spending', parse)
  await fin.field.sort.set(d.router, 'booked_on')
  await fin.field.size.set(d.router, '50')
  await globals.field.range.set(d.router, '24h')
  const strippedDefaults = hrefOf(d.router) === '/finance/spending'
  const validatedComplete =
    valuesOf(d.router)['sort'] === 'booked_on' && valuesOf(d.router)['size'] === '50'

  return {
    explicitDefaultBeatsRetained,
    clearUnsets,
    deleteKeepsRetained,
    strippedDefaults,
    validatedComplete,
  }
}

// ------------------------------------------------------------------------ S8: full-default multi

async function fullDefaultMulti(parse: ParseConfig) {
  const exercises = asHandle(gym.field.exercises)
  const muscles = asHandle(gym.field.muscles)
  const ALL = ['squat', 'bench', 'deadlift', 'row', 'press']

  const full = await open('/gym?exercises=squat', parse)
  await exercises.set(full.router, ALL)
  const fullOmitted = hrefOf(full.router) === '/gym'
  const fullDecodesToFull = same(exercises.get(valuesOf(full.router)), ALL)

  const none = await open('/gym', parse)
  await exercises.set(none.router, [])
  const emptyHref = hrefOf(none.router)
  const emptyWritten = emptyHref.includes('exercises')
  const emptyReload = await open(emptyHref, parse)
  const emptyStaysEmpty = same(exercises.get(valuesOf(emptyReload.router)), [])

  const absent = await open('/gym', parse)
  const absentIsFull = same(exercises.get(valuesOf(absent.router)), ALL)

  // contrast: empty default multi
  const contrast = await open('/gym?muscles=legs', parse)
  await muscles.set(contrast.router, [])
  const emptyDefaultOmitted = hrefOf(contrast.router) === '/gym'
  await muscles.set(contrast.router, ['legs', 'back', 'chest'])
  const completeWritten = hrefOf(contrast.router).includes('muscles')

  return {
    fullOmitted,
    fullDecodesToFull,
    emptyWritten,
    emptyHref,
    emptyStaysEmpty,
    absentIsFull,
    emptyDistinctFromFull: emptyWritten && emptyStaysEmpty && absentIsFull && fullOmitted,
    contrast: { emptyDefaultOmitted, completeWritten },
  }
}

// ----------------------------------------------------------------------------- S8: history

async function deltas(session: Session, step: () => Promise<void>) {
  const entries = session.fake.entries.length
  const pushes = session.fake.pushes
  const replaces = session.fake.replaces
  await step()
  return {
    entries: session.fake.entries.length - entries,
    pushes: session.fake.pushes - pushes,
    replaces: session.fake.replaces - replaces,
  }
}

async function historyEntries(parse: ParseConfig, mode: 'plain' | 'masked') {
  const session = await open('/garmin-health', parse, mode)
  const { router } = session
  const q = asHandle(garmin.field.q)
  const tab = asHandle(garmin.field.tab)

  const replaceField = await deltas(session, () => q.set(router, 'x'))
  const replaceToStrippedDefault = await deltas(session, () => q.set(router, ''))
  const pushField = await deltas(session, () => tab.set(router, 'sleep'))
  const pushSameValue = await deltas(session, () => tab.set(router, 'sleep'))
  const pushToStrippedDefault = await deltas(session, () => tab.set(router, 'overview'))
  const pushDefaultWhileDefault = await deltas(session, () => tab.set(router, 'overview'))

  // Back walks the push entries
  await tab.set(router, 'hrv')
  session.fake.go(-1)
  await router.load()
  const backWalks = searchOf(router)['tab'] === undefined

  const pass =
    replaceField.entries === 0 &&
    replaceToStrippedDefault.entries === 0 &&
    pushField.entries === 1 &&
    pushToStrippedDefault.entries === 1
  return {
    replaceField,
    replaceToStrippedDefault,
    pushField,
    pushSameValue,
    pushToStrippedDefault,
    pushDefaultWhileDefault,
    backWalks,
    pass: pass && backWalks,
  }
}

async function maskingChecks(parse: ParseConfig) {
  const session = await open('/finance/spending?month=2025-02', parse, 'masked')
  const { router, fake } = session
  const search = asHandle(fin.field.search)
  await search.set(router, 'secret')
  await fin.field.month.set(router, '2025-03')

  const routerSees = String(searchOf(router)['search']) === 'secret'
  const controlReads = search.get(valuesOf(router)) === 'secret'
  const addressBarHidden =
    !fake.address.includes('search=') && fake.address.includes('month=2025-03')

  // reload: a fresh router over the same window restores the real href from history.state
  const reloaded = (() => {
    const history = maskingHistory(fake, VISIBLE)
    const next = makeRouter({ parse, history })
    return next.load().then(() => next)
  })()
  const reloadRouter = await reloaded
  const reloadRestores = String(searchOf(reloadRouter)['search']) === 'secret'

  // a URL opened fresh or shared starts without the hidden filter
  const shared = await open(fake.address, parse, 'masked')
  const sharedStartsClean = searchOf(shared.router)['search'] === undefined

  // back/forward through a navigation restores the filters
  await navigateTo(session, '/finance/tax')
  fake.go(-1)
  await router.load()
  const backRestores = String(searchOf(router)['search']) === 'secret'

  return {
    routerSees,
    controlReads,
    addressBarHidden,
    reloadRestores,
    sharedStartsClean,
    backRestores,
    pass:
      routerSees &&
      controlReads &&
      addressBarHidden &&
      reloadRestores &&
      sharedStartsClean &&
      backRestores,
  }
}

// ------------------------------------------------------------------------------- S8: toWindow

async function toWindow(parse: ParseConfig) {
  const window = garmin.field.window
  const read = async (url: string) => {
    const session = await open(url, parse)
    return window.toWindow(window.get(valuesOf(session.router)))
  }
  const table: [string, string, unknown][] = [
    ['default', '/garmin-health', { preset: '30d' }],
    ['preset', '/garmin-health?window=7d', { preset: '7d' }],
    ['unknown preset', '/garmin-health?window=1y', { preset: '30d' }],
    [
      'custom',
      '/garmin-health?from=2025-01-05&to=2025-02-01',
      { from: '2025-01-05', to: '2025-02-01' },
    ],
    [
      'custom beats preset',
      '/garmin-health?window=7d&from=2025-01-05&to=2025-02-01',
      { from: '2025-01-05', to: '2025-02-01' },
    ],
    ['half pair', '/garmin-health?from=2025-01-05', { preset: '30d' }],
    ['reversed', '/garmin-health?from=2025-02-01&to=2025-01-05', { preset: '30d' }],
    ['impossible date', '/garmin-health?from=2025-13-40&to=2025-02-01', { preset: '30d' }],
  ]
  const failures: Raw[] = []
  for (const [label, url, expected] of table) {
    const got = await read(url)
    if (!same(got, expected)) failures.push({ label, url, expected, got })
  }

  // writes: custom drops the preset, a preset drops the custom ends, a half pair writes nothing
  const session = await open('/garmin-health?window=7d', parse)
  await window.set(session.router, { preset: '30d', from: '2025-01-05', to: '2025-02-01' })
  const customHref = hrefOf(session.router)
  const customWrite =
    customHref.includes('from=2025-01-05') &&
    customHref.includes('to=2025-02-01') &&
    !customHref.includes('window=')
  await window.set(session.router, { preset: '90d', from: '', to: '' })
  const presetHref = hrefOf(session.router)
  const presetWrite = presetHref.includes('window=90d') && !presetHref.includes('from=')
  const half = await deltas(session, () =>
    window.set(session.router, { preset: '30d', from: '2025-01-05', to: '' }),
  )
  const halfPairWritesNothing =
    half.entries === 0 && half.replaces === 0 && hrefOf(session.router) === presetHref

  return {
    cases: table.length,
    failures,
    customWrite,
    presetWrite,
    halfPairWritesNothing,
    pass: failures.length === 0 && customWrite && presetWrite && halfPairWritesNothing,
  }
}

// ---------------------------------------------------------------------------------------- S1

function negativesDirectives(): number {
  const source = readFileSync(join(ROOT, 'src/negatives.tsx'), 'utf8')
  return source.split('\n').filter((line) => /^\s*(\/\/|\{\/\*)\s*@ts-expect-error/.test(line))
    .length
}

function tsc() {
  const run = spawnSync(join(ROOT, 'node_modules/.bin/tsc'), ['--noEmit', '-p', '.'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return {
    exit: run.status,
    errors: (run.stdout + run.stderr).split('\n').filter((line) => /error TS\d+/.test(line)).length,
    negatives: negativesDirectives(),
  }
}

const EXPECTED_BRANDS: Record<string, string> = {
  __root__: 'globals',
  '/finance': 'finance',
  '/finance/recurring': 'finance',
  '/finance/net-worth': 'finance',
  '/finance/tax': 'finance',
  '/garmin-health': 'garmin',
  '/gym': 'gym',
}
const EXPECTED_MIDDLEWARES = ['__root__', '/finance', '/garmin-health', '/gym']

const sortedEntries = (o: Record<string, unknown>) =>
  Object.entries(o).toSorted(([a], [b]) => a.localeCompare(b))

async function fileRouteCodegen() {
  const treePath = join(ROOT, 'src/route-tree.gen.ts')
  const committed = readFileSync(treePath, 'utf8')
  const regenerated = await generateRouteTree(ROOT, './src/route-tree.gen.ts')
  const session = await open('/', 'json')
  const routes = Object.entries(
    session.router.routesById as unknown as Record<string, { options: Raw }>,
  )
  const brands: Record<string, string | null> = {}
  const middlewares: string[] = []
  for (const [id, route] of routes) {
    const brand = brandOf(route.options['validateSearch'])
    if (brand) brands[id] = brand.id
    const search = route.options['search'] as { middlewares?: unknown[] } | undefined
    if (search?.middlewares?.length) middlewares.push(id)
  }
  const brandsSurvive = same(sortedEntries(brands), sortedEntries(EXPECTED_BRANDS))
  const middlewaresMounted = same(middlewares.toSorted(), EXPECTED_MIDDLEWARES.toSorted())
  return {
    routeCount: routes.length - 1,
    routeIds: routes.map(([id]) => id).toSorted(),
    treeMatchesCommitted: regenerated === committed,
    treeAugmentsFileRoutesByPath: regenerated.includes('interface FileRoutesByPath'),
    brandedRoutes: Object.keys(brands).length,
    brandsSurvive,
    middlewaresMounted,
    unbrandedByDesign: '/wrapped',
    tsc: tsc(),
  }
}

async function attemptWrite(url: string, write: (router: HarnessRouter) => Promise<void>) {
  const session = await open(url, 'json')
  try {
    await write(session.router)
    return 'allowed'
  } catch (error) {
    return (error as Error).message.includes('does not run the store') ? 'refused' : 'other'
  }
}

async function brandRefusal() {
  const attempt = attemptWrite
  const results = {
    ownRoute: await attempt('/garmin-health', (r) => garmin.field.q.set(r, 'x')),
    layoutRunsStoreForInheritingChild: await attempt('/finance/spending', (r) =>
      fin.field.search.set(r, 'x'),
    ),
    childWithOwnValidator: await attempt('/finance/tax', (r) => fin.field.search.set(r, 'x')),
    handWrapperRoute: await attempt('/wrapped', (r) => garmin.field.q.set(r, 'x')),
    otherPagesStore: await attempt('/garmin-health', (r) => fin.field.search.set(r, 'x')),
    globalFromAnywhere: await attempt('/wrapped', (r) => globals.field.density.set(r, 2)),
  }
  return {
    ...results,
    pass:
      results.ownRoute === 'allowed' &&
      results.layoutRunsStoreForInheritingChild === 'allowed' &&
      results.childWithOwnValidator === 'allowed' &&
      results.handWrapperRoute === 'refused' &&
      results.otherPagesStore === 'refused' &&
      results.globalFromAnywhere === 'allowed',
  }
}

function attemptDefine(build: () => unknown) {
  try {
    build()
    return 'allowed'
  } catch {
    return 'throws'
  }
}

function crossStoreOwnership() {
  const attempt = attemptDefine
  const results = {
    pageVsPage: attempt(() =>
      defineControls({
        id: 'probe-page',
        scope: 'page',
        fields: { window: field.enum(['a'], 'a'), from: field.string('') },
      }),
    ),
    pageTakesGlobalParam: attempt(() =>
      defineControls({
        id: 'probe-global-clash',
        scope: 'page',
        fields: { range: field.enum(['a'], 'a') },
      }),
    ),
    twoFieldsOneParam: attempt(() =>
      defineControls({
        id: 'probe-dup',
        scope: 'page',
        fields: { span: field.range(['a'], 'a', { from: 'x', to: 'x' }) },
      }),
    ),
    reservedPrefix: attempt(() =>
      defineControls({ id: 'probe-prefix', scope: 'page', fields: { 'w.x': field.string('') } }),
    ),
  }
  return results
}

// renderToString escapes quotes; the page prints JSON.stringify(fin.useValues()), so a VALUE check
// needs the key and its value together (a key name or a Link href alone proves nothing).
async function renderAt(url: string): Promise<string> {
  const history = createMemoryHistory({ initialEntries: [url] })
  const router = makeRouter({ parse: 'json', history, server: true })
  await router.load()
  return renderToString(createElement(RouterProvider, { router } as never))
}

async function ssrRender() {
  try {
    const withValues = await renderAt('/finance/spending?month=2025-02&merchant=acme')
    const withoutValues = await renderAt('/finance/spending')
    const merchant = '&quot;merchant&quot;:&quot;acme&quot;'
    const month = '&quot;month&quot;:&quot;2025-02&quot;'
    return {
      ok: true,
      usesValuesUnderFileRoute: withValues.includes(merchant) && withValues.includes(month),
      // negative control: the same page without the params must not print them
      controlWithoutParamsLacksValues:
        !withoutValues.includes(merchant) && !withoutValues.includes(month),
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

const readVersion = (name: string): string =>
  (
    JSON.parse(
      readFileSync(join(ROOT, 'node_modules/@tanstack', name, 'package.json'), 'utf8'),
    ) as {
      version: string
    }
  ).version

function versions() {
  const read = readVersion
  return {
    reactRouter: read('react-router'),
    routerCore: read('router-core'),
    history: read('history'),
    routerGenerator: read('router-generator'),
  }
}

// ------------------------------------------------------------------------------------- driver

export async function runCases() {
  const matrix = {} as Record<keyof typeof CODECS, Record<ParseConfig, MatrixCell>>
  const foreign = {} as Record<ParseConfig, MatrixCell>
  const retain = {} as Record<ParseConfig, Awaited<ReturnType<typeof retainAcrossChildren>>>
  const traps = {} as Record<ParseConfig, Awaited<ReturnType<typeof retainTraps>>>
  const multi = {} as Record<ParseConfig, Awaited<ReturnType<typeof fullDefaultMulti>>>
  const window = {} as Record<ParseConfig, Awaited<ReturnType<typeof toWindow>>>
  for (const parse of CONFIGS) {
    const cells = await roundTrip(parse)
    for (const codec of Object.keys(cells) as (keyof typeof CODECS)[]) {
      matrix[codec] ??= {} as Record<ParseConfig, MatrixCell>
      matrix[codec][parse] = cells[codec]
    }
    foreign[parse] = await foreignForms(parse)
    retain[parse] = await retainAcrossChildren(parse)
    traps[parse] = await retainTraps(parse)
    multi[parse] = await fullDefaultMulti(parse)
    window[parse] = await toWindow(parse)
  }
  const history = {
    json: await historyEntries('json', 'plain'),
    stringOnly: await historyEntries('stringOnly', 'plain'),
    masked: await historyEntries('json', 'masked'),
  }
  const masking = {
    json: await maskingChecks('json'),
    stringOnly: await maskingChecks('stringOnly'),
  }

  return {
    versions: versions(),
    s1: {
      fileRouteCodegen: await fileRouteCodegen(),
      brandRefusal: await brandRefusal(),
      crossStoreOwnership: crossStoreOwnership(),
      ssrRender: await ssrRender(),
    },
    s8: {
      retainChildrenKept: retain,
      retainTraps: traps,
      multiFullDefault: multi,
      historyEntries: history,
      maskingHistory: masking,
      toWindow: window,
      foreignForms: foreign,
    },
    roundTrip: matrix,
  }
}

export type CaseResults = Awaited<ReturnType<typeof runCases>>
