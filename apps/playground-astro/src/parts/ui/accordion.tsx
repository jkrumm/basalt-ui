import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'basalt-ui/ui/accordion'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Accordion className="max-w-md" defaultValue={['shipping']}>
      <AccordionItem value="shipping">
        <AccordionTrigger>Shipping</AccordionTrigger>
        <AccordionContent>Orders leave the warehouse within one working day.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>Returns</AccordionTrigger>
        <AccordionContent>Unused items can be returned within 30 days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="warranty">
        <AccordionTrigger>Warranty</AccordionTrigger>
        <AccordionContent>Two years on parts and labour.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
