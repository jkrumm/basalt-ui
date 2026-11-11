import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useFormat } from './format'
import type { Format } from './format'
import { BasaltProvider } from './provider'
import { IntlScope } from './provider-props'
import type { BasaltMessages } from './messages'
import { base } from './messages/base'
import { useMessages } from './messages/use-messages'

afterEach(cleanup)

const AT = new Date('2026-09-02T23:30:00Z')

function Probe({ out }: { out: (f: Format) => string }) {
  return <span data-testid="out">{out(useFormat())}</span>
}

const text = (node: React.ReactNode): string => render(node).getByTestId('out').textContent ?? ''

describe('useFormat', () => {
  test('without a provider it is English and UTC', () => {
    expect(text(<Probe out={(f) => `${f.number(1234.5)}|${f.date(AT)}`} />)).toBe(
      '1,234.5|Sep 2, 2026',
    )
  })

  test('reads locale and timeZone from the scope', () => {
    expect(
      text(
        <IntlScope locale="de-DE" timeZone="Europe/Berlin">
          <Probe out={(f) => `${f.number(1234.5)}|${f.date(AT)}`} />
        </IntlScope>,
      ),
    ).toBe('1.234,5|3. Sept. 2026')
  })

  test('falls back to the provider locale when no scope is mounted', () => {
    expect(
      text(
        <BasaltProvider locale="de-DE">
          <Probe out={(f) => f.number(1234.5)} />
        </BasaltProvider>,
      ),
    ).toBe('1.234,5')
  })

  test('every consumer of one locale and zone shares one instance', () => {
    const seen: Format[] = []
    const Collect = () => {
      seen.push(useFormat())
      return null
    }
    render(
      <IntlScope locale="en-GB">
        <Collect />
        <Collect />
      </IntlScope>,
    )
    expect(seen[0]).toBe(seen[1])
  })
})

describe('useMessages', () => {
  // Real areas now carry keys, so a made-up area no longer passes the weak-type check unaided.
  const area = {
    ...base,
    'x.hello': 'Hello',
    'x.range': (f: Format, from: number, to: number) => `${f.number(from)}-${f.number(to)}`,
  } as unknown as Partial<BasaltMessages> & {
    'x.hello': string
    'x.range': (f: Format, from: number, to: number) => string
  }

  function Messages({ out }: { out: (t: ReturnType<typeof useMessages<typeof area>>) => string }) {
    return <span data-testid="out">{out(useMessages(area))}</span>
  }

  test('serves the area defaults through the formatter', () => {
    expect(text(<Messages out={(t) => `${t('x.hello')} ${t('x.range', 1000, 2000)}`} />)).toBe(
      'Hello 1,000-2,000',
    )
  })

  test('an override wins per key and keeps the rest', () => {
    const messages = {
      'x.range': (f: Format, from: number, to: number) => `${f.number(from)} bis ${f.number(to)}`,
    } as unknown as Partial<BasaltMessages>
    expect(
      text(
        <IntlScope locale="de-DE" messages={messages}>
          <Messages out={(t) => `${t('x.hello')} ${t('x.range', 1000, 2000)}`} />
        </IntlScope>,
      ),
    ).toBe('Hello 1.000 bis 2.000')
  })
})
