/**
 * ArticleFilterBar — a fully controlled, dumb filter bar over an article list's category and tags
 * axes (docs/CONTENT-SPEC.md). It owns no state, no store, no URL knowledge — the store lives in
 * `basalt-ui/router-tanstack` (`createSearchParamStore`/`createMultiSearchParamStore`, headless,
 * Mantine-free); this is the Mantine half. Wire it to that pair per `createSearchParamStore`'s
 * 5-step JSDoc recipe (the filter is its step 3).
 *
 * Category renders as a `SegmentedControl` (DESIGN-SPEC §5); below the `sm` breakpoint it swaps to
 * a `Select` via Mantine's CSS-based `visibleFrom`/`hiddenFrom` props (not `useMediaQuery` — a JS
 * media query renders differently on server vs client and would trip a hydration mismatch, the
 * same hazard `formatArticleDate` is careful to avoid). Tags render as a `Chip.Group` — Chips wrap
 * natively and need no responsive fallback. The tag row is omitted entirely when `tags` is
 * absent/empty.
 *
 * @example
 * <ArticleFilterBar
 *   categories={[{ value: 'all', label: 'All' }, { value: 'guide', label: 'Guide' }]}
 *   category={category}
 *   onCategoryChange={setCategory}
 *   tags={ARTICLE_TAGS}
 *   selectedTags={tags}
 *   onTagsChange={setTags}
 * />
 */
import type { CSSProperties } from 'react'
import { Chip, Group, SegmentedControl, Select, Stack } from '@mantine/core'

export type ArticleFilterBarProps = {
  readonly categories: readonly { readonly value: string; readonly label: string }[]
  readonly category: string
  readonly onCategoryChange: (next: string) => void
  readonly tags?: readonly string[]
  readonly selectedTags?: readonly string[]
  readonly onTagsChange?: (next: string[]) => void
  readonly className?: string
  readonly style?: CSSProperties
}

export function ArticleFilterBar({
  categories,
  category,
  onCategoryChange,
  tags,
  selectedTags,
  onTagsChange,
  className,
  style,
}: ArticleFilterBarProps) {
  const categoryData = categories.map(({ value, label }) => ({ value, label }))
  const hasTags = tags !== undefined && tags.length > 0

  return (
    <Stack
      gap="sm"
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      <SegmentedControl
        visibleFrom="sm"
        data={categoryData}
        value={category}
        onChange={onCategoryChange}
      />
      <Select
        hiddenFrom="sm"
        data={categoryData}
        value={category}
        allowDeselect={false}
        onChange={(next) => next !== null && onCategoryChange(next)}
      />
      {hasTags && (
        <Chip.Group
          multiple
          value={selectedTags !== undefined ? [...selectedTags] : []}
          onChange={(next) => onTagsChange?.(next)}
        >
          <Group gap="xs" wrap="wrap">
            {tags?.map((tag) => (
              <Chip key={tag} value={tag}>
                {tag}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}
    </Stack>
  )
}
