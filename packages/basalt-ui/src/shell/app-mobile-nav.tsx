/**
 * Mobile bottom tab bar for the primary nav groups. Rendered inside an `AppShell.Footer`
 * (`hiddenFrom="sm"`, height collapsed to 0 on desktop) so it only appears below the navbar
 * breakpoint. One tab per group plus a trailing "More" opener; tapping a group tab raises a
 * bottom sheet listing that group's destinations as large tap rows. Active state is a neutral
 * fill, never the identity blue ("ink earns its color", DESIGN.md).
 *
 * Router-agnostic: each row renders through `renderNavLink` when supplied (the consumer's router
 * `Link`), else a plain `<a href>` + `item.onClick`. Active state arrives as `item.active`.
 * Grounded verbatim in argo `apps/dashboard/src/components/app-shell/app-mobile-nav.tsx`.
 */
import { Box, Drawer, NavLink, Stack, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import classes from './app-mobile-nav.module.css'

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

/** Renders a single sheet row. The consumer's router `Link` lives here; `active` is precomputed. */
export type MobileNavLinkRenderer = (item: MobileNavItem, opts: { active: boolean }) => ReactNode

/** Inline "More" glyph — keeps the shell icon-dependency-free. */
function IconMore() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  )
}

export function MobileNav({
  sections,
  onOpenMore,
  renderNavLink,
}: {
  sections: MobileNavSection[]
  onOpenMore: () => void
  renderNavLink?: MobileNavLinkRenderer
}) {
  // The open group sheet; null = closed. A single Drawer is reused across all groups.
  const [openSection, setOpenSection] = useState<MobileNavSection | null>(null)

  return (
    <>
      <nav className={classes.bar}>
        {sections.map((section) => (
          <UnstyledButton
            key={section.key}
            onClick={() => setOpenSection(section)}
            className={classes.tab}
            data-active={section.active || undefined}
            aria-current={section.active ? 'page' : undefined}
            aria-label={section.label}
          >
            {section.icon}
            <Text className={classes.label}>{section.label}</Text>
          </UnstyledButton>
        ))}
        <UnstyledButton onClick={onOpenMore} className={classes.tab} aria-label="More">
          <IconMore />
          <Text className={classes.label}>More</Text>
        </UnstyledButton>
      </nav>

      <Drawer
        opened={openSection !== null}
        onClose={() => setOpenSection(null)}
        position="bottom"
        size="auto"
        padding="md"
        title={openSection?.label}
        classNames={{ content: classes.sheet }}
      >
        <Stack gap={2}>
          {openSection?.items.map((item) => {
            const handleClick = (e: MouseEvent) => {
              item.onClick?.(e)
              setOpenSection(null)
            }
            const active = Boolean(item.active)

            if (renderNavLink) {
              return (
                <Box key={item.key} onClick={() => setOpenSection(null)}>
                  {renderNavLink(item, { active })}
                </Box>
              )
            }

            // Items with an href stay anchors so the consumer's router can preload them.
            return item.href ? (
              <NavLink
                key={item.key}
                classNames={{ root: classes.row }}
                component="a"
                href={item.href}
                label={item.label}
                leftSection={item.icon}
                active={active}
                onClick={handleClick}
              />
            ) : (
              <UnstyledButton
                key={item.key}
                onClick={handleClick}
                className={classes.row}
                data-active={active || undefined}
              >
                {item.icon}
                <Text className={classes.rowLabel}>{item.label}</Text>
              </UnstyledButton>
            )
          })}
        </Stack>
      </Drawer>
    </>
  )
}
