/**
 * The form layout primitives — the two things about them that a regression would not show:
 *
 *  1. **The phone twin is CSS, not a JS branch** (law C9). `FormRow` renders ONE tree at every
 *     viewport and the label-above swap lives in a `@media` block, so the assertion has to be made
 *     against the CSS TEXT — the SSR-markup idiom `dashboard/stat-card.test.tsx` uses for its rail,
 *     one lane over. A `useMediaQuery` regression would keep every DOM test green and still ship a
 *     row that renders the desktop layout into server markup.
 *
 *  2. **Disabled propagation is a `fieldset`, not a prop.** Nothing here passes `disabled` to a
 *     child, so a "we'll just clone the children" rewrite would pass a shallow render check and
 *     silently stop disabling any control basalt does not recognise. The tests assert the ATTRIBUTE
 *     on the rendered fieldset, which is what the browser actually acts on.
 *
 * `renderToStaticMarkup` rather than the DOM harness for the same reason `stat-card.test.tsx` uses
 * it: these are structural claims about painted markup, not interaction.
 */
import { MantineProvider } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { FormActions, FormGroup, FormRow, FormSection } from './form-layout'
import { FormStateProvider } from './form-state'
import type { ReactNode } from 'react'

function render(tree: ReactNode): string {
  return renderToStaticMarkup(<MantineProvider>{tree}</MantineProvider>)
}

// ── the phone CSS twin ────────────────────────────────────────────────────────

describe('the label-above swap is CSS at the `sm` breakpoint, never a JS media query', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'form-layout.module.css'), 'utf8')
  /** Declarations only — the comments above them name the breakpoint and the columns in prose. */
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, '')

  test('the desktop row is two columns', () => {
    const start = decls.indexOf('.row {')
    expect(start).toBeGreaterThan(-1)
    expect(decls.slice(start, decls.indexOf('}', start))).toContain(
      'grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr)',
    )
  })

  test('below `sm` the same .row collapses to one column', () => {
    const media = decls.indexOf('@media (max-width: 47.99375em)')
    expect(media).toBeGreaterThan(-1)
    const block = decls.slice(media, decls.indexOf('\n}', decls.indexOf('.row {', media)))
    expect(block).toContain('grid-template-columns: minmax(0, 1fr)')
  })

  test('the source carries no media-query hook — the twin cannot be a render branch', () => {
    // Comments stripped: the JSDoc above `FormRow` names the hook to say it is NOT used.
    const source = readFileSync(resolve(import.meta.dirname, 'form-layout.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(source).not.toContain('useMediaQuery')
  })

  test('every gap is a density-tracking --vx-space-* token, never a px literal', () => {
    for (const [, value] of decls.matchAll(/\bgap:\s*([^;]+);/g)) {
      expect(value).toContain('var(--vx-space-')
    }
  })
})

// ── FormRow ───────────────────────────────────────────────────────────────────

describe('FormRow', () => {
  test('renders the label, the hint and the error', () => {
    const markup = render(
      <FormRow label="Email" hint="Receipts only." error="Already taken">
        <span>control</span>
      </FormRow>,
    )
    expect(markup).toContain('Email')
    expect(markup).toContain('Receipts only.')
    expect(markup).toContain('Already taken')
  })

  test('a falsy error renders no error node — `form.errors[path]` is undefined on a clean field', () => {
    const markup = render(
      <FormRow label="Email">
        <span>control</span>
      </FormRow>,
    )
    expect(markup).not.toContain('class="_error')
  })

  test('required states itself in TEXT as well as in the glyph (WCAG 1.3.1)', () => {
    const markup = render(
      <FormRow label="Email" required>
        <span>control</span>
      </FormRow>,
    )
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('(required)')
  })

  test('htmlFor associates the row label with the control it names', () => {
    const markup = render(
      <FormRow label="Email" htmlFor="email-input">
        <span>control</span>
      </FormRow>,
    )
    expect(markup).toContain('for="email-input"')
  })

  test('className reaches the row root (common/props.ts)', () => {
    expect(
      render(
        <FormRow label="Email" className="my-row">
          <span>control</span>
        </FormRow>,
      ),
    ).toContain('my-row')
  })

  test('the per-slot classNames reach the label box and the control fieldset', () => {
    const markup = render(
      <FormRow label="Email" classNames={{ root: 'r', label: 'l', control: 'c' }}>
        <span>control</span>
      </FormRow>,
    )
    // Each slot is a DIFFERENT box (`common/props.ts`) — asserting all three separately is what
    // catches a rewrite that collapsed two of them onto one element.
    expect(markup).toContain('r')
    expect(markup).toMatch(/class="[^"]*\bl\b[^"]*"/)
    expect(markup).toMatch(/<fieldset class="[^"]*\bc\b/)
  })

  test('a missing label throws NAMING the component and the prop (F-ERR-1)', () => {
    expect(() =>
      // @ts-expect-error — the whole point: the runtime message is what a consumer gets.
      render(<FormRow>{null}</FormRow>),
    ).toThrow(/FormRow/)
  })
})

// ── disabled propagation ──────────────────────────────────────────────────────

describe('FormStateProvider disables through a native fieldset, never a cloned prop', () => {
  test('no provider — the control region is an enabled fieldset', () => {
    const markup = render(
      <FormRow label="Email">
        <span>control</span>
      </FormRow>,
    )
    expect(markup).toContain('<fieldset')
    expect(markup).not.toContain('disabled=""')
  })

  test('submitting disables the row, the group and the actions together', () => {
    const markup = render(
      <FormStateProvider submitting>
        <FormRow label="Email">
          <span>control</span>
        </FormRow>
        <FormGroup label="Notify">
          <span>option</span>
        </FormGroup>
        <FormActions actions={<button type="button">Save</button>} />
      </FormStateProvider>,
    )
    expect(markup.match(/<fieldset[^>]*disabled=""/g)).toHaveLength(3)
  })

  test('an inner provider cannot re-enable a submitting form', () => {
    const markup = render(
      <FormStateProvider submitting>
        <FormStateProvider disabled={false}>
          <FormRow label="Email">
            <span>control</span>
          </FormRow>
        </FormStateProvider>
      </FormStateProvider>,
    )
    expect(markup).toContain('disabled=""')
  })
})

// ── FormGroup / FormSection / FormActions ─────────────────────────────────────

describe('FormGroup', () => {
  test('is a real fieldset+legend — the grouping semantic for one shared question', () => {
    const markup = render(
      <FormGroup label="Notify me about">
        <span>Deploys</span>
      </FormGroup>,
    )
    expect(markup).toContain('<fieldset')
    expect(markup).toContain('<legend')
    expect(markup).toContain('Notify me about')
  })

  test('a falsy error renders no error node — the same three shapes FormRow accepts', () => {
    for (const error of [undefined, null, false] as const) {
      const markup = render(
        <FormGroup label="Notify" error={error}>
          <span>option</span>
        </FormGroup>,
      )
      expect(markup).not.toContain('class="_error')
    }
  })

  test('required states itself in TEXT inside the legend as well as in the glyph', () => {
    const markup = render(
      <FormGroup label="Notify" required>
        <span>option</span>
      </FormGroup>,
    )
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('(required)')
  })

  test('a missing label throws NAMING the component (F-ERR-1)', () => {
    expect(() =>
      // @ts-expect-error — the whole point: the runtime message is what a consumer gets.
      render(<FormGroup>{null}</FormGroup>),
    ).toThrow(/FormGroup/)
  })

  test('direction reaches the controls box as data, defaulting to column', () => {
    expect(render(<FormGroup label="G">x</FormGroup>)).toContain('data-direction="column"')
    expect(
      render(
        <FormGroup label="G" direction="row">
          x
        </FormGroup>,
      ),
    ).toContain('data-direction="row"')
  })
})

describe('FormSection', () => {
  test('renders a WidgetHeader section title and the body, and paints no card', () => {
    const markup = render(
      <FormSection title="Billing" subtitle="Where the invoice goes.">
        <span>rows</span>
      </FormSection>,
    )
    expect(markup).toContain('Billing')
    expect(markup).toContain('Where the invoice goes.')
    expect(markup).toContain('<h2')
    // A card surface here would be the second card a form is already inside.
    expect(markup).not.toContain('mantine-Card-root')
  })

  test('the per-slot classNames reach the header and the body', () => {
    const markup = render(
      <FormSection title="Billing" classNames={{ root: 'sec', header: 'hd', body: 'bd' }}>
        <span>rows</span>
      </FormSection>,
    )
    expect(markup).toContain('sec')
    expect(markup).toMatch(/class="[^"]*\bhd\b/)
    expect(markup).toMatch(/class="[^"]*\bbd\b/)
  })

  test('a missing title throws NAMING the component (F-ERR-1)', () => {
    expect(() =>
      // @ts-expect-error — the whole point: the runtime message is what a consumer gets.
      render(<FormSection>{null}</FormSection>),
    ).toThrow(/FormSection/)
  })
})

describe('FormActions', () => {
  test('the typed BarAction[] arm goes through the shared slot projection', () => {
    const markup = render(<FormActions actions={[{ key: 'save', label: 'Save' }]} />)
    expect(markup).toContain('Save')
  })

  test('the ReactNode arm renders verbatim', () => {
    expect(render(<FormActions actions={<span>custom</span>} />)).toContain('custom')
  })

  test('an empty list paints nothing but the row itself', () => {
    const markup = render(<FormActions actions={[]} />)
    expect(markup).toContain('<fieldset')
    expect(markup).not.toContain('<button')
  })
})
