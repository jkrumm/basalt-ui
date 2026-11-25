import { useId, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  DENSITIES,
  FRAMES,
  appearanceSnapshot,
  resetAppearance,
  serverAppearance,
  setAppearance,
  subscribeAppearance,
} from '../core/appearance'
import type {
  AccentName,
  AppearanceDensity,
  AppearanceFrame,
  AppearanceState,
} from '../core/appearance'
import { cn } from '../core/cn'
import { controls as controlsMessages } from '../core/messages/controls'
import { useMessages } from '../core/messages/use-messages'
import { setScheme } from '../core/scheme'
import type { Scheme } from '../core/scheme'
import { Button } from '../ui/button'
import { RadioGroup } from '../ui/radio-group'
import { SwatchPicker } from '../ui/swatch-picker'
import type { SwatchToken } from '../ui/swatch-picker'

/**
 * What `<html>` wears now: the scheme (`auto` when none is chosen) and the density, frame and accent
 * the reader chose (absent: the app's default). It follows every writer: `setAppearance`,
 * `setScheme`, the boot script and another tab. The server renders nothing chosen.
 *
 * @useWhen a part reads the reader's appearance (a chart that thins its marks when comfortable, a summary line)
 * @neverWhen the value only styles: CSS reads the attribute itself (`[data-density='normal'] &`)
 *
 * @example
 * const { scheme, accent } = useAppearance()
 */
export function useAppearance(): AppearanceState {
  return useSyncExternalStore(subscribeAppearance, appearanceSnapshot, serverAppearance)
}

/** A row of the switcher; `frame` reaches only an `AppShell`. */
export type AppearanceRow = 'scheme' | 'accent' | 'density' | 'frame'

export type AppearanceSwitcherProps = {
  /**
   * The accents this app ships (`basalt-ui tokens:css --accents`), its base accent first: picking the
   * first clears `data-accent`. Fewer than two hide the accent row. Default: none.
   */
  accents?: readonly AccentName[]
  /** The rows to show, in this order. Default all four. */
  rows?: readonly AppearanceRow[]
  /** The `frame` the app's `AppShell` takes, shown while the reader chose none. Default `panel`. */
  defaultFrame?: AppearanceFrame
  /** Layout only (`w-full`, `max-w-md`). */
  className?: string
}

const ROWS: readonly AppearanceRow[] = ['scheme', 'accent', 'density', 'frame']

/** Each option's message keys, written out so every key is one literal reference. */
const DENSITY_COPY = {
  dense: ['controls.appearance.dense', 'controls.appearance.denseHelp'],
  normal: ['controls.appearance.normal', 'controls.appearance.normalHelp'],
  comfortable: ['controls.appearance.comfortable', 'controls.appearance.comfortableHelp'],
} as const satisfies Record<AppearanceDensity, readonly [string, string]>

const FRAME_COPY = {
  panel: ['controls.appearance.panel', 'controls.appearance.panelHelp'],
  flush: ['controls.appearance.flush', 'controls.appearance.flushHelp'],
} as const satisfies Record<AppearanceFrame, readonly [string, string]>
const SCHEMES: readonly Scheme[] = ['light', 'dark', 'auto']

/** A frame's miniature: the rail on the frame's ground and the work surface, inset or flush. */
function FramePreview({ frame }: { frame: AppearanceFrame }): ReactElement {
  return (
    <span className="flex aspect-[120/56] w-full bg-background">
      <span className="flex w-1/5 flex-col gap-1 p-1.5">
        <span className="h-1 rounded-full bg-muted-foreground/40" />
        <span className="h-1 rounded-full bg-muted-foreground/25" />
        <span className="h-1 rounded-full bg-muted-foreground/25" />
      </span>
      <span
        className={cn(
          'flex flex-1 flex-col gap-1 bg-card p-2',
          frame === 'panel'
            ? 'my-1.5 me-1.5 rounded-ctrl ring-1 ring-border'
            : 'border-s border-border',
        )}
      >
        <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/40" />
        <span className="h-1 w-full rounded-full bg-muted-foreground/20" />
        <span className="h-1 w-full rounded-full bg-muted-foreground/20" />
      </span>
    </span>
  )
}

const DENSITY_LINES: Record<AppearanceDensity, string> = {
  dense: 'gap-0.5 [&>span]:h-1.5',
  normal: 'gap-1 [&>span]:h-2',
  comfortable: 'gap-1.5 [&>span]:h-2.5',
}

/** A density's miniature: four rows at its height and gap. */
function DensityPreview({ density }: { density: AppearanceDensity }): ReactElement {
  return (
    <span
      className={cn(
        'flex aspect-[120/56] w-full flex-col justify-center bg-background px-3',
        DENSITY_LINES[density],
      )}
    >
      <span className="rounded-chip bg-muted-foreground/25" />
      <span className="rounded-chip bg-muted-foreground/25" />
      <span className="rounded-chip bg-muted-foreground/25" />
      <span className="rounded-chip bg-muted-foreground/25" />
    </span>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: (id: string) => ReactNode
}): ReactElement {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-medium text-foreground">
        {label}
      </span>
      {children(id)}
    </div>
  )
}

/**
 * The reader's appearance in one part: theme, accent color, density and layout, each applied to
 * `<html>` the moment it is picked and kept across reloads (`setScheme`, `setAppearance`), with a
 * reset that returns every row to the app's default. Theme, density and layout are choice tiles,
 * the accent a swatch row. It keys on its container, so it fits a settings row and a popover alike:
 * 18 rem wide where its parent sizes to its content (a menu submenu), never wider than its parent.
 *
 * @useWhen a settings page or a header popover lets the reader pick theme, accent, density or layout
 * @neverWhen the app offers only light and dark (a three-way switch is enough), or on a content site (`ThemeSwitch`)
 * @example
 * <AppearanceSwitcher accents={['blue', 'violet', 'teal']} />
 */
export function AppearanceSwitcher({
  accents = [],
  rows = ROWS,
  defaultFrame = 'panel',
  className,
}: AppearanceSwitcherProps): ReactElement {
  const t = useMessages(controlsMessages)
  const state = useAppearance()
  const base = accents[0]
  const chosen =
    state.scheme !== 'auto' ||
    state.density !== undefined ||
    state.frame !== undefined ||
    state.accent !== undefined

  const row = (name: AppearanceRow): ReactNode => {
    switch (name) {
      case 'scheme':
        return (
          <Row key={name} label={t('controls.appearance.scheme')}>
            {(id) => (
              <RadioGroup<Scheme>
                aria-labelledby={id}
                variant="tile"
                value={state.scheme}
                onValueChange={(value) => setScheme(value)}
                options={SCHEMES.map((scheme) => ({
                  value: scheme,
                  label: t(
                    scheme === 'auto'
                      ? 'controls.appearance.system'
                      : scheme === 'light'
                        ? 'controls.appearance.light'
                        : 'controls.appearance.dark',
                  ),
                }))}
              />
            )}
          </Row>
        )
      case 'accent':
        if (base === undefined || accents.length < 2) return null
        return (
          <Row key={name} label={t('controls.appearance.accent')}>
            {(id) => (
              <SwatchPicker
                aria-labelledby={id}
                className="grid-cols-6"
                value={`accent-${state.accent ?? base}` as SwatchToken}
                onValueChange={(value) => {
                  const accent = value.slice('accent-'.length) as AccentName
                  setAppearance({ accent: accent === base ? null : accent })
                }}
                options={accents.map((accent) => ({
                  value: `accent-${accent}` as SwatchToken,
                  label: t('controls.appearance.accentName', accent),
                }))}
              />
            )}
          </Row>
        )
      case 'density':
        return (
          <Row key={name} label={t('controls.appearance.density')}>
            {(id) => (
              <RadioGroup<AppearanceDensity>
                aria-labelledby={id}
                variant="tile"
                value={state.density ?? 'dense'}
                onValueChange={(density) =>
                  setAppearance({ density: density === 'dense' ? null : density })
                }
                options={DENSITIES.map((density) => ({
                  value: density,
                  label: t(DENSITY_COPY[density][0]),
                  description: t(DENSITY_COPY[density][1]),
                  preview: <DensityPreview density={density} />,
                }))}
              />
            )}
          </Row>
        )
      case 'frame':
        return (
          <Row key={name} label={t('controls.appearance.frame')}>
            {(id) => (
              <RadioGroup<AppearanceFrame>
                aria-labelledby={id}
                variant="tile"
                value={state.frame ?? defaultFrame}
                onValueChange={(frame) => setAppearance({ frame })}
                options={FRAMES.map((frame) => ({
                  value: frame,
                  label: t(FRAME_COPY[frame][0]),
                  description: t(FRAME_COPY[frame][1]),
                  preview: <FramePreview frame={frame} />,
                }))}
              />
            )}
          </Row>
        )
    }
  }

  return (
    <div
      data-slot="appearance-switcher"
      className={cn('@container flex w-72 min-w-0 max-w-full flex-col gap-5', className)}
    >
      {rows.map(row)}
      <div>
        <Button
          variant="secondary"
          disabled={!chosen}
          onClick={() => {
            setScheme('auto')
            resetAppearance()
          }}
        >
          {t('controls.appearance.reset')}
        </Button>
      </div>
    </div>
  )
}
