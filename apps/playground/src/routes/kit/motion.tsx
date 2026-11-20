import { createFileRoute } from '@tanstack/react-router'
import { useMotionPreset } from 'basalt-ui/motion'
import { Page, Section } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Card } from 'basalt-ui/ui/card'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

/** The rows the item preset staggers, one per index. */
const ROWS = ['Ingest', 'Parse', 'Index', 'Render', 'Cache', 'Publish'] as const
/** The cards the card preset staggers. */
const CARDS = [0, 1, 2] as const

const LIST = 'm-0 flex list-none flex-col gap-2 p-0'

/** `shown` false removes the demo, so its exit runs under `AnimatePresence`. */
type DemoProps = { readonly shown: boolean }

function OverlayBox(): ReactElement {
  const enter = useMotionPreset('overlay')
  return (
    <motion.div {...enter}>
      <Card>Overlay layer</Card>
    </motion.div>
  )
}

function ItemRow({
  index,
  label,
}: {
  readonly index: number
  readonly label: string
}): ReactElement {
  const enter = useMotionPreset('item', { index })
  return (
    <motion.li {...enter}>
      <Card>{label}</Card>
    </motion.li>
  )
}

function CardTile({ index }: { readonly index: number }): ReactElement {
  const enter = useMotionPreset('card', { index })
  return (
    <motion.div {...enter}>
      <Card>Card {index + 1}</Card>
    </motion.div>
  )
}

function OverlayMotion({ shown }: DemoProps): ReactElement {
  return <AnimatePresence>{shown && <OverlayBox key="overlay" />}</AnimatePresence>
}

function ItemMotion({ shown }: DemoProps): ReactElement {
  return (
    <ul className={LIST}>
      <AnimatePresence>
        {shown && ROWS.map((label, index) => <ItemRow key={label} index={index} label={label} />)}
      </AnimatePresence>
    </ul>
  )
}

function CardMotion({ shown }: DemoProps): ReactElement {
  return (
    <div className="grid gap-2">
      <AnimatePresence>
        {shown && CARDS.map((index) => <CardTile key={index} index={index} />)}
      </AnimatePresence>
    </div>
  )
}

function OverlayCss({ shown }: DemoProps): ReactElement | null {
  if (!shown) return null
  return (
    <div className="animate-enter-overlay">
      <Card>Overlay layer</Card>
    </div>
  )
}

function ItemCss({ shown }: DemoProps): ReactElement {
  return (
    <ul className={LIST}>
      {shown &&
        ROWS.map((label, index) => (
          <li
            key={label}
            className="animate-enter-item stagger"
            style={{ '--i': index } as CSSProperties}
          >
            <Card>{label}</Card>
          </li>
        ))}
    </ul>
  )
}

function CardCss({ shown }: DemoProps): ReactElement {
  return (
    <div className="grid gap-2">
      {shown &&
        CARDS.map((index) => (
          <div key={index} className="animate-enter-card">
            <Card>Card {index + 1}</Card>
          </div>
        ))}
    </div>
  )
}

function Column({
  caption,
  children,
}: {
  readonly caption: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="m-0 text-xs text-muted-foreground">{caption}</p>
      {children}
    </div>
  )
}

type PresetSectionProps = {
  readonly title: string
  readonly summary: string
  readonly Demo: (props: DemoProps) => ReactElement
  readonly Css: (props: DemoProps) => ReactElement | null
}

/**
 * One preset: the React demo with reduced motion on and off, and the CSS twin. Replay remounts the
 * demos; Toggle removes them and adds them back so the exit runs.
 */
function PresetSection({ title, summary, Demo, Css }: PresetSectionProps): ReactElement {
  const [run, setRun] = useState(0)
  const [shown, setShown] = useState(true)
  return (
    <Section title={title} summary={summary}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setRun((n) => n + 1)
            setShown(true)
          }}
        >
          Replay
        </Button>
        <Button variant="ghost" onClick={() => setShown((s) => !s)}>
          Toggle
        </Button>
      </div>
      <div key={run} className="grid gap-4 @regular:grid-cols-3">
        <Column caption="Motion on">
          <MotionConfig reducedMotion="never">
            <Demo shown={shown} />
          </MotionConfig>
        </Column>
        <Column caption="Reduced motion">
          <MotionConfig reducedMotion="always">
            <Demo shown={shown} />
          </MotionConfig>
        </Column>
        <Column caption="CSS only, no exit">
          <Css shown={shown} />
        </Column>
      </div>
    </Section>
  )
}

function MotionRoute(): ReactElement {
  return (
    <Page area="kit-motion">
      <PresetSection
        title="Overlay"
        summary="Fades and scales in a layer you build yourself; basalt's own popover, menu and dialog already animate."
        Demo={OverlayMotion}
        Css={OverlayCss}
      />
      <PresetSection
        title="Item"
        summary="Fades and rises a list row; each row starts after the one above it."
        Demo={ItemMotion}
        Css={ItemCss}
      />
      <PresetSection
        title="Card"
        summary="Fades, rises and scales a card on the spring, one card after another."
        Demo={CardMotion}
        Css={CardCss}
      />
    </Page>
  )
}

export const Route = createFileRoute('/kit/motion')({
  staticData: { title: 'Motion' },
  component: MotionRoute,
})
