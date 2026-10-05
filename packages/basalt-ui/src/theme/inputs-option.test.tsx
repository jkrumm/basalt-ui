/**
 * `createBasaltTheme`'s `{ inputs }` option — desktop input sizing for apps that never run in a
 * mobile browser. The default path stays on the static `baseTheme` (no `basaltInputs`, `md`
 * inputs); `'desktop'` flips the Input family to Mantine's `sm` and flags the theme so
 * `BasaltProvider` lifts the 16px iOS font floor.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { BasaltProvider } from '../provider'
import { createBasaltTheme } from './index'

const INPUT_FAMILY = ['Input', 'TextInput', 'NumberInput', 'PasswordInput', 'Select', 'Textarea']

describe('the default stays touch-safe', () => {
  test.each([undefined, { inputs: 'touch' as const }])(
    'options %p: md inputs, no flag',
    (options) => {
      const theme = createBasaltTheme(undefined, options)
      expect(theme.other?.['basaltInputs']).toBeUndefined()
      for (const name of INPUT_FAMILY) {
        expect(theme.components?.[name]?.defaultProps?.['size']).toBe('md')
      }
    },
  )
})

describe("inputs: 'desktop'", () => {
  const theme = createBasaltTheme(undefined, { inputs: 'desktop' })

  test('the Input family defaults to sm', () => {
    for (const name of INPUT_FAMILY) {
      expect(theme.components?.[name]?.defaultProps?.['size']).toBe('sm')
    }
  })

  test('the theme is flagged, and composes with other options', () => {
    expect(theme.other?.['basaltInputs']).toBe('desktop')
    const both = createBasaltTheme(undefined, { inputs: 'desktop', density: -1 })
    expect(both.other?.['basaltInputs']).toBe('desktop')
    expect(both.other?.['basaltDensity']).toBeDefined()
  })

  test('the provider lifts the floor only for desktop', () => {
    const html = (t: ReturnType<typeof createBasaltTheme>) =>
      renderToStaticMarkup(<BasaltProvider theme={t}>x</BasaltProvider>)
    expect(html(theme)).toContain('--basalt-input-fz-floor: 0px')
    expect(html(createBasaltTheme())).not.toContain('--basalt-input-fz-floor')
  })
})
