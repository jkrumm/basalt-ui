/**
 * Type-level proof (spike S1) on file routes with codegen, compiled by the package `tsc` and never
 * run. Each `@ts-expect-error` must error (an unused one is TS2578); unmarked lines must compile.
 * `Link` takes the fixture router's type explicitly instead of a program-global `Register`.
 */
import { Link } from '@tanstack/react-router'
import type { SearchMiddleware } from '@tanstack/react-router'
import { BRAND } from '../../../../src/router/controls/brand'
import type { Branded } from '../../../../src/router/controls/brand'
import type { FixtureRouter } from './router'
import { fin, globals, gym } from './stores'

type R = FixtureRouter

// ------------------------------------------------------------------ branded validator

const asFinance = (v: Branded<'files-finance'>): Branded<'files-finance'> => v
asFinance(fin.validateSearch)
asFinance(fin.extend({ '~standard': { version: 1, vendor: 'x', validate: (v) => ({ value: v }) } }))
const wrapped = (raw: Record<string, unknown>) =>
  fin.validateSearch['~standard'].validate(raw).value
// @ts-expect-error a hand wrapper loses the brand
asFinance(wrapped)
// @ts-expect-error another store's brand
asFinance(gym.validateSearch)
// @ts-expect-error a string key is not the symbol brand
asFinance({ brand: { id: 'files-finance', scope: 'page' } })
const pageScope: 'page' = fin.validateSearch[BRAND].scope
const globalScope: 'global' = globals.validateSearch[BRAND].scope
// @ts-expect-error a page store's scope is not "global"
const notGlobal: 'global' = fin.validateSearch[BRAND].scope
void [pageScope, globalScope, notGlobal]

// ------------------------------------------------------------------ types.input: a typed Link

type FinInput = (typeof fin.validateSearch)['~standard']['types']['input']
const partial: FinInput = {}
void partial

export function Links() {
  return (
    <>
      <Link<R, string, '/finance/spending'> to="/finance/spending" />
      <Link<R, string, '/finance/spending'>
        to="/finance/spending"
        search={{ month: '2025-01', sort: 'amount', page: 2, period: '7d' }}
      />
      <Link<R, string, '/gym'> to="/gym" search={{ exercises: ['squat'], item: 'abc' }} />
      <Link<R, string, '/gym'>
        to="/gym"
        search={{ window: 'custom', from: '2025-01-01', to: '2025-01-31' }}
      />
      <Link<R, string, '/gym'> to="/gym" {...gym.field.section.link('plan')} />
      <Link<R, string, '/gym'> to="/gym" {...gym.field.exercises.link(['squat', 'row'])} />
      {/* @ts-expect-error types.input rejects an undeclared key */}
      <Link<R, string, '/finance/spending'> to="/finance/spending" search={{ nope: 1 }} />
      {/* @ts-expect-error month is an enum */}
      <Link<R, string, '/finance/spending'> to="/finance/spending" search={{ month: '2099-01' }} />
      {/* @ts-expect-error page is a number */}
      <Link<R, string, '/finance/spending'> to="/finance/spending" search={{ page: 'two' }} />
      {/* @ts-expect-error uncategorized is a boolean */}
      <Link<R, string, '/finance'> to="/finance" search={{ uncategorized: 'yes' }} />
      {/* @ts-expect-error exercises is a multi of the declared members */}
      <Link<R, string, '/gym'> to="/gym" search={{ exercises: ['unknown'] }} />
      {/* @ts-expect-error a finance key does not exist on /gym */}
      <Link<R, string, '/gym'> to="/gym" search={{ month: '2025-01' }} />
      {/* @ts-expect-error a gym link() does not fit /finance */}
      <Link<R, string, '/finance'> to="/finance" {...gym.field.section.link('plan')} />
    </>
  )
}

// ------------------------------------------------------------------ handles

// @ts-expect-error 'bogus' is not a member of the sort enum
fin.field.sort.link('bogus')
// @ts-expect-error a boolean field takes a boolean
globals.field.dense.link('true')
fin.field.sort.link('amount')

const win = gym.field.window.toWindow({ preset: '7d' })
void win
// @ts-expect-error an unknown preset is not a range value
gym.field.window.toWindow({ preset: '1y' })
// @ts-expect-error toWindow exists only on a range handle
void fin.field.month.toWindow

const [month, setMonth] = fin.field.month.use()
const typedMonth: '' | '2025-01' | '2025-02' = month
// @ts-expect-error the setter takes a member
setMonth('2030-01')
void typedMonth

// ------------------------------------------------------------------ search.middlewares

type FullSearch = { month: string; period: string }
const mountable: SearchMiddleware<FullSearch>[] = fin.middlewares
void mountable
