import { Button } from 'basalt-ui/ui/button'
import { CommandPalette, defineCommands } from 'basalt-ui/shell'
import type { ReactElement } from 'react'

const COMMANDS = defineCommands({
  'runs:new': { label: 'New run', group: 'Runs', run: () => undefined },
  'runs:filter': { label: 'Filter runs by status', group: 'Runs', run: () => undefined },
  'appearance:dark': { label: 'Switch to dark theme', group: 'Appearance', run: () => undefined },
})

export function Demo(): ReactElement {
  return (
    <div>
      <Button>Search commands</Button>
      <CommandPalette commands={COMMANDS} open={false} />
    </div>
  )
}
