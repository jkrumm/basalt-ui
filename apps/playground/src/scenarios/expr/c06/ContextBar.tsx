import { Box, Group, Skeleton, Text, UnstyledButton } from '@mantine/core'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { alpha, VX } from 'basalt-ui/tokens'
import { compact, percent } from 'basalt-ui/format'
import type { ContextCategory } from './data'

const fig = (n: number): string => compact(n, { digits: 1 })

/** Track height: the bar is the card's hero mark, so it is tall enough to read part sizes. */
const BAR_PX = 48
const GAP_PX = 2
// cycle-expression-1: no kit way to ask whether a label fits its segment, so a fixed share of the limit stands in for measuring.
/** A part this share of the limit or wider names itself on the bar; narrower ones go to the legend. */
const LABEL_MIN_SHARE = 0.2
const TICK_LABEL_PX = 16
const LEGEND_GAP_PX = 14

// cycle-expression-1: no categorical series pair for a neutral one-family ramp, so strengths of the accent fill are picked by hand, with the label ink switched by strength.
/** Accent-family strengths by rank, so the parts read as one family and no hue claims a status. */
const STRENGTH = [1, 0.4, 0.22]
const FILL_SOLID_AT = 0.9

type Part = ContextCategory & { start: number; share: number; fill: string; ink: string }

/**
 * cycle-expression-1: the shipped `Meter` draws a 4 px track, has no on-segment labels, no
 * hover/focus behaviour, no roving focus and `lining-nums` captions, so the whole bar (geometry,
 * focus ring, key handling, readout) is hand-written here from Mantine primitives and `VX.*`.
 */
export function ContextBar({
  categories,
  limit,
  warnAt,
  warnLabel,
  label,
  activeKey,
  onActive,
  loading,
}: {
  categories: readonly ContextCategory[]
  limit: number
  warnAt: number
  warnLabel: string
  label: string
  activeKey: string | undefined
  onActive: (key: string | undefined) => void
  loading: boolean
}): ReactElement {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const used = categories.reduce((sum, c) => sum + c.tokens, 0)
  const ranked = categories.toSorted((a, b) => b.tokens - a.tokens).map((c) => c.key)
  const parts: Part[] = categories.map((c, i) => {
    const strength = STRENGTH[Math.min(ranked.indexOf(c.key), STRENGTH.length - 1)] ?? 0.2
    const part: Part = {
      ...c,
      start: categories.slice(0, i).reduce((sum, o) => sum + o.tokens, 0),
      share: c.tokens / limit,
      fill: alpha(VX.accentFill, strength),
      ink: strength >= FILL_SOLID_AT ? VX.onAccent : VX.ink,
    }
    return part
  })
  const stops = parts.filter((p) => p.tokens > 0)
  const [tabKey, setTabKey] = useState(stops[0]?.key)
  const [focused, setFocused] = useState<string | undefined>(undefined)
  const pastShare = Math.max(0, used - warnAt) / limit

  const step = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = stops.length - 1
    const target =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(index + 1, last)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(index - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : undefined
    const next = target === undefined ? undefined : stops[target]
    if (next === undefined) return
    e.preventDefault()
    refs.current.get(next.key)?.focus()
  }

  if (loading) {
    return (
      <Box aria-hidden>
        <Skeleton h={TICK_LABEL_PX} w="40%" ml="auto" mr="20%" mb={6} />
        <Skeleton h={BAR_PX} />
        <Skeleton h={TICK_LABEL_PX} w="70%" mt={LEGEND_GAP_PX} />
      </Box>
    )
  }

  const dim = (key: string): number => (activeKey === undefined || activeKey === key ? 1 : 0.4)

  return (
    <Box role="group" aria-label={label}>
      <Box pos="relative" h={TICK_LABEL_PX} mb={6}>
        <Text
          fz="xs"
          c="dimmed"
          pos="absolute"
          top={0}
          left={0}
          ta="right"
          pr="xs"
          style={{ width: `${(warnAt / limit) * 100}%`, whiteSpace: 'nowrap' }}
        >
          {warnLabel}
        </Text>
      </Box>
      <Box pos="relative" h={BAR_PX} bg={VX.surface.field} style={{ borderRadius: VX.radiusCtrl }}>
        {stops.map((p, i) => {
          const labelled = p.share >= LABEL_MIN_SHARE
          return (
            <UnstyledButton
              key={p.key}
              ref={(el: HTMLButtonElement | null) => {
                if (el === null) refs.current.delete(p.key)
                else refs.current.set(p.key, el)
              }}
              className="mantine-focus-auto"
              px="xs"
              tabIndex={p.key === tabKey ? 0 : -1}
              aria-label={`${p.label}, ${fig(p.tokens)} tokens, ${percent(p.tokens / used)} of what is loaded, ${percent(p.share)} of the window`}
              onKeyDown={(e) => step(e, i)}
              onFocus={() => {
                setTabKey(p.key)
                setFocused(p.key)
                onActive(p.key)
              }}
              onBlur={() => {
                setFocused(undefined)
                onActive(undefined)
              }}
              onPointerEnter={() => onActive(p.key)}
              onPointerLeave={() => onActive(focused)}
              style={{
                position: 'absolute',
                top: 0,
                height: BAR_PX,
                left: `${(p.start / limit) * 100}%`,
                width: `calc(${p.share * 100}% - ${GAP_PX}px)`,
                background: p.fill,
                color: p.ink,
                borderRadius: VX.radiusCtrl,
                opacity: dim(p.key),
                textAlign: 'left',
                overflow: 'hidden',
              }}
            >
              {labelled && (
                <>
                  <Text fz="xs" inherit style={{ display: 'block', whiteSpace: 'nowrap' }} truncate>
                    {p.label}
                  </Text>
                  <Text
                    fz="sm"
                    fw={500}
                    inherit
                    style={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fig(p.tokens)}
                  </Text>
                </>
              )}
            </UnstyledButton>
          )
        })}
        {/* The compact line: a rule through the bar at the threshold. */}
        <Box
          aria-hidden
          pos="absolute"
          w={2}
          bg={VX.ink}
          style={{ left: `calc(${(warnAt / limit) * 100}% - 1px)`, top: -4, bottom: -4 }}
        />
        {/* The part of the fill past the line: the one status hue on the bar. */}
        {pastShare > 0 && (
          <Box
            aria-hidden
            pos="absolute"
            h={4}
            bg={VX.status.warn}
            style={{
              left: `${(warnAt / limit) * 100}%`,
              width: `${pastShare * 100}%`,
              top: BAR_PX + 4,
              borderRadius: VX.radiusCtrl,
            }}
          />
        )}
      </Box>
      <Group gap="md" mt={LEGEND_GAP_PX} wrap="wrap">
        {parts
          .filter((p) => p.tokens === 0 || p.share < LABEL_MIN_SHARE)
          .map((p) => (
            <Group
              key={p.key}
              gap={6}
              wrap="nowrap"
              opacity={dim(p.key)}
              aria-hidden={p.tokens > 0 ? true : undefined}
              onPointerEnter={() => onActive(p.key)}
              onPointerLeave={() => onActive(focused)}
            >
              <Box
                w={10}
                h={10}
                style={{
                  borderRadius: VX.radiusPill,
                  background: p.tokens > 0 ? p.fill : 'transparent',
                  border: p.tokens > 0 ? undefined : `1px solid ${VX.faint}`,
                }}
              />
              <Text fz="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {p.label} {fig(p.tokens)}
              </Text>
            </Group>
          ))}
      </Group>
    </Box>
  )
}
