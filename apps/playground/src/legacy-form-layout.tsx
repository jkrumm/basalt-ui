/**
 * The 2.x `FormRow` and `FormGroup` call shape, kept for the two playground forms that still lay
 * out Mantine inputs through it. `basalt-ui/controls` now ships the v3 `FormField` and `FormRow`
 * (a different API); these forms move to them with the migration rows, and this file goes then.
 */
import { Box, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export function FormRow({
  label,
  hint,
  htmlFor,
  required,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <Stack gap="xs">
      <Text component="label" size="sm" fw={500} {...(htmlFor !== undefined && { htmlFor })}>
        {label}
        {required === true && <span aria-hidden="true"> *</span>}
      </Text>
      {hint !== undefined && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
      {children}
    </Stack>
  )
}

export function FormGroup({
  label,
  children,
}: {
  label: string
  section?: boolean
  children: ReactNode
}) {
  return (
    <Box component="fieldset" p={0} m={0} bd="0">
      <Text component="legend" fw={500} p={0}>
        {label}
      </Text>
      <Stack gap="md">{children}</Stack>
    </Box>
  )
}
