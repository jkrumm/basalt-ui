/**
 * `Composer`'s `onPaste` prop — absorbed from the retired `/agent-composer` playground route
 * (audit E §7). `composer.test.tsx` covers every other slot on the same prop set (`leftSection`/
 * `rightSection`/`draftKey`/the async `onSubmit` clear-and-rollback contract) but never exercised
 * `onPaste`; this file closes that one gap.
 *
 * `Composer` does no file handling itself — `onPaste` is a raw passthrough onto the textarea's own
 * `onPaste`, so the whole contract is "the event a consumer receives is the real clipboard event,
 * unmodified" (the playground page's own attach-on-paste logic lives entirely on the consumer
 * side, which is exactly what this proves is possible with no Composer-side support needed).
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Composer } from './composer'
import type { ComposerProps } from './composer'

afterEach(cleanup)

function renderComposer(props: ComposerProps) {
  return render(
    <MantineProvider>
      <Composer {...props} />
    </MantineProvider>,
  )
}

const noop = (): void => {}

describe('Composer onPaste', () => {
  test('forwards a paste event on the textarea to the onPaste prop, clipboardData intact', () => {
    let received: DataTransfer | undefined
    renderComposer({
      onSubmit: noop,
      onPaste: (event) => {
        received = event.clipboardData
      },
    })

    const file = new File(['binary'], 'screenshot.png', { type: 'image/png' })
    const clipboardData = {
      files: [file],
      getData: () => '',
    } as unknown as DataTransfer

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData })

    expect(received).toBeDefined()
    const files = received === undefined ? [] : Array.from(received.files)
    expect(files.length).toBe(1)
    expect(files[0]?.name).toBe('screenshot.png')
  })

  test('with no onPaste prop, a paste on the textarea does not throw', () => {
    renderComposer({ onSubmit: noop })
    expect(() =>
      fireEvent.paste(screen.getByRole('textbox'), {
        clipboardData: { files: [], getData: () => '' } as unknown as DataTransfer,
      }),
    ).not.toThrow()
  })
})
