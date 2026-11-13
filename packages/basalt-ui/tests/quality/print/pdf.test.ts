import { expect, test } from 'bun:test'
import { pdfPageCount } from './pdf'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

test('counts page objects and not the page tree', () => {
  const pdf = bytes(
    '1 0 obj<</Type /Pages /Count 2>>endobj 2 0 obj<</Type /Page /Parent 1 0 R>>endobj 3 0 obj<</Type/Page/Parent 1 0 R>>endobj',
  )
  expect(pdfPageCount(pdf)).toBe(2)
})

test('a document with no page object counts zero', () => {
  expect(pdfPageCount(bytes('%PDF-1.4 <</Type /Catalog /Pages 1 0 R>>'))).toBe(0)
})
