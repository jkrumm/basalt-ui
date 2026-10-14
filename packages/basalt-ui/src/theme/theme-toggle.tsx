/**
 * ThemeToggle — a compact tri-state (light / dark / system) color-scheme control.
 *
 * A plain click cycles light → dark → system → light via `setColorScheme` (Mantine's own
 * `toggleColorScheme` only flips light/dark, so the cycle is hand-rolled here). Hovering (or
 * focusing, for keyboard users) reveals a small popover with the same three options directly
 * selectable — cycling and direct-select share one state, so they can never drift.
 *
 * The glyph is a single animated sun/moon (never a third "computer" icon) reflecting the
 * *resolved* appearance (`useComputedColorScheme`) — no extra chrome for system mode; the tooltip
 * ("System (dark)") and the popover's selected option carry that state instead. Animated by a CSS
 * transition (`theme-toggle.module.css`), which drops to an instant swap under
 * `prefers-reduced-motion: reduce`.
 */
import {
  ActionIcon,
  Popover,
  SegmentedControl,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useRef, useState } from 'react'
import type { BasaltProps } from '../common/props'
import classes from './theme-toggle.module.css'

type Scheme = 'light' | 'dark' | 'auto'

const CYCLE: readonly Scheme[] = ['light', 'dark', 'auto']

const LABEL: Record<Scheme, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
}

function SunGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12h1M20 12h1M12 3v1M12 20v1M5.6 5.6l.7 .7M17.7 17.7l.7 .7M5.6 18.4l.7 -.7M17.7 6.3l.7 -.7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MoonGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The sun/moon glyph — both mounted, crossfaded and rotated by CSS on scheme change. */
function SchemeGlyph({ dark }: { dark: boolean }) {
  return (
    <span className={classes.glyph} data-dark={dark}>
      <span className={classes.sun}>
        <SunGlyph />
      </span>
      <span className={classes.moon}>
        <MoonGlyph />
      </span>
    </span>
  )
}

export type ThemeToggleProps = BasaltProps & {
  /** Delay (ms) before the direct-select popover opens on hover/focus. Default 150. */
  openDelay?: number
  /** Delay (ms) before it closes after the pointer/focus leaves. Default 200. */
  closeDelay?: number
}

/** Cycles `colorScheme` forward through light → dark → system → light. */
function nextScheme(current: Scheme): Scheme {
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]!
}

export function ThemeToggle({
  openDelay = 150,
  closeDelay = 200,
  className,
  style,
}: ThemeToggleProps = {}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const resolved = useComputedColorScheme('dark')
  const [opened, setOpened] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const scheduleOpen = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpened(true), openDelay)
  }
  const scheduleClose = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpened(false), closeDelay)
  }

  const dark = resolved === 'dark'

  return (
    <Popover
      opened={opened}
      onClose={() => setOpened(false)}
      position="bottom-end"
      withArrow
      shadow="md"
      trapFocus={false}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          {...(className !== undefined && { className })}
          style={{ borderRadius: 'var(--vx-radius-ctrl)', ...style }}
          aria-label={`Theme: ${LABEL[colorScheme]}. Click to cycle, hover to pick directly.`}
          onClick={() => setColorScheme(nextScheme(colorScheme))}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={scheduleOpen}
          onBlur={scheduleClose}
        >
          <SchemeGlyph dark={dark} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown
        p={4}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        <SegmentedControl
          size="xs"
          value={colorScheme}
          onChange={(value) => setColorScheme(value as Scheme)}
          data={[
            { label: LABEL.light, value: 'light' },
            { label: LABEL.dark, value: 'dark' },
            { label: LABEL.auto, value: 'auto' },
          ]}
        />
      </Popover.Dropdown>
    </Popover>
  )
}
