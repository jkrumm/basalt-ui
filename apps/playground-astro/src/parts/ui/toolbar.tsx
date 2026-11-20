import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from 'basalt-ui/ui/toolbar'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Toolbar aria-label="Run viewer" className="max-w-xl">
      <ToolbarGroup aria-label="Zoom">
        <ToolbarButton>Zoom in</ToolbarButton>
        <ToolbarButton>Zoom out</ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup aria-label="View">
        <ToolbarButton variant="primary">Map</ToolbarButton>
        <ToolbarButton>Elevation</ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarButton>Export</ToolbarButton>
    </Toolbar>
  )
}
