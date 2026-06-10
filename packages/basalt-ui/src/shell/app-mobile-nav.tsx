/**
 * Mobile bottom tab bar for the primary nav groups. One tab per group plus a trailing "More"
 * opener; tapping a group tab raises a bottom sheet listing that group's destinations.
 *
 * Grounded in argo `apps/dashboard/src/components/app-shell/app-mobile-nav.tsx`: the
 * `MobileNavItem`/`MobileNavSection` types are carried verbatim. S0 renders the tab bar without the
 * bottom-sheet drawer; the full drawer interaction lands in S3.
 */
import { Text, UnstyledButton } from '@mantine/core'
import type { MouseEvent, ReactNode } from 'react'

export type MobileNavItem = {
  key: string
  label: string
  icon: ReactNode
  href?: string
  active?: boolean
  onClick?: (e: MouseEvent) => void
}

export type MobileNavSection = {
  key: string
  label: string
  icon: ReactNode
  active: boolean
  items: MobileNavItem[]
}

export function MobileNav({
  sections,
  onOpenMore,
}: {
  sections: MobileNavSection[]
  onOpenMore: () => void
}) {
  return (
    <nav>
      {sections.map((section) => (
        <UnstyledButton key={section.key} data-active={section.active || undefined}>
          {section.icon}
          <Text>{section.label}</Text>
        </UnstyledButton>
      ))}
      <UnstyledButton onClick={onOpenMore} aria-label="More">
        <Text>More</Text>
      </UnstyledButton>
    </nav>
  )
}
