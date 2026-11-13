/**
 * The live clauses of `basalt/data-primitive` (live-realtime 4.6, 7 P4, 9 E3): each clause has one
 * offender that fails with a message naming the fix and one clean twin that passes. The
 * `refetchIntervalInBackground` key is gr-3b's `refetch-interval` form and the timer clause is its
 * `timer-refetch` form; they are covered here so the live set is proven in one place.
 */
import { describe, expect, it } from 'bun:test'
import type { Rule } from 'eslint'
import { RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { dataPrimitiveRules } from './data-primitive'
import { liveStaticStale } from './data-primitive-live'

RuleTester.describe = describe
RuleTester.it = it

const entry = dataPrimitiveRules['data-primitive']
const rule = buildRule('data-primitive', entry) as unknown as Rule.RuleModule

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
})

tester.run('data-primitive live clauses', rule, {
  valid: [
    // staleTime 'static': the class, Infinity, a plain queryOptions, a non-query object
    `const o = liveQuery(queryOptions({ queryKey: ['a'], queryFn }), 'static')`,
    `const o = liveQuery(queryOptions({ queryKey: ['a'], queryFn, staleTime: Infinity }), 'standard')`,
    `const o = queryOptions({ queryKey: ['a'], queryFn, staleTime: 'static' })`,
    `const label = { staleTime: 'static' }`,
    // refetchIntervalInBackground: the class, no key
    `const o = liveQuery(queryOptions({ queryKey: ['a'], queryFn }), { class: 'ticker', every: 5_000, background: true })`,
    // timer-driven invalidation: a plain tick and a bare invalidate
    `setInterval(() => tick(Date.now()), 1000)`,
    `queryClient.invalidateQueries({ queryKey: ['a'] })`,
    // a transport seam: the file declares the Transport it implements
    `import { Transport } from 'basalt-ui'\nexport const t = () => new WebSocket(url)`,
  ],
  invalid: [
    {
      code: `const o = liveQuery(queryOptions({ queryKey: ['a'], queryFn, staleTime: 'static' }), 'standard')`,
      errors: [{ messageId: 'live-static-stale-time' }],
    },
    {
      code: `const o = liveQuery({ ...base, 'staleTime': 'static' }, 'static')`,
      errors: [{ messageId: 'live-static-stale-time' }],
    },
    {
      code: `const q = useQuery({ queryKey: ['a'], queryFn, refetchIntervalInBackground: true })`,
      errors: [{ messageId: 'refetch-interval' }],
    },
    {
      code: `setInterval(() => queryClient.invalidateQueries({ queryKey: ['a'] }), 5000)`,
      errors: [{ messageId: 'timer-refetch' }],
    },
    {
      code: `const s = new EventSource('/events')`,
      errors: [{ messageId: 'unseamed-transport' }],
    },
  ],
})

describe('live clause messages', () => {
  const forms = Object.fromEntries(entry.forms.map((form) => [form.id, form]))

  it('names the liveQuery class in the static and background clauses', () => {
    expect(formMessage(liveStaticStale)).toContain("liveQuery(queryOptions, 'static')")
    expect(forms['refetch-interval']?.fix).toContain('liveQuery')
    expect(forms['timer-refetch']?.fix).toContain('liveQuery')
  })

  it('adds the static clause once, to the one data-primitive entry', () => {
    expect(entry.forms.filter((form) => form.id === 'live-static-stale-time')).toHaveLength(1)
  })
})
