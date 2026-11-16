import { VX } from 'basalt-ui/tokens'

export const Panel = ({ body }: { body: string }) => (
  <div className="vx-prose" style={{ color: VX.ink, background: VX.surface.panel }}>
    <span style={{ borderColor: 'var(--vx-accent)', outlineColor: 'var(--vx-ink-muted)' }}>
      {body}
    </span>
  </div>
)
