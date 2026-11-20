import { Tabs, TabsContent, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Tabs defaultValue="splits" className="max-w-xl">
      <TabsList aria-label="Run detail">
        <TabsTrigger value="splits">Splits</TabsTrigger>
        <TabsTrigger value="laps">Laps</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="splits">
        <p className="m-0 text-sm">Kilometre splits: 5:12, 5:08, 5:15, 5:04.</p>
      </TabsContent>
      <TabsContent value="laps">
        <p className="m-0 text-sm">Eight laps of 1.5 km, the fastest in the third.</p>
      </TabsContent>
      <TabsContent value="notes">
        <p className="m-0 text-sm">Cool, dry morning. Left knee tight after km 9.</p>
      </TabsContent>
    </Tabs>
  )
}
