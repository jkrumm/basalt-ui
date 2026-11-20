import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'basalt-ui/ui/resizable'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <ResizablePanelGroup className="h-64 max-w-2xl border">
      <ResizablePanel defaultSize={35} minSize={20}>
        <div className="p-3 text-sm">Runs, 12</div>
      </ResizablePanel>
      <ResizableHandle grip />
      <ResizablePanel defaultSize={65}>
        <div className="p-3 text-sm">Morning run, 12.4 km</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
