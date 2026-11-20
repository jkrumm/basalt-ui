import type { ReactElement } from 'react'
import { SiteTab, SiteTabs } from '../../../src/static'

/** Three tabs with one line each: what an MDX page hands the part. */
export function Parts(): ReactElement {
  return (
    <SiteTabs label="Install with" tabs={['bun', 'npm', 'pnpm']}>
      <SiteTab label="bun">bun add basalt-ui</SiteTab>
      <SiteTab label="npm">npm i basalt-ui</SiteTab>
      <SiteTab label="pnpm">pnpm add basalt-ui</SiteTab>
    </SiteTabs>
  )
}
