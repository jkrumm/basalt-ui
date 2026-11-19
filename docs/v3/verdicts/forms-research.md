# Forms research: what the open-source form systems do, and what basalt takes

Source study for plan row `v3-owner-2-forms-grammar` (owner review 2, 2026-11-19: "forms need way more love", "BlueprintJS
or other open source libraries can be helpful"). Four research runs on 2026-11-19 read the official documentation of
Blueprint, IBM Carbon, GitHub Primer, Shopify Polaris, Radix Themes, shadcn/ui, Stripe Apps, Ark UI, Mantine, MUI,
react-select, react-dropzone, Uppy, GOV.UK, Base UI, and the public settings documentation of GitHub and Linear. Every
source is listed at the end with what was read; a pattern below cites the sources by number. The Spec that turns the
takes into parts is the factory artifact of Issue 2428; this page is the evidence it rests on.

Two things could not be read: Stripe's own Dashboard settings (login-walled; only the Stripe Apps toolkit is public) and
the visual layout of GitHub and Linear settings (their public docs describe steps, not geometry). Nothing below rests on
a screenshot of either.

## Verdict per pattern

### 1. Label placement

| Source                | What it does                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carbon [10, 11]       | Top-aligned labels only: "the only label arrangement currently offered". Sentence case, no colon, one to three words                                                                                               |
| Primer [12, 13]       | Label above the control by default; horizontal layout only for a checkbox or a radio. "Do not build columns just to save vertical space"                                                                           |
| Blueprint [1, 2]      | `FormGroup` puts the label above; `inline` puts label and control on one line; no stacking rule                                                                                                                    |
| shadcn Field [24, 25] | `orientation`: `vertical` (default), `horizontal` (label and description in `FieldContent` at the start, control at the end), `responsive` (switches on a container query)                                         |
| Polaris [17, 18]      | `Layout.AnnotatedSection`: heading and description in a start column, controls in the end column, `minmax(12rem, 1fr) minmax(0, 2fr)` above a 600px container, one column below it; the error stays with its field |
| Stripe Apps [27, 30]  | `FormFieldGroup` lays fields out as `row` or `column`; a text field's description sits next to its label                                                                                                           |

- **Take: stacked by default.** A dialog, a create form and a phone stay label over control (Carbon, Primer). `FormField` keeps `stack` as its default.
- **Take: a label-start settings row that stacks when narrow.** shadcn's `horizontal`/`responsive` Field and Polaris's annotated section are the two documented forms; both key on the container, as basalt's layout law does. In basalt it is `FormField layout="row"`, stacking under the `regular` container size (480px), with the error in the control's column (Polaris [18]).
- **Take: a toggle stays at the end at every width.** shadcn's switch row [24] and Carbon's toggle-with-label [11] keep a switch beside its label; stacking a 36px switch under a label wastes a line on a phone.
- **Refuse: Blueprint's `inline` label.** It puts the label and the control on one line with no description column and no narrow rule; the row above covers its use.
- **Refuse: Carbon's fluid inputs (label inside the field).** One fixed 64px height and no help text; it fights the kit's density law.

### 2. Section and group surfaces

| Source               | What it does                                                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blueprint [5, 6, 7]  | `Section`: a card-styled container with `title`, `subtitle`, `rightElement`, `collapsible`, elevation 0 or 1 only ("higher values create too much visual clutter"); `SectionCard`s stack inside it                                                   |
| Carbon [10, 14, 23]  | Group headings smaller than the form heading, larger than labels; fieldset and legend for groups of checkboxes or radios; `Tile` is a flat container; "Carbon does not have a card pattern"                                                          |
| Polaris [16, 17, 19] | Settings template: `s-section` with heading and subheading per group, an accessory slot, nested sections for list items, rows divided by dividers; "for more than five inputs, use sections with titles in one card, or multiple cards with headers" |
| shadcn Field [24]    | `FieldSet` with `FieldLegend` and `FieldDescription`, `FieldGroup` of `Field`s, `FieldSeparator` used sparingly                                                                                                                                      |
| Stripe Apps [27]     | `FormFieldGroup`: a legend that labels every field inside, a description; `disabled` cascades                                                                                                                                                        |
| Primer [12, 15]      | No section component; grouping by proximity and a group label; a full page for settings that span several sections                                                                                                                                   |

- **Take: a titled group on a surface, one card per group, rows divided by a hairline.** Blueprint's `Section` and Polaris's settings template agree; Polaris's "more than five inputs" is the threshold the skill reference names. In basalt it is `FormSection`: a fieldset (the title is its legend, so the group has a name and `disabled` cascades, as in Stripe and Carbon [23]) on the card surface.
- **Take: a one-line description under the title** (Polaris's subheading, "not a paragraph in the section body" [16]).
- **Take: a footer band on the section** for a section that saves on its own; Primer's one-save-per-form rule (pattern 5) limits it to a form of one section.
- **Refuse: collapsible form sections.** Carbon warns that accordions in a form leave it unclear what the primary button saves [10]; a settings page is short enough to scroll. Blueprint's `collapsible` is not carried over.
- **Refuse: an accessory slot (help icon in the section header).** Carbon: essential information never sits in a tooltip [11]; the description line covers it.

### 3. Help and error text

| Source                | What it does                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carbon [10, 11, 22]   | Helper text under the field, always visible; the error replaces it; three error signals (red border, icon, message); validate on blur (forms pattern)                                                                                                |
| Primer [12, 13]       | Caption below; hide a caption that repeats the error; validate on submit first, then inline; one message per checkbox or radio group; 3 or more errors get a summary banner, otherwise focus the first invalid input; no live regions for validation |
| Polaris [16, 20]      | `details` under the field; errors after focus leaves the field, never while typing                                                                                                                                                                   |
| shadcn Field [24, 25] | `FieldError` right after the control; `data-invalid` on the field, `aria-invalid` on the control; touched and invalid shows the error                                                                                                                |
| GOV.UK [38]           | The message says what went wrong and how to fix it; no "This field is required", no "Please"                                                                                                                                                         |

- **Take (already shipped): the description under the control, the error under the description, `aria-invalid` on the control.** `FormField` does this; the row layout keeps both in their columns.
- **Take: validate after blur, and on submit; live after a failed submit.** The kit's skill reference already teaches `revalidateLogic`; the gallery forms use `mode: 'blur', modeAfterSubmission: 'change'` (Carbon, Polaris). The reference is corrected to say so.
- **Take: focus the first invalid control after a rejected submit** (Primer). `FormFooter` does it after a client-side rejection; `toSubmitErrors` already does it for a server one.
- **Refuse: an error summary banner for 3 or more errors** (Primer). Basalt forms are short; the first invalid field takes focus and every field shows its message. Later work if a long form needs it.
- **Refuse (keep as is): the always-mounted polite live region for the error.** Primer says no live regions for validation; basalt keeps its region because a message that arrives after an async check would otherwise go unannounced. This is a deliberate difference, recorded here.

### 4. Required and optional marking

| Source              | What it does                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Primer [12, 13, 31] | A visible mark (asterisk, hidden from the accessibility tree) plus `required` in code; never on a single checkbox or radio, only on the group |
| Carbon [11]         | Mark the minority: "(optional)" if most fields are required, "(required)" if most are optional                                                |
| GOV.UK [37]         | "(optional)" on labels; never asterisks                                                                                                       |
| Blueprint [1]       | `labelInfo="(required)"`, consumer-defined                                                                                                    |
| Stripe Apps [28]    | "Clearly distinguish between required and optional settings"                                                                                  |

- **Take (already shipped): an asterisk plus the control's own `required`** (Primer). `FormField` has it.
- **Refuse for now: an `optional` text mark.** Carbon's minority rule is the better rule for long forms, but it is a convention a page follows, not a part; the skill reference states it ("mark the minority"). Later work if a page needs the mark as a prop.

### 5. Save model

| Source                      | What it does                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primer [14]                 | Explicit save by default; one save button per form, never disabled when the form is invalid or unchanged; autosave only for toggle switches, segmented controls and single selects outside a saved form; never mix the two on one page; warn on leave with `beforeunload` |
| Polaris [16, 19, 21]        | `data-save-bar`: a save bar appears when a field differs from its saved value, with Save and Discard; "autosave is incongruous with admin save UX"                                                                                                                        |
| Carbon [10, 11]             | Toggles for changes that apply at once; buttons at the bottom for submitted forms; do not disable the primary of a long form ("the error messages and the button may not be on screen together")                                                                          |
| Stripe Apps [26, 28]        | One Save per settings view with a status message beside it ("Saving…", "Saved!"); "one clear way to save changes"                                                                                                                                                         |
| shadcn [25]                 | No save model; examples put Reset and Save in a card footer                                                                                                                                                                                                               |
| GitHub, Linear [33, 34, 35] | GitHub profile: explicit "Update profile"; the photo saves through its own action. Linear: not documented                                                                                                                                                                 |

- **Take: two models, never mixed in one form.** A form with a Save action (`FormField field=…` + `FormFooter`) or instant preferences (`FormField control=…` on a store handle with a `Switch`). Both already exist; the reference now says which control belongs to which (Primer's lists).
- **Take: the primary is never disabled for an invalid or unchanged form.** Primer and Carbon agree, and it closes the gallery's "submit-only validators lock the primary" row: a disabled Continue could never re-run the submit that clears its error. `FormFooter` disables it only while it submits.
- **Take: a dirty status beside the save of a long form, kept in view.** Polaris's save bar and Stripe's status message are the sources; a fixed bar at the top of the window (Polaris) belongs to Shopify's admin chrome. Basalt's form is `FormFooter sticky`: it stays at the bottom of the scrollport and reads "Unsaved changes" while the form is dirty.
- **Refuse: hiding the save until the form is dirty** (Polaris's bar). Primer: a save that is not there cannot be reached by Tab, and the reader has nothing to aim at.
- **Refuse: a save per section inside one form** (GitHub's repeated "Update profile" is the counter-example; Primer forbids it).

### 6. Long-form navigation

| Source          | What it does                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Polaris [17]    | One page per entity; titled sections; avoid large forms in modals                                                                       |
| Primer [15, 32] | Full-page form for settings across sections; tabs that change the URL (`UnderlineNav`); a back link for child pages                     |
| Carbon [10]     | Dialog for fewer than five inputs; side panel for more; a page for complex or multi-step requests; no accordions or tabs inside dialogs |
| Linear [34, 36] | Settings split into Account, Features, Administration, Your teams; a master-detail team page                                            |

- **Take: a long settings page is one page of `FormSection`s; a page of many groups splits by `InnerNav` or tabs that change the URL.** Both ship (`InnerNav`, `PageBar tabs`); the reference names them.
- **Take: a dialog holds a short form** (Carbon's five inputs, Polaris). The skill reference states it.
- **Refuse: an in-page table of contents for a form.** No source asks for it.

### 7. Multi-step structure

| Source                                    | What it does                                                                                                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carbon [9, 39]                            | Progress indicator for a linear process of three or more steps; not when steps can be done in any order or the count changes; states complete, current, not started, error; interactive steps optional; vertical preferred |
| Ark UI / Chakra [40, 41]                  | Steps with `aria-current="step"` on the current trigger, `linear`, `isStepValid` blocks moving on                                                                                                                          |
| Mantine [42]                              | `Stepper` with `onStepClick`; `allowStepSelect` lets users go back to reached steps; upcoming steps not selectable                                                                                                         |
| MUI [43]                                  | Vertical stepper for narrow screens; `MobileStepper` with text, dots or a progress bar                                                                                                                                     |
| Stripe Apps [29]                          | Progress stepping in the footer of a focus view; the final action is a primary button                                                                                                                                      |
| GOV.UK [37]                               | One question per page, "Continue", a "Question 3 of 9" caption; warns against all-steps lists on small screens                                                                                                             |
| Primer, Polaris, Radix, shadcn, Blueprint | No stepper                                                                                                                                                                                                                 |

- **Take: a `Stepper`: every step named, the current one `aria-current="step"`, a done step a button back to it, an upcoming step never reachable from the list** (Ark, Mantine, Carbon). The form validates the step before Continue moves on.
- **Take: fold it to "Step 2 of 3" and a segmented bar when narrow** (MUI's mobile stepper, GOV.UK's caption). No source documents an automatic fold; keying it on the container is basalt's own call, recorded here as such.
- **Take: Back and Continue in `FormFooter`, the last step's primary names what it creates** (Stripe, GOV.UK, Carbon's right-aligned wizard primary).
- **Refuse: an error state per step and a vertical stepper.** Steps validate before moving on, so a step behind the current one cannot be invalid; vertical is later work if a flow has many steps.

### 8. File upload

| Source              | What it does                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carbon [8, 44]      | A button or a drag-and-drop zone; heading, a description of the limits; file rows with a delete x; the zone matches the inputs' height; Space/Enter opens the dialog; focus returns; per-file error |
| Ark UI [45]         | `accept`, `maxFiles`, `maxFileSize`, rejection codes (`FILE_INVALID_TYPE`, `FILE_TOO_LARGE`, `TOO_MANY_FILES`); item rows with name, size, delete                                                   |
| Polaris [20, 46]    | `s-drop-zone` validates type only; size belongs to the app; keep each file with a status; show progress when measurable                                                                             |
| react-dropzone [47] | Headless; "not a file uploader"; a `<label>` root opens the dialog twice unless `noClick`                                                                                                           |
| Uppy [48]           | A full dashboard with progress, pause, retry                                                                                                                                                        |
| Blueprint [3]       | `FileInput`: a label around a native input; its text does not update by itself                                                                                                                      |
| Primer, Radix       | None public                                                                                                                                                                                         |

- **Take: `FileUpload`: one keyboard-reachable drop zone that opens the picker, a hint line naming the limits, a file list with name, size and a named remove button; type, size and count checked in the part, each rejection named in kit text with the file and the limit** (Carbon, Ark, GOV.UK's wording [38]). The value is `File[]`, so `FormField` binds it like any control.
- **Refuse: upload progress, pause and retry in the part.** The transfer is the app's (Polaris, react-dropzone); the part holds the chosen files. Later work: a per-file `status` if a page uploads on pick.
- **Refuse: Blueprint's `FileInput`.** A native input in a label adds no drop zone and no list.

### 9. Creatable tags

| Source                | What it does                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| react-select [49, 50] | `Creatable`: a `Create "x"` option, last, hidden when the text is empty or matches an option case-insensitively; `onCreateOption` |
| Ark UI [51]           | `TagsInput`: Enter adds, Backspace removes the last tag, paste splits with `addOnPaste`; no Create row                            |
| Mantine [52]          | `TagsInput` on Combobox; adds on blur by default; split characters; rich options                                                  |
| Blueprint [4]         | `TagInput`: `onAdd` with method `default`, `blur`, `paste`; splits on commas and newlines                                         |
| Primer [53, 54]       | `Autocomplete` with `addNewItem` appending an entry for the typed value                                                           |
| Base UI [55, 56]      | Combobox "does not allow free-form text input"; no creatable example; Autocomplete is free text with no remembered selection      |

- **Take: a `Create "x"` row in the Combobox popup, last, shown when the typed text matches no item case-insensitively** (react-select, Primer's `addNewItem`). It keeps one part for picking and creating, and the created value lands in the chips like a picked one. In basalt it is `Combobox onCreate`.
- **Take (already shipped): Backspace removes the last chip; each chip's remove button is named.** Base UI's chips do it [55].
- **Refuse for now: paste-to-split and add-on-blur.** Blueprint and Mantine do it; Ark makes paste opt-in. A blur that silently creates a tag is surprising in a form with a Save; paste splitting is later work if a page needs bulk entry.

### 10. The look of field controls

| Source                       | What it does                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primer [57]                  | `TextInput` sizes small, medium, large; `leadingVisual`, `trailingVisual`, `trailingAction`; avoid both visuals at once; a loading spinner replaces a visual |
| Radix Themes [58, 59]        | `TextField.Slot` left or right for an icon or an icon button; three sizes; `Select` with groups and separators, no search, no option description             |
| Blueprint [2]                | `InputGroup`: one icon at the start, one element at the end; `ControlGroup` joins controls                                                                   |
| Carbon [11, 22]              | Heights 24, 32, 40, 48px; error icon in the field; read-only keeps the value and drops the field's affordance                                                |
| Polaris [21]                 | `select` takes an `icon` and option groups; no search; above 200 options use an autocomplete                                                                 |
| Mantine [52]                 | Rich options through `renderOption` (an icon and a description line)                                                                                         |
| Shopify choice list [22, 60] | Each choice takes a `details` help line                                                                                                                      |

- **Take: an icon at the start and a unit or one small action at the end of an `Input`** (Primer, Radix, Blueprint). `Input start` takes an icon component, `Input end` a node.
- **Take: options with an icon and a description line in `Select`** (Mantine, Primer's ActionList items). Groups already ship (`SelectGroup`).
- **Take: a radio or checkbox option with a description line** (Polaris's `details`, shadcn's choice rows). `RadioGroup options` and `CheckboxGroup options`.
- **Take: a read-only look**: the value stays, the border and the field fill go (Carbon, Primer).
- **Take: a spinner in a loading button that keeps its label**, and the busy state named (Primer's loader).
- **Take: the value of a slider beside it** (the gallery's gap; no source contradicts it).
- **Refuse: a second input size scale.** Basalt already has `md`/`sm` from the density law; Carbon's four heights would fork it.
- **Refuse: search inside a Select popup.** Radix and Polaris keep Select searchless; a searchable list is a `Combobox` (already ships, and Primer turns a searchable popup into a dialog with Save and Cancel [14]).

## The form engine

All of the systems above leave the form engine to the app: shadcn integrates TanStack Form and React Hook Form by example
[25], Base UI ships its own native-validation `Form` [56], Mantine ships `@mantine/form`. Basalt's `FormField` reads a
structural `FieldLike` (`state.value`, `state.meta.errors`, `handleChange`, `handleBlur`), which a TanStack Form field
satisfies with no glue; the gallery binds all three whole forms through it. The Spec recommends no adapter subpath.

## Sources

Each was read on 2026-11-19 by the research runs; [n] is the citation key above.

1. Blueprint FormGroup — https://blueprintjs.com/docs/#core/components/form-group and its MDX (raw.githubusercontent.com/palantir/blueprint/develop/packages/core/src/components/forms/form-group.mdx)
2. Blueprint ControlGroup, Label, InputGroup MDX — packages/core/src/components/forms/{control-group,label,input-group}.mdx in palantir/blueprint
3. Blueprint FileInput MDX — packages/core/src/components/forms/file-input.mdx
4. Blueprint TagInput source and typings — packages/core/src/components/tag-input/tagInput.tsx; https://app.unpkg.com/@blueprintjs/core@6.23.0/files/lib/esm/components/tag-input/tagInput.d.ts
5. Blueprint Section MDX and source — packages/core/src/components/section/section.{mdx,tsx}
6. Blueprint Card MDX — packages/core/src/components/card/card.mdx
7. Blueprint HTMLSelect MDX — packages/core/src/components/html-select/html-select.mdx
8. Carbon file uploader guidelines — https://www.carbondesignsystem.com/building-blocks/core/components/file-uploader/guidelines
9. Carbon progress indicator guidelines — https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/guidelines
10. Carbon forms pattern — https://www.carbondesignsystem.com/building-blocks/core/patterns/forms
11. Carbon form, text input and toggle guidelines — https://www.carbondesignsystem.com/building-blocks/core/components/{form,text-input,toggle}/guidelines
12. Primer FormControl — https://primer.style/product/components/form-control/
13. Primer forms pattern — https://primer.style/product/ui-patterns/forms/
14. Primer saving pattern — https://primer.style/product/ui-patterns/saving/
15. Primer edit scenario — https://primer.style/product/scenario-patterns/edit/
16. Shopify settings template — https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings
17. Shopify forms guidance — https://shopify.dev/docs/apps/design/user-experience/forms.md
18. Polaris Layout migration (AnnotatedSection) — https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/layout
19. Shopify save bar — https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar
20. Shopify drop zone — https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone
21. Shopify select — https://shopify.dev/docs/api/app-home/latest/web-components/forms/select
22. Shopify choice list and alerts — https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list; https://shopify.dev/docs/apps/design/user-experience/alerts
23. Carbon React FormGroup source — https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/react/src/components/FormGroup/FormGroup.tsx
24. shadcn/ui Field — https://ui.shadcn.com/docs/components/field (Base UI variant: /docs/components/base/field)
25. shadcn/ui TanStack Form — https://ui.shadcn.com/docs/forms/tanstack-form
26. Stripe Apps settings — https://docs.stripe.com/stripe-apps/app-settings
27. Stripe Apps FormFieldGroup and TextField — https://docs.stripe.com/stripe-apps/components/formfieldgroup; https://docs.stripe.com/stripe-apps/components/textfield
28. Stripe Apps review requirements — https://docs.stripe.com/stripe-apps/review-requirements
29. Stripe Apps progress stepping — https://docs.stripe.com/stripe-apps/patterns/progress-stepping
30. Stripe Apps design and full-page apps — https://docs.stripe.com/stripe-apps/design; https://docs.stripe.com/stripe-apps/patterns/full-page-apps
31. Primer CheckboxGroup — https://primer.style/product/components/checkbox-group/
32. Primer navigation pattern — https://primer.style/product/ui-patterns/navigation/
33. GitHub profile settings — https://docs.github.com/en/account-and-profile/tutorials/personalize-your-profile
34. Linear account preferences and profile — https://linear.app/docs/account-preferences; https://linear.app/docs/profile
35. Linear workspaces — https://linear.app/docs/workspaces
36. Linear settings rebuild — https://linear.app/changelog/2024-12-18-personalized-sidebar
37. GOV.UK question pages — https://design-system.service.gov.uk/patterns/question-pages
38. GOV.UK error message — https://design-system.service.gov.uk/components/error-message
39. Carbon progress indicator accessibility — https://carbondesignsystem.com/components/progress-indicator/accessibility
40. Ark UI Steps — https://ark-ui.com/docs/components/steps
41. Chakra UI Steps — https://chakra-ui.com/docs/components/steps
42. Mantine Stepper — https://mantine.dev/core/stepper
43. MUI Stepper — https://mui.com/material-ui/react-stepper
44. Carbon file uploader usage — https://carbondesignsystem.com/components/file-uploader/usage
45. Ark UI FileUpload — https://ark-ui.com/docs/components/file-upload
46. Polaris drop zone migration — https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/drop-zone
47. react-dropzone — https://github.com/react-dropzone/react-dropzone
48. Uppy Dashboard — https://uppy.io/docs/dashboard
49. react-select Creatable — https://react-select.com/creatable
50. react-select useCreatable source — https://github.com/JedWatson/react-select/blob/master/packages/react-select/src/useCreatable.ts
51. Ark UI TagsInput — https://ark-ui.com/docs/components/tags-input
52. Mantine TagsInput — https://mantine.dev/core/tags-input
53. Primer Autocomplete — https://primer.style/product/components/autocomplete/
54. Primer TextInputWithTokens — https://primer.style/product/components/text-input-with-tokens/
55. Base UI Combobox — https://base-ui.com/react/components/combobox
56. Base UI Autocomplete and forms handbook — https://base-ui.com/react/components/autocomplete; https://base-ui.com/react/handbook/forms
57. Primer TextInput — https://primer.style/product/components/text-input/
58. Radix Themes TextField — https://www.radix-ui.com/themes/docs/components/text-field
59. Radix Themes Select and CheckboxGroup — https://www.radix-ui.com/themes/docs/components/select; https://www.radix-ui.com/themes/docs/components/checkbox-group
60. Polaris ChoiceList and FormLayout migrations — https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/{choice-list,form-layout}
