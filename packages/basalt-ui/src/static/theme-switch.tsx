import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Scheme } from '../core/scheme'
import { Glyph } from './glyphs'

export type ThemeSwitchProps = {
  /** The group's accessible name ("Color scheme"). */
  label: string
  /** Each option's accessible name; the buttons show only a glyph. */
  labels: Readonly<Record<Scheme, string>>
  className?: string
}

const OPTIONS = [
  { scheme: 'light', glyph: 'sun' },
  { scheme: 'dark', glyph: 'moon' },
  { scheme: 'auto', glyph: 'system' },
] as const

/**
 * Light, dark or system: three toggle buttons in one group. Static markup; `siteScript()` makes
 * them work (it applies and stores the choice under `basalt:scheme`, as `setScheme` does, and keeps
 * `aria-pressed` in step). Without the script the page follows the system scheme.
 *
 * @useWhen a content page needs the reader's light or dark choice
 * @neverWhen the app already runs `BasaltProvider` (use the shell's own switch)
 *
 * @example
 * <ThemeSwitch label="Color scheme" labels={{ light: 'Light', dark: 'Dark', auto: 'System' }} />
 */
export function ThemeSwitch({ label, labels, className }: ThemeSwitchProps): ReactElement {
  return (
    <fieldset
      data-slot="theme-switch"
      className={cn('inline-flex items-center gap-0.5 rounded-ctrl bg-inset p-0.5', className)}
    >
      <legend className="sr-only">{label}</legend>
      {OPTIONS.map(({ scheme, glyph }) => (
        <button
          key={scheme}
          type="button"
          data-basalt-scheme={scheme}
          aria-label={labels[scheme]}
          aria-pressed={scheme === 'auto'}
          className="focus-ring inline-flex size-7 items-center justify-center rounded-chip text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-raised"
        >
          <Glyph name={glyph} />
        </button>
      ))}
    </fieldset>
  )
}
