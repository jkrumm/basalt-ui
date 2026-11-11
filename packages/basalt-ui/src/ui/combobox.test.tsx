import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../core/provider-props'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  comboboxParts,
} from './combobox'

afterEach(cleanup)

const ITEMS = ['Berlin', 'Hamburg', 'Munich']

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

function Cities(props: { defaultOpen?: boolean }): ReactElement {
  return (
    <Combobox items={ITEMS} defaultOpen={props.defaultOpen ?? false}>
      <ComboboxInput aria-label="City" placeholder="Search" />
      <ComboboxContent empty="No results">
        {(item: string) => (
          <ComboboxItem key={item} value={item}>
            {item}
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
  )
}

const dismissLabels = (): string[] =>
  [...document.querySelectorAll('[aria-label="Dismiss"], [aria-label="Schließen"]')].map(
    (el) => el.getAttribute('aria-label') ?? '',
  )

const open = async (ui: ReactElement): Promise<void> => {
  await act(async () => {
    render(ui)
  })
}

describe('combobox module', () => {
  test('renders closed with no provider; the input is named', () => {
    const { container, getByRole } = render(<Cities />)
    expect(slots(container)).toEqual(['combobox', 'combobox-input'])
    expect(getByRole('combobox', { name: 'City' }).tagName).toBe('INPUT')
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Cities />)
    expect(html).toContain('data-slot="combobox"')
    expect(html).toContain('data-slot="combobox-input"')
  })

  test('open, the popup lists the items under combobox-item', async () => {
    await open(<Cities defaultOpen />)
    expect(
      [...document.querySelectorAll('[data-slot="combobox-item"]')].map((e) => e.textContent),
    ).toEqual(ITEMS)
  })

  test('the hidden dismiss buttons are named in English by default', async () => {
    await open(<Cities defaultOpen />)
    expect(dismissLabels().length).toBeGreaterThan(0)
    expect(new Set(dismissLabels())).toEqual(new Set(['Dismiss']))
  })

  test('overriding the message key combobox.dismiss changes the rendered label', async () => {
    await open(
      <IntlScope messages={{ 'combobox.dismiss': 'Schließen' }}>
        <Cities defaultOpen />
      </IntlScope>,
    )
    expect(dismissLabels().length).toBeGreaterThan(0)
    expect(new Set(dismissLabels())).toEqual(new Set(['Schließen']))
    expect(document.querySelector('[aria-label="Dismiss"]')).toBeNull()
  })

  test('closing and reopening keeps the override (open/close cycles)', async () => {
    const view = (isOpen: boolean): ReactElement => (
      <IntlScope messages={{ 'combobox.dismiss': 'Schließen' }}>
        <Combobox items={ITEMS} open={isOpen}>
          <ComboboxInput aria-label="City" />
          <ComboboxContent>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxContent>
        </Combobox>
      </IntlScope>
    )
    let rerender: (ui: ReactElement) => void = () => {}
    await act(async () => {
      rerender = render(view(true)).rerender
    })
    for (const next of [false, true, false, true]) {
      await act(async () => rerender(view(next)))
    }
    expect(document.querySelector('[aria-label="Dismiss"]')).toBeNull()
    expect(dismissLabels().length).toBeGreaterThan(0)
  })

  test('chips: selected values render as chips whose remove buttons are named', async () => {
    await open(
      <Combobox multiple items={ITEMS} defaultValue={['Berlin', 'Munich']}>
        <ComboboxChips aria-label="Cities" placeholder="Add" />
        <ComboboxContent>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>,
    )
    expect(
      [...document.querySelectorAll('[data-slot="combobox-chip"]')].map((e) => e.textContent),
    ).toEqual(['Berlin', 'Munich'])
    expect(
      [...document.querySelectorAll('[data-slot="combobox-chip"] button')].map((e) =>
        e.getAttribute('aria-label'),
      ),
    ).toEqual(['Remove Berlin', 'Remove Munich'])
  })

  test('the remove name comes from the message key combobox.remove', async () => {
    await open(
      <IntlScope messages={{ 'combobox.remove': (_f, label) => `${label} entfernen` }}>
        <Combobox multiple items={ITEMS} defaultValue={['Berlin']}>
          <ComboboxChips aria-label="Cities" />
        </Combobox>
      </IntlScope>,
    )
    expect(
      document.querySelector('[data-slot="combobox-chip"] button')?.getAttribute('aria-label'),
    ).toBe('Berlin entfernen')
  })
})

describe('autocomplete', () => {
  test('renders, opens and lists suggestions under autocomplete-item', async () => {
    await open(
      <Autocomplete items={ITEMS} defaultOpen>
        <AutocompleteInput aria-label="City" />
        <AutocompleteContent>
          {(item: string) => (
            <AutocompleteItem key={item} value={item}>
              {item}
            </AutocompleteItem>
          )}
        </AutocompleteContent>
      </Autocomplete>,
    )
    expect(document.querySelector('[data-slot="autocomplete"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-slot="autocomplete-item"]').length).toBe(3)
  })

  test('comboboxParts lists every slot the module can render', () => {
    expect([...comboboxParts]).toEqual([
      'combobox',
      'combobox-input',
      'combobox-content',
      'combobox-item',
      'combobox-chips',
      'combobox-chip',
      'autocomplete',
      'autocomplete-input',
      'autocomplete-content',
      'autocomplete-item',
    ])
  })
})
