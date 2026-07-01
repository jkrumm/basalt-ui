/**
 * ThemeToggle — a compact tri-state (light / dark / system) color-scheme control.
 *
 * A plain click cycles light → dark → system → light via `setColorScheme` (Mantine's own
 * `toggleColorScheme` only flips light/dark, so the cycle is hand-rolled here). Hovering (or
 * focusing, for keyboard users) reveals a small popover with the same three options directly
 * selectable — cycling and direct-select share one state, so they can never drift.
 *
 * The glyph is a single animated sun/moon (never a third "computer" icon) reflecting the
 * *resolved* appearance (`useComputedColorScheme`); a subtle dashed ring appears around it only
 * while `colorScheme === 'auto'`, signalling "following the OS" without a distinct icon. Animated
 * via `motion` (see `../motion` for the shared duration/spring tokens); collapses to an instant,
 * unanimated swap when `useReducedMotion` reports a preference for reduced motion.
 */
import {
  ActionIcon,
  Popover,
  SegmentedControl,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { MOTION_SPRING } from '../motion'

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

/** The animated sun/moon glyph — crossfades + rotates between the two on scheme change. */
function SchemeGlyph({ dark, reduceMotion }: { dark: boolean; reduceMotion: boolean }) {
  if (reduceMotion) {
    return <span style={{ display: 'inline-flex' }}>{dark ? <MoonGlyph /> : <SunGlyph />}</span>
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      {dark ? (
        <motion.span
          key="moon"
          style={{ display: 'inline-flex' }}
          initial={{ opacity: 0, scale: 0.6, rotate: 30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.6, rotate: -30 }}
          transition={MOTION_SPRING}
        >
          <MoonGlyph />
        </motion.span>
      ) : (
        <motion.span
          key="sun"
          style={{ display: 'inline-flex' }}
          initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
          transition={MOTION_SPRING}
        >
          <SunGlyph />
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function RingGlyph() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 26 26"
      aria-hidden
      style={{ position: 'absolute', inset: -4, pointerEvents: 'none' }}
    >
      <circle
        cx={13}
        cy={13}
        r={11}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.5}
      />
    </svg>
  )
}

/** Dashed ring that appears only in system mode — "following the OS", not a distinct icon. */
function AutoRing({ visible, reduceMotion }: { visible: boolean; reduceMotion: boolean }) {
  if (reduceMotion) return visible ? <RingGlyph /> : null
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="auto-ring"
          style={{ position: 'absolute', inset: 0 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={MOTION_SPRING}
        >
          <RingGlyph />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export type ThemeToggleProps = {
  /** Delay (ms) before the direct-select popover opens on hover/focus. Default 150. */
  openDelay?: number
  /** Delay (ms) before it closes after the pointer/focus leaves. Default 200. */
  closeDelay?: number
}

/** Cycles `colorScheme` forward through light → dark → system → light. */
function nextScheme(current: Scheme): Scheme {
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]!
}

export function ThemeToggle({ openDelay = 150, closeDelay = 200 }: ThemeToggleProps = {}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const resolved = useComputedColorScheme('dark')
  const reduceMotion = useReducedMotion()
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
  const auto = colorScheme === 'auto'

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
        <Tooltip label={auto ? `System (${dark ? 'dark' : 'light'})` : LABEL[resolved]} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Theme: ${LABEL[colorScheme]}. Click to cycle, hover to pick directly.`}
            onClick={() => setColorScheme(nextScheme(colorScheme))}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
            onFocus={scheduleOpen}
            onBlur={scheduleClose}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <SchemeGlyph dark={dark} reduceMotion={reduceMotion} />
              <AutoRing visible={auto} reduceMotion={reduceMotion} />
            </span>
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p={4} onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
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
