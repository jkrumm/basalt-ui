// The embedded provider plus `ShortcutsHelp`, the one `./commands` export a define-free app reads
// without registering anything. It must not drag Spotlight, modals or hotkeys into the graph.
import { BasaltProvider } from 'basalt-ui'
import { ShortcutsHelp } from 'basalt-ui/commands'

export function App() {
  return (
    <BasaltProvider spotlight={false}>
      <ShortcutsHelp />
    </BasaltProvider>
  )
}
