import { BASALT } from 'basalt-ui/tokens'

export const Panel = ({ body }: { body: string }) => (
  <div className="basalt-prose" style={{ color: BASALT.ink, background: BASALT.card }}>
    <span style={{ borderColor: 'var(--basalt-brand)', outlineColor: 'var(--basalt-ink-muted)' }}>
      {body}
    </span>
  </div>
)
