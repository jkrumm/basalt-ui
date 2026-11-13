/**
 * `catalog.Block`: validate, then render inside a per-block error boundary. The phase reaches the
 * composite the block's `render` returns as its root (a `StatCard`, a `DataPanel`), so a loading or
 * failed block draws that composite's own skeleton or error arm at its final height. While loading,
 * a spec still streaming in borrows the block's first `sample` for the skeleton's shape. A spec the
 * validator refused, or a render that threw, prints one quiet line and reports through `onEvent`;
 * the blocks around it keep rendering.
 */
import { cloneElement, Fragment, isValidElement, useEffect } from 'react'
import type { FC, ReactElement, ReactNode } from 'react'
import { ai } from '../../core/messages/ai'
import { useMessages } from '../../core/messages/use-messages'
import { PhaseBoundary } from '../../core/phase-boundary'
import type { Box, Phase } from '../../core/ports'
import { Skeleton } from '../../ui/skeleton'
import type { Block, BlockComponentProps, BlockEvent } from '../contract'
import { check } from './validate'

const tagOf = (phase: Phase): string => (typeof phase === 'string' ? phase : phase.tag)

/** The composite at the root of a render takes `phase`; a DOM node or a fragment does not. */
function withPhase(node: ReactNode, phase: Phase): ReactNode | null {
  if (!isValidElement<{ phase?: Phase }>(node)) return null
  if (typeof node.type === 'string' || node.type === Fragment) return null
  if (node.props.phase !== undefined) return node
  return cloneElement(node, { phase })
}

function Unavailable({
  event,
  onEvent,
}: {
  event: BlockEvent
  onEvent?: ((e: BlockEvent) => void) | undefined
}): ReactElement {
  const t = useMessages(ai)
  const { block, type, payload } = event
  useEffect(() => {
    onEvent?.({ block, type, payload })
  }, [block, type, payload, onEvent])
  return (
    <div
      data-slot="ai-block"
      data-block={event.block}
      data-state="unavailable"
      className="text-xs text-muted-foreground"
    >
      {t('ai.blockUnavailable')}
    </div>
  )
}

function Placeholder({ height }: { height?: number }): ReactElement {
  return height === undefined ? (
    <Skeleton className="h-24 w-full" />
  ) : (
    <Skeleton className="w-full" style={{ height }} />
  )
}

function Rendered({ def, props, phase }: { def: Block; props: unknown; phase: Phase }): ReactNode {
  const ready = phase === 'ready' || phase === 'stale'
  if (!ready && def.reserve !== undefined) return <Placeholder height={def.reserve} />
  const box: Box = { height: def.reserve ?? 'fill', phase: phase === 'stale' ? 'stale' : 'ready' }
  const node = def.render(props, box)
  const phased = withPhase(node, phase)
  if (phased !== null) return phased
  return ready ? node : <Placeholder />
}

/** What to draw: the validated props, or while pending the block's first sample as the shape. */
function target(
  checked: ReturnType<typeof check>,
  pending: boolean,
): { block: Block; props: unknown } | null {
  if (checked.ok) return { block: checked.def, props: checked.block.props }
  if (pending && checked.def !== undefined)
    return { block: checked.def, props: checked.def.sample[0] }
  return null
}

export function createBlockView(byName: ReadonlyMap<string, Block>): FC<BlockComponentProps> {
  function CatalogBlock({ spec, phase, onEvent }: BlockComponentProps): ReactElement {
    const checked = check(spec, byName)
    const pending = phase !== 'ready' && phase !== 'stale'
    const drawn = target(checked, pending)
    if (drawn === null) {
      if (pending || checked.ok) return <Placeholder />
      const event = {
        block: checked.def?.name ?? 'unknown',
        type: 'invalid',
        payload: checked.error,
      }
      return <Unavailable event={event} onEvent={onEvent} />
    }
    const { block, props } = drawn
    return (
      <div data-slot="ai-block" data-block={block.name} data-phase={tagOf(phase)}>
        <PhaseBoundary
          key={checked.text ?? ''}
          fallback={({ error }) => (
            <Unavailable
              event={{
                block: block.name,
                type: 'error',
                payload: error instanceof Error ? error.message : String(error),
              }}
              onEvent={onEvent}
            />
          )}
        >
          <Rendered def={block} props={props} phase={phase} />
        </PhaseBoundary>
      </div>
    )
  }
  return CatalogBlock
}
