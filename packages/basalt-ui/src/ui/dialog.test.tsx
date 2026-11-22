import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { IntlScope } from '../core/provider-props'
import {
  AlertDialog,
  AlertDialogContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  dialogParts,
} from './dialog'

afterEach(cleanup)

const slots = (): string[] =>
  [...document.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('dialog module', () => {
  test('closed, the dialog renders its trigger and no popup', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent title="Rename">Body</DialogContent>
      </Dialog>,
    )
    expect(slots()).toEqual(['dialog-trigger'])
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  test('open, the panel is portalled to the body, named by its title and described', () => {
    const { container } = render(
      <Dialog defaultOpen>
        <DialogContent title="Rename" description="Shown in the sidebar.">
          Body
        </DialogContent>
      </Dialog>,
    )
    expect(container.querySelector('[data-slot]')).toBeNull()
    const panel = document.querySelector('[role="dialog"]')
    expect(panel?.getAttribute('data-slot')).toBe('dialog-content')
    expect(panel?.getAttribute('aria-labelledby')).toBe(
      document.querySelector('[data-slot="dialog-title"]')?.id ?? 'missing',
    )
    expect(panel?.getAttribute('aria-describedby')).toBe(
      document.querySelector('[data-slot="dialog-description"]')?.id ?? 'missing',
    )
    for (const slot of slots()) expect(dialogParts as readonly string[]).toContain(slot)
  })

  test('the corner close is named by the dialog.close message and an override replaces it', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="Rename">Body</DialogContent>
      </Dialog>,
    )
    expect(document.querySelector('[data-slot="dialog-close"]')?.getAttribute('aria-label')).toBe(
      'Close',
    )
    cleanup()
    render(
      <IntlScope messages={{ 'dialog.close': 'Schließen' }}>
        <Dialog defaultOpen>
          <DialogContent title="Rename">Body</DialogContent>
        </Dialog>
      </IntlScope>,
    )
    expect(document.querySelector('[data-slot="dialog-close"]')?.getAttribute('aria-label')).toBe(
      'Schließen',
    )
  })

  test('a DialogClose with children is a bare close trigger without the glyph label', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="Rename">
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>,
    )
    const closes = [...document.querySelectorAll('[data-slot="dialog-close"]')]
    expect(closes.map((c) => c.getAttribute('aria-label'))).toEqual(['Close', null])
  })

  test('wide and split are the two sizes above lg; split has no header and no padding', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="Viewer" size="wide">
          Body
        </DialogContent>
      </Dialog>,
    )
    expect(document.querySelector('[data-slot="dialog-content"]')?.className).toContain('max-w-5xl')
    cleanup()
    render(
      <Dialog defaultOpen>
        <DialogContent title="New contract" description="Five steps." size="split">
          Body
        </DialogContent>
      </Dialog>,
    )
    const panel = document.querySelector('[data-slot="dialog-content"]')
    expect(panel?.className).toContain('max-w-275')
    expect(panel?.className).toContain('p-0')
    expect(panel?.className).not.toContain('p-4')
    expect(panel?.querySelector('header')).toBeNull()
    expect(document.querySelector('[data-slot="dialog-title"]')?.className).toContain('sr-only')
    expect(panel?.getAttribute('aria-labelledby')).toBe(
      document.querySelector('[data-slot="dialog-title"]')?.id ?? 'missing',
    )
  })

  test('the header takes a meta line and typed actions, each an icon button named by its label', () => {
    const seen: string[] = []
    const Glyph = (props: { className?: string }) => <svg className={props.className} />
    render(
      <Dialog defaultOpen>
        <DialogContent
          title="report.pdf"
          size="wide"
          meta="2.4 MB, 12 Nov"
          actions={[
            { label: 'Download', icon: Glyph, onClick: () => void seen.push('download') },
            {
              label: 'Delete',
              icon: Glyph,
              tone: 'danger',
              onClick: () => void seen.push('delete'),
            },
          ]}
        >
          Body
        </DialogContent>
      </Dialog>,
    )
    expect(document.querySelector('header p')?.textContent).toBe('2.4 MB, 12 Nov')
    const names = [...document.querySelectorAll('header button[title]')]
    expect(names.map((b) => b.getAttribute('aria-label'))).toEqual(['Download', 'Delete'])
    fireEvent.click(names[1]!)
    expect(seen).toEqual(['delete'])
  })

  test('the Dialog backdrop is the wash and the AlertDialog backdrop is the strong scrim', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="Rename">Body</DialogContent>
      </Dialog>,
    )
    const backdrop = (): string =>
      document.querySelector('[role="dialog"], [role="alertdialog"]')?.parentElement
        ?.previousElementSibling?.className ?? ''
    expect(backdrop()).toContain('bg-scrim-wash')
    cleanup()
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent title="Delete?">
          <DialogClose>Ok</DialogClose>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(backdrop()).toContain('bg-scrim')
    expect(backdrop()).not.toContain('bg-scrim-wash')
  })

  test('size picks the width and the alert dialog has no corner close', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="Wide" size="lg">
          Body
        </DialogContent>
      </Dialog>,
    )
    expect(document.querySelector('[data-slot="dialog-content"]')?.className).toContain('max-w-2xl')
    cleanup()
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent title="Delete?" description="No undo.">
          <DialogClose>Ok</DialogClose>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-slot="dialog-close"]')).toHaveLength(1)
  })
})
