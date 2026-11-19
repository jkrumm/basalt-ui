import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Field } from './field'
import { FileUpload, fileUploadParts, fileUploadVariants } from './file-upload'
import type { FileRejection } from './file-upload'

afterEach(cleanup)

const MB = 1024 * 1024
const pdf = (name = 'a.pdf', size = 1): File => {
  const file = new File(['x'], name, { type: 'application/pdf', lastModified: 1 })
  Object.defineProperty(file, 'size', { value: size })
  return file
}
const png = (name = 'b.png', size = 1): File => {
  const file = new File(['x'], name, { type: 'image/png', lastModified: 1 })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const zoneOf = (container: HTMLElement): HTMLElement => {
  const zone = container.querySelector<HTMLElement>('[data-slot="file-upload-zone"]')
  if (zone === null) throw new Error('no zone')
  return zone
}
const inputOf = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) throw new Error('no input')
  return input
}
const drop = (zone: HTMLElement, files: File[]): void => {
  fireEvent.drop(zone, { dataTransfer: { files } })
}
const pick = (input: HTMLInputElement, files: File[]): void => {
  fireEvent.change(input, { target: { files } })
}
const errorsOf = (container: HTMLElement): string =>
  container.querySelector('[data-slot="file-upload-errors"]')?.textContent ?? ''

describe('file-upload module', () => {
  test('renders every part, each with its data-slot, and fileUploadParts lists them', () => {
    const { container } = render(
      <FileUpload aria-label="Docs" accept=".pdf" defaultValue={[pdf()]} />,
    )
    const slots = [
      ...new Set(
        [...container.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot')),
      ),
    ]
    expect(slots.toSorted()).toEqual([...fileUploadParts].toSorted())
  })

  test('server render keeps the root slot', () => {
    const html = renderToString(<FileUpload aria-label="Docs" />)
    expect(html).toContain('data-slot="file-upload"')
    expect(html).toContain('data-slot="file-upload-zone"')
  })

  test('the errors region is always mounted and live', () => {
    const { container } = render(<FileUpload aria-label="Docs" />)
    const region = container.querySelector('[data-slot="file-upload-errors"]')
    expect(region?.getAttribute('aria-live')).toBe('polite')
  })

  test('the zone text follows multiple and the derived hint names the limits', () => {
    const { container, rerender } = render(
      <FileUpload aria-label="Docs" accept="application/pdf,.png" maxSize={5 * MB} />,
    )
    expect(zoneOf(container).textContent).toContain('Drop a file here or browse')
    expect(container.querySelector('[data-slot="file-upload-hint"]')?.textContent).toBe(
      'PDF or PNG, up to 5 MB',
    )
    rerender(<FileUpload aria-label="Docs" multiple />)
    expect(zoneOf(container).textContent).toContain('Drop files here or browse')
    rerender(<FileUpload aria-label="Docs" hint="Max 3 invoices" />)
    expect(container.querySelector('[data-slot="file-upload-hint"]')?.textContent).toBe(
      'Max 3 invoices',
    )
    rerender(<FileUpload aria-label="Docs" hint={null} accept=".pdf" />)
    expect(container.querySelector('[data-slot="file-upload-hint"]')).toBeNull()
  })

  test('accepts by MIME type, by extension and by wildcard', () => {
    const seen: File[][] = []
    const { container, rerender } = render(
      <FileUpload aria-label="Docs" accept="application/pdf" onValueChange={(f) => seen.push(f)} />,
    )
    drop(zoneOf(container), [pdf()])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['a.pdf'])

    rerender(<FileUpload aria-label="Docs" accept=".PNG" onValueChange={(f) => seen.push(f)} />)
    drop(zoneOf(container), [png('c.png')])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['c.png'])

    rerender(<FileUpload aria-label="Docs" accept="image/*" onValueChange={(f) => seen.push(f)} />)
    drop(zoneOf(container), [png('d.png')])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['d.png'])
    expect(errorsOf(container)).toBe('')
  })

  test('rejects by type with the message and reports it to onReject', () => {
    const rejected: (readonly FileRejection[])[] = []
    const seen: File[][] = []
    const doc = new File(['x'], 'report.docx', { type: 'application/msword' })
    const { container } = render(
      <FileUpload
        aria-label="Docs"
        accept="application/pdf,.png"
        onValueChange={(f) => seen.push(f)}
        onReject={(r) => rejected.push(r)}
      />,
    )
    drop(zoneOf(container), [doc])
    expect(errorsOf(container)).toBe('report.docx is not an accepted type (PDF or PNG).')
    expect(rejected[0]?.[0]?.reason).toBe('type')
    expect(rejected[0]?.[0]?.file).toBe(doc)
    expect(seen).toEqual([])
    expect(zoneOf(container).hasAttribute('data-invalid')).toBe(true)
    expect(inputOf(container).getAttribute('aria-invalid')).toBe('true')
  })

  test('rejects by size', () => {
    const rejected: (readonly FileRejection[])[] = []
    const { container } = render(
      <FileUpload aria-label="Docs" maxSize={5 * MB} onReject={(r) => rejected.push(r)} />,
    )
    drop(zoneOf(container), [png('scan.png', 5 * MB + 1)])
    expect(errorsOf(container)).toBe('scan.png is over 5 MB.')
    expect(rejected[0]?.[0]?.reason).toBe('size')
  })

  test('rejects past maxFiles and a second file in single mode with the count message', () => {
    const rejected: (readonly FileRejection[])[] = []
    const seen: File[][] = []
    const { container, rerender } = render(
      <FileUpload
        aria-label="Docs"
        multiple
        maxFiles={3}
        onValueChange={(f) => seen.push(f)}
        onReject={(r) => rejected.push(r)}
      />,
    )
    drop(zoneOf(container), [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf'), pdf('4.pdf'), pdf('5.pdf')])
    expect(errorsOf(container)).toBe('Only 3 files can be added.')
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['1.pdf', '2.pdf', '3.pdf'])
    expect(rejected[0]?.map((r) => r.reason)).toEqual(['count', 'count'])

    rerender(<FileUpload aria-label="Docs" onValueChange={(f) => seen.push(f)} />)
    drop(zoneOf(container), [pdf('a.pdf'), pdf('b.pdf')])
    expect(errorsOf(container)).toBe('Only 1 file can be added.')
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['a.pdf'])
  })

  test('single mode replaces the file and shows the compact "Replace file" zone', () => {
    const seen: File[][] = []
    const { container } = render(
      <FileUpload aria-label="Docs" onValueChange={(f) => seen.push(f)} />,
    )
    drop(zoneOf(container), [pdf('a.pdf')])
    expect(container.querySelectorAll('[data-slot="file-upload-item"]').length).toBe(1)
    expect(zoneOf(container).textContent).toContain('Replace file')
    expect(zoneOf(container).className).toBe(fileUploadVariants({ compact: true }))
    drop(zoneOf(container), [pdf('b.pdf')])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['b.pdf'])
    const items = container.querySelectorAll('[data-slot="file-upload-item"]')
    expect(items.length).toBe(1)
    expect(items[0]?.textContent).toContain('b.pdf')
  })

  test('multiple appends and de-duplicates by name, size and modified time', () => {
    const seen: File[][] = []
    const { container } = render(
      <FileUpload aria-label="Docs" multiple onValueChange={(f) => seen.push(f)} />,
    )
    drop(zoneOf(container), [pdf('a.pdf')])
    drop(zoneOf(container), [pdf('a.pdf'), pdf('b.pdf')])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf'])
    expect(container.querySelectorAll('[data-slot="file-upload-item"]').length).toBe(2)
    expect(errorsOf(container)).toBe('')
  })

  test('a chosen file shows its name with a title, its size and a named remove button', () => {
    const seen: File[][] = []
    const { container, getByRole } = render(
      <FileUpload
        aria-label="Docs"
        multiple
        defaultValue={[pdf('a.pdf', 1536), pdf('b.pdf', 2 * MB)]}
        onValueChange={(f) => seen.push(f)}
      />,
    )
    const first = container.querySelectorAll('[data-slot="file-upload-item"]')[0]
    if (first === undefined) throw new Error('no item')
    expect(
      within(first as HTMLElement)
        .getByText('a.pdf')
        .getAttribute('title'),
    ).toBe('a.pdf')
    expect(first.textContent).toContain('1.5 KB')
    expect(container.textContent).toContain('2 MB')
    fireEvent.click(getByRole('button', { name: 'Remove a.pdf' }))
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['b.pdf'])
    expect(container.querySelectorAll('[data-slot="file-upload-item"]').length).toBe(1)
  })

  test('is controlled by value: the list follows the prop, not the choice', () => {
    const seen: File[][] = []
    const { container, rerender } = render(
      <FileUpload aria-label="Docs" value={[]} onValueChange={(f) => seen.push(f)} />,
    )
    drop(zoneOf(container), [pdf('a.pdf')])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['a.pdf'])
    expect(container.querySelector('[data-slot="file-upload-list"]')).toBeNull()
    rerender(<FileUpload aria-label="Docs" value={[pdf('a.pdf')]} onValueChange={() => {}} />)
    expect(container.querySelectorAll('[data-slot="file-upload-item"]').length).toBe(1)
  })

  test('the hidden input carries the picker: change, name, accept and multiple', () => {
    const seen: File[][] = []
    const { container } = render(
      <FileUpload
        aria-label="Docs"
        name="docs"
        accept=".pdf"
        multiple
        onValueChange={(f) => seen.push(f)}
      />,
    )
    const input = inputOf(container)
    expect(input.getAttribute('name')).toBe('docs')
    expect(input.getAttribute('accept')).toBe('.pdf')
    expect(input.multiple).toBe(true)
    pick(input, [pdf('a.pdf')])
    expect(seen.at(-1)?.map((f) => f.name)).toEqual(['a.pdf'])
  })

  test('dragging over sets data-dragging; leaving or dropping clears it', () => {
    const { container } = render(<FileUpload aria-label="Docs" />)
    const zone = zoneOf(container)
    fireEvent.dragEnter(zone)
    expect(zone.hasAttribute('data-dragging')).toBe(true)
    fireEvent.dragLeave(zone)
    expect(zone.hasAttribute('data-dragging')).toBe(false)
    fireEvent.dragOver(zone)
    expect(zone.hasAttribute('data-dragging')).toBe(true)
    drop(zone, [pdf()])
    expect(zone.hasAttribute('data-dragging')).toBe(false)
  })

  test('disabled ignores drop, change, click and the remove button', () => {
    const seen: File[][] = []
    const click = spyOn(HTMLInputElement.prototype, 'click')
    const { container, getByRole } = render(
      <FileUpload
        aria-label="Docs"
        disabled
        defaultValue={[pdf('a.pdf')]}
        onValueChange={(f) => seen.push(f)}
      />,
    )
    const zone = zoneOf(container)
    expect(zone.hasAttribute('data-disabled')).toBe(true)
    expect(zone.getAttribute('aria-disabled')).toBe('true')
    drop(zone, [pdf('b.pdf')])
    pick(inputOf(container), [pdf('c.pdf')])
    fireEvent.click(zone)
    fireEvent.dragOver(zone)
    expect(zone.hasAttribute('data-dragging')).toBe(false)
    expect(getByRole('button', { name: 'Remove a.pdf' }).hasAttribute('disabled')).toBe(true)
    expect(seen).toEqual([])
    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })

  test('the zone is one native button; activating it clicks the hidden input once', () => {
    const click = spyOn(HTMLInputElement.prototype, 'click')
    const { container } = render(<FileUpload aria-label="Docs" />)
    const zone = zoneOf(container)
    // A native <button type="button">: Enter and Space activation is the browser's, as a click.
    expect(zone.tagName).toBe('BUTTON')
    expect(zone.getAttribute('type')).toBe('button')
    expect(container.querySelectorAll('button').length).toBe(1)
    fireEvent.click(zone)
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })

  test('the zone is described by the hint, the errors region and a caller id', () => {
    const { container } = render(
      <FileUpload aria-label="Docs" accept=".pdf" aria-describedby="outside" />,
    )
    const ids = (zoneOf(container).getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids[0]).toBe('outside')
    expect(container.querySelector('[data-slot="file-upload-hint"]')?.id).toBe(ids[1])
    expect(container.querySelector('[data-slot="file-upload-errors"]')?.id).toBe(ids[2])
  })

  test('inside a Field the label names the input and the name reaches it', () => {
    const { container, getByLabelText } = render(
      <Field label="Invoice">
        <FileUpload name="invoice" />
      </Field>,
    )
    expect(getByLabelText('Invoice')).toBe(inputOf(container))
    expect(inputOf(container).getAttribute('name')).toBe('invoice')
  })
})
