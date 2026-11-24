/**
 * The playground's overlays, opened by key from anywhere: `OVERLAYS.open('deploy:steps', { deploy })`.
 * `<OverlayHost overlays={OVERLAYS} />` sits once in `routes/__root.tsx`; a key or a payload that is
 * not declared here does not compile.
 */
import { StepRail } from 'basalt-ui/cards'
import { defineOverlays } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { stepsOf } from './deploys'
import type { Deploy } from './deploys'

export const OVERLAYS = defineOverlays({
  'deploy:steps': {
    title: 'Deploy steps',
    as: 'sheet',
    render: ({ deploy }: { deploy: Deploy }) => (
      <StepRail label={`Steps of ${deploy.service} ${deploy.version}`} steps={stepsOf(deploy)} />
    ),
  },
  'deploy:rollback': {
    title: 'Roll back this deploy?',
    description: 'The previous version takes the traffic again; you can deploy this one later.',
    size: 'sm',
    render: ({ deploy }: { deploy: Deploy }, api) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={api.close}>
          Keep {deploy.version}
        </Button>
        <Button variant="danger" onClick={api.close}>
          Roll back {deploy.service}
        </Button>
      </div>
    ),
  },
})
