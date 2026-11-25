/**
 * The auth layout: one narrow column outside the shell. `PageBar` names the page (the visible h1 where
 * there is no shell), the card holds the form, and the line under it links to the other page.
 */
import { Page, PageBar } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import type { ReactElement, ReactNode } from 'react'

export function AuthLayout({
  title,
  area,
  children,
  below,
}: {
  title: string
  area: string
  children: ReactNode
  below: ReactNode
}): ReactElement {
  return (
    <Page landmark area={area}>
      <div className="flex justify-center">
        <div className="flex w-full max-w-sm flex-col gap-4 pt-12">
          <span className="text-sm font-medium text-foreground">Basalt</span>
          <PageBar title={title} />
          <Card>{children}</Card>
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            {below}
          </div>
        </div>
      </div>
    </Page>
  )
}
