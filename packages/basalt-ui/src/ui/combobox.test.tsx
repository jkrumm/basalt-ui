import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
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
  comboboxChipVariants,
  comboboxInputVariants,
  autocompleteInputVariants,
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

const type = async (input: HTMLElement, text: string): Promise<void> => {
  await act(async () => {
    fireEvent.focus(input)
    fireEvent.input(input, { target: { value: text }, inputType: 'insertText' })
  })
}

const createRow = (): Element | undefined =>
  [...document.querySelectorAll('[data-slot="combobox-item"]')].find((e) =>
    (e.textContent ?? '').startsWith('Create'),
  )

function Tags(props: {
  onCreate: (text: string) => string
  seen?: (v: string[]) => void
}): ReactElement {
  const [value, setValue] = useState<string[]>([])
  return (
    <Combobox
      multiple
      items={ITEMS}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        props.seen?.(next)
      }}
      onCreate={props.onCreate}
    >
      <ComboboxChips aria-label="Tags" placeholder="Add" />
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

describe('creatable combobox', () => {
  test('an unknown text then Enter calls onCreate and the new chip appears', async () => {
    const made: string[] = []
    const seen: string[][] = []
    const { getByRole } = render(
      <Tags
        onCreate={(text) => {
          made.push(text)
          return text
        }}
        seen={(v) => seen.push(v)}
      />,
    )
    const input = getByRole('combobox', { name: 'Tags' })
    await type(input, '  Design  ')
    expect(createRow()?.textContent).toBe('Create "Design"')
    expect(document.querySelector('[data-slot="combobox-content"]')?.textContent).not.toContain(
      'No results',
    )
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(made).toEqual(['Design'])
    expect(seen.at(-1)).toEqual(['Design'])
    expect(
      [...document.querySelectorAll('[data-slot="combobox-chip"]')].map((e) => e.textContent),
    ).toEqual(['Design'])
    expect((input as HTMLInputElement).value).toBe('')
  })

  test('clicking the row creates too, and the created value joins the existing ones', async () => {
    const seen: string[][] = []
    const { getByRole } = render(<Tags onCreate={(text) => text} seen={(v) => seen.push(v)} />)
    await type(getByRole('combobox', { name: 'Tags' }), 'Brand new')
    await act(async () => {
      fireEvent.click(createRow() as Element)
    })
    await type(getByRole('combobox', { name: 'Tags' }), 'Another')
    await act(async () => {
      fireEvent.click(createRow() as Element)
    })
    expect(seen.at(-1)).toEqual(['Brand new', 'Another'])
  })

  test('a known label shows no create row, whatever the case', async () => {
    const { getByRole } = render(<Tags onCreate={(text) => text} />)
    const input = getByRole('combobox', { name: 'Tags' })
    await type(input, 'Berlin')
    expect(createRow()).toBeUndefined()
    await type(input, 'bERLIN')
    expect(createRow()).toBeUndefined()
  })

  test('empty or blank text shows no create row', async () => {
    const { getByRole } = render(<Tags onCreate={(text) => text} />)
    const input = getByRole('combobox', { name: 'Tags' })
    await type(input, '   ')
    expect(createRow()).toBeUndefined()
  })

  test('without onCreate the row never shows', async () => {
    const { getByRole } = render(
      <Combobox multiple items={ITEMS}>
        <ComboboxChips aria-label="Tags" />
        <ComboboxContent empty="No results">
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>,
    )
    await type(getByRole('combobox', { name: 'Tags' }), 'Zzz')
    expect(createRow()).toBeUndefined()
  })

  test('the row text comes from the message key combobox.create', async () => {
    const { getByRole } = render(
      <IntlScope messages={{ 'combobox.create': (_f, text) => `${text} anlegen` }}>
        <Tags onCreate={(text) => text} />
      </IntlScope>,
    )
    await type(getByRole('combobox', { name: 'Tags' }), 'Neu')
    expect(
      [...document.querySelectorAll('[data-slot="combobox-item"]')].map((e) => e.textContent),
    ).toContain('Neu anlegen')
  })

  test('single mode selects the created value', async () => {
    const seen: (string | null)[] = []
    const { getByRole } = render(
      <Combobox
        items={ITEMS}
        onValueChange={(next) => seen.push(next)}
        onCreate={(text) => text.toUpperCase()}
      >
        <ComboboxInput aria-label="City" />
        <ComboboxContent empty="No results">
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>,
    )
    const input = getByRole('combobox', { name: 'City' })
    await type(input, 'Bremen')
    expect(createRow()?.textContent).toBe('Create "Bremen"')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(seen).toEqual(['BREMEN'])
  })
})

describe('hit floors', () => {
  test('the inner input of the combobox and autocomplete boxes fills the box height', () => {
    for (const table of [comboboxInputVariants(), autocompleteInputVariants()]) {
      expect(table).toContain('[&_input]:self-stretch')
      expect(table).toContain('[&_input]:-my-px')
    }
  })

  test('the chip remove button carries a 24px hit area, 44px on a coarse pointer', async () => {
    await open(
      <Combobox multiple items={ITEMS} defaultValue={['Berlin']}>
        <ComboboxChips aria-label="Cities" />
      </Combobox>,
    )
    const cls = document.querySelector('[data-slot="combobox-chip"] button')?.className ?? ''
    for (const token of [
      'relative',
      'after:absolute',
      'after:top-1/2',
      'after:left-1/2',
      'after:size-6',
      'after:-translate-1/2',
      'pointer-coarse:after:size-11',
    ]) {
      expect(cls.split(' ')).toContain(token)
    }
    expect(comboboxChipVariants()).toContain('h-5')
  })
})
