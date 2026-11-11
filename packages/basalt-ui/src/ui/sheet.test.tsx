import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { IntlScope } from '../core/provider-props'
import { Sheet, SheetClose, SheetContent, SheetTrigger, sheetParts } from './sheet'

afterEach(cleanup)

describe('sheet module', () => {
  test('closed, the sheet renders its trigger and no popup', () => {
    render(
      <Sheet>
        <SheetTrigger>Edit</SheetTrigger>
        <SheetContent title="Edit record">Form</SheetContent>
      </Sheet>,
    )
    expect(document.querySelector('[data-slot="sheet-trigger"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()
  })

  test('open, the panel is named by its title and every slot is listed', () => {
    render(
      <Sheet defaultOpen placement="right">
        <SheetContent title="Edit record">Form</SheetContent>
      </Sheet>,
    )
    const panel = document.querySelector('[data-slot="sheet-content"]')
    expect(panel).not.toBeNull()
    expect(panel?.getAttribute('aria-labelledby')).toBe(
      document.querySelector('[data-slot="sheet-title"]')?.id ?? 'missing',
    )
    expect(panel?.className).toContain('w-90')
    for (const el of document.querySelectorAll('[data-slot]')) {
      expect(sheetParts as readonly string[]).toContain(el.getAttribute('data-slot') ?? '')
    }
  })

  test('placement picks the table: bottom caps the height, auto carries both', () => {
    render(
      <Sheet defaultOpen placement="bottom">
        <SheetContent title="Edit">Form</SheetContent>
      </Sheet>,
    )
    expect(document.querySelector('[data-slot="sheet-content"]')?.className).toContain(
      'max-h-[min(72dvh,560px)]',
    )
    cleanup()
    render(
      <Sheet defaultOpen>
        <SheetContent title="Edit">Form</SheetContent>
      </Sheet>,
    )
    const auto = document.querySelector('[data-slot="sheet-content"]')?.className ?? ''
    expect(auto).toContain('max-h-[min(72dvh,560px)]')
    expect(auto).toContain('md:w-90')
  })

  test('the corner close is named by the sheet.close message and an override replaces it', () => {
    render(
      <IntlScope messages={{ 'sheet.close': 'Schließen' }}>
        <Sheet defaultOpen>
          <SheetContent title="Edit">
            <SheetClose>Cancel</SheetClose>
          </SheetContent>
        </Sheet>
      </IntlScope>,
    )
    const closes = [...document.querySelectorAll('[data-slot="sheet-close"]')]
    expect(closes.map((c) => c.getAttribute('aria-label'))).toEqual(['Schließen', null])
  })
})
