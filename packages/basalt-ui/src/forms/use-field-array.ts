/**
 * ./forms — useFieldArray: the list-field surface over Mantine's four list actions.
 * Mantine-coupled. Optional peer: @mantine/form.
 *
 * The gap (audit B §4): `insertListItem` / `removeListItem` / `reorderListItem` are all reachable
 * off the raw form object, but they are unexported by name, undocumented in the forms doctrine, and
 * each takes a different argument shape (`(path, item, index?)`, `(path, index)`,
 * `(path, { from, to })`). The list ALSO has to be read back out of the values by dotted path, and
 * every row needs `form.key(\`${path}.${i}\`)` or the uncontrolled reconciler reuses the wrong DOM
 * node when a row is removed from the middle — which is the defect this hook exists to make
 * unwritable.
 */
import type { FormArrayElement, LooseKeys, UseFormReturnType } from '@mantine/form'

export type UseFieldArrayReturn<Item> = {
  /** The live list. `[]` when the path holds nothing, so a call site never guards before mapping. */
  items: Item[]
  /** Push one item onto the end. */
  append: (value: Item) => void
  /** Drop the item at `index`. Mantine re-indexes the field errors with it. */
  remove: (index: number) => void
  /** Move one item, e.g. from a drag handle or a pair of arrow buttons. */
  move: (from: number, to: number) => void
  /**
   * Mantine's reconciler key for row `index` (`form.key('<path>.<index>')`) — pass it as the row's
   * JSX `key`, never spread it.
   *
   * **Positional, and that is a real limit worth stating**: it identifies the SLOT, not the item.
   * Mantine's list actions write values through `$values` directly and never bump the form-level
   * key generation (verified in 9.3.2's use-form-list), so removing row 0 does not change row 0's
   * key — it changes which item sits there. That is correct for an append/remove list, where the
   * uncontrolled inputs below re-read their `defaultValue` from the new values anyway. A list the
   * USER reorders wants an identity key instead: put a `randomId()` on the item and key the row on
   * that.
   */
  key: (index: number) => string
}

/**
 * Reads and edits a list field as one object.
 *
 * **`items` is read from `form.getValues()`, not from `form.values`**, so it is correct under the
 * `mode: 'uncontrolled'` default `useBasaltForm` sets: the list actions all re-render the form
 * (they call `setValues` with `updateState: true`), so the snapshot this returns is the one the
 * caller just produced.
 *
 * @example
 * const items = useFieldArray(form, 'contacts')
 *
 * {items.items.map((_, index) => (
 *   <FormRow key={items.key(index)} label={`Contact ${index + 1}`}>
 *     <TextInput
 *       key={fieldKey(form, `contacts.${index}.email`)}
 *       {...inputProps(form, `contacts.${index}.email`)}
 *     />
 *     <Button onClick={() => items.remove(index)}>Remove</Button>
 *   </FormRow>
 * ))}
 * <Button onClick={() => items.append({ email: '' })}>Add contact</Button>
 */
export function useFieldArray<
  Values extends Record<string, unknown>,
  Path extends LooseKeys<Values>,
>(
  form: UseFormReturnType<Values>,
  path: Path,
): UseFieldArrayReturn<FormArrayElement<Values, Path & string>> {
  type Item = FormArrayElement<Values, Path & string>

  return {
    items: readList<Item>(form.getValues(), String(path)),
    append: (value) => form.insertListItem(path, value),
    remove: (index) => form.removeListItem(path, index),
    move: (from, to) => form.reorderListItem(path, { from, to }),
    key: (index) => form.key(`${String(path)}.${index}`),
  }
}

/**
 * The dotted-path read. Mantine's own `getPath` is internal to `@mantine/form/paths` and is not on
 * the package's public entry, so this walks the path itself rather than reaching past the export
 * map for six lines.
 *
 * Returns `[]` for a missing path or a non-array value: the alternative is a `.map` on `undefined`
 * at the call site, and "the field is not a list" is a typing error the compiler already reports.
 */
function readList<Item>(values: Record<string, unknown>, path: string): Item[] {
  let current: unknown = values
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return []
    current = (current as Record<string, unknown>)[segment]
  }
  return Array.isArray(current) ? (current as Item[]) : []
}
