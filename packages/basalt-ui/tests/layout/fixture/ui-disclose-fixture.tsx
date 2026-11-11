import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../src/ui/accordion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../src/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../src/ui/tabs'
import './tailwind.generated.css'

const SECTIONS = ['Overview', 'Activity', 'Deployments', 'Members', 'Billing', 'Audit log']

/**
 * `ui/tabs`, `ui/accordion` and `ui/collapsible` probes, each in a `data-testid` box:
 * - `tabs-md` / `tabs-sm`: both sizes, the third trigger disabled (arrow keys still reach it);
 * - `tabs-many`: six triggers with long labels, the list must scroll inside itself at 320 px;
 * - `tabs-vertical`: the vertical orientation;
 * - `accordion-found`: `hiddenUntilFound`, closed panels stay in the DOM as `until-found`;
 * - `accordion-keep`: `keepMounted`, a typed value survives a close;
 * - `collapsible-found` / `collapsible-keep`: the same two on the single region.
 */
export function UiDiscloseFixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (full-width boxes on one page)
    <main className="flex flex-col gap-8 bg-background p-4 text-foreground">
      <h1 className="text-lg font-semibold">Disclosure primitives</h1>

      <section data-testid="tabs-md" aria-label="Tabs md">
        <Tabs defaultValue="overview">
          <TabsList aria-label="Account sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="billing" disabled>
              Billing
            </TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="activity">Activity panel</TabsContent>
          <TabsContent value="members">Members panel</TabsContent>
        </Tabs>
      </section>

      <section data-testid="tabs-sm" aria-label="Tabs sm">
        <Tabs size="sm" defaultValue="week">
          <TabsList aria-label="Range">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
          <TabsContent value="week">Week panel</TabsContent>
          <TabsContent value="month">Month panel</TabsContent>
          <TabsContent value="year">Year panel</TabsContent>
        </Tabs>
      </section>

      <section data-testid="tabs-many" aria-label="Tabs many">
        <Tabs defaultValue="Overview">
          <TabsList aria-label="Project sections">
            {SECTIONS.map((name) => (
              <TabsTrigger key={name} value={name}>
                {name} and everything related
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTIONS.map((name) => (
            <TabsContent key={name} value={name}>
              {name} panel
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section data-testid="tabs-vertical" aria-label="Tabs vertical">
        <Tabs orientation="vertical" defaultValue="general">
          <TabsList aria-label="Settings">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="general">General settings</TabsContent>
          <TabsContent value="security">Security settings</TabsContent>
        </Tabs>
      </section>

      <section data-testid="accordion-found" aria-label="Accordion found">
        <Accordion hiddenUntilFound>
          <AccordionItem value="shipping">
            <AccordionTrigger>Shipping</AccordionTrigger>
            <AccordionContent>
              Standard shipping takes three to five business days.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="returns">
            <AccordionTrigger>Returns</AccordionTrigger>
            <AccordionContent>A restocking fee of fifteen percent applies.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section data-testid="accordion-keep" aria-label="Accordion keep">
        <Accordion keepMounted defaultValue={['notes']}>
          <AccordionItem value="notes">
            <AccordionTrigger>Delivery notes</AccordionTrigger>
            <AccordionContent>
              <input
                aria-label="Gate code"
                defaultValue=""
                className="h-ctl w-full rounded-ctrl border border-input bg-background px-3 text-sm"
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section data-testid="collapsible-found" aria-label="Collapsible found">
        <Collapsible>
          <CollapsibleTrigger className="inline-flex min-h-row items-center px-2 text-sm font-medium">
            Advanced options
          </CollapsibleTrigger>
          <CollapsibleContent hiddenUntilFound>
            <p className="px-2 text-sm">Rotate the signing token every ninety days.</p>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section data-testid="collapsible-keep" aria-label="Collapsible keep">
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="inline-flex min-h-row items-center px-2 text-sm font-medium">
            Webhook secret
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted>
            <input
              aria-label="Secret"
              defaultValue=""
              className="h-ctl w-full rounded-ctrl border border-input bg-background px-3 text-sm"
            />
          </CollapsibleContent>
        </Collapsible>
      </section>
    </main>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<UiDiscloseFixture />)
