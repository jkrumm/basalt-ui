# Brief 3: workspace settings

Build the page "Workspace settings, Northwind Logistics" for a workspace admin editing how the workspace is named, reached and billed. All data below is synthetic; show exactly these values.

## Plan usage (one card at the top)

Seats used: 38 of 50. Change: +3 vs last month, bad when up. Sub line: 12 seats left. Verdict: On track (good). Footer facts: Invited 4, Suspended 1.

## General (a group of fields)

| Field          | Current value         | Help text                             |
| -------------- | --------------------- | ------------------------------------- |
| Workspace name | Northwind Logistics   | Shown in the header and on invoices   |
| URL slug       | northwind             | Lowercase letters, digits and dashes  |
| Contact email  | ops@northwind.example | Receives billing and security notices |

## Notifications (a group of fields)

| Field              | Current value                         | Help text                            | Error                       |
| ------------------ | ------------------------------------- | ------------------------------------ | --------------------------- |
| Deploy webhook URL | http://hooks.northwind.example/deploy | Called after every production deploy | Webhook URLs must use https |
| Digest recipients  | team@northwind.example                | Comma separated                      | none                        |

The webhook field is in its error state when the page loads.

## Actions

- "Save changes" is the primary action; "Cancel" is secondary.
- A danger zone at the bottom: "Delete workspace" with the text "Deleting removes all projects and cannot be undone." and a danger-styled button.

Fields are 480 px wide at most on desktop and fill the width on a phone. Light theme.
