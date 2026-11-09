# App Integration Notes

Per-app API behaviour that contradicts the UI, the obvious reading of the docs, or what a native n8n node implies. Everything here was learned by something breaking.

This file is a head start, not a substitute for reading the endpoint you're about to call. Add a bullet whenever an API surprises you, and note which client/instance it was observed on if it might be account-specific.

## Credentials — what's portable and what isn't

**Portable (belongs here, applies to every client):** which n8n credential type an app uses, which auth flavour, which scopes a given kind of automation needs, and the setup traps.

**Not portable (never stored — get it from the instance):** the credential's name, its ID, and whether it exists at all. Ask for an export of an existing workflow from that instance at intake, or ask the consultant directly.

Credential type by app:

| App | n8n credential type | Mode | Auth flavour |
|---|---|---|---|
| HubSpot (private app) | `hubspotAppToken` | Predefined | Private-app token |
| ClickUp | `clickUpApi` (also `clickUpOAuth2Api`) | Predefined | Personal API token |
| Xero | `xeroOAuth2Api` | Predefined | OAuth2, Web app flow |
| Slack | `slackApi` / `slackOAuth2Api` | Predefined | Bot token / OAuth2 |
| Google (Sheets, Drive, Gmail) | `googleApi` (service account) / `googleOAuth2Api` | Predefined | Service account or OAuth2 |
| Gemini | none — `httpHeaderAuth` | Generic | Header `x-goog-api-key` |
| SMTP alerts | `smtp` | — | Host/port/user/password |
| Inbound webhook auth | `httpHeaderAuth` | Generic | Shared secret header |
| Anything with no native type | `httpHeaderAuth`, `httpBasicAuth`, `oAuth2Api` | Generic | — |

**Prefer Predefined over Generic wherever a native type exists** — it reuses the same credential the app's own node uses instead of spawning a Header Auth credential per app per workflow, and it's n8n's own recommendation. The `credentials` key must exactly equal `nodeCredentialType`. Check for a predefined type before assuming Generic: HubSpot's was recorded wrongly as Generic Header Auth once and the mistake propagated.

Two rules that came out of a live audit, and both still apply on any instance:

1. **Credentials named with n8n's default (`Header Auth account`) get auto-attached to the wrong node.** When you pick Generic → Header Auth, n8n tends to attach an existing credential of that type. A generically-named credential silently lands somewhere it doesn't belong. If you see one in an export, flag it — it should be renamed for its contents (`Gemini API Key`, `<Client> HubSpot App Token`).
2. **One credential entry per node.** Switching auth mode leaves the old entry in the node's JSON — invisible in the editor, inert, until someone flips the dropdown back. Two live nodes had this, one pointing at a Gemini key and one at a different client's HubSpot app. When reading credential names off an export, count the entries rather than taking the first. Tell: select the node, copy, paste into a text editor, count entries under `credentials`.

**Omit `id` in generated files.** A credential ID from another instance is meaningless on the target, and n8n prompts for a real credential anyway. "Not connected" after import is normal on every import — but n8n sometimes auto-relinks and looks fine, so the consultant must click into each credentialed node and confirm the warning clears. A silently-unlinked node fails at run time, not import time.

## HubSpot

### Properties

- Internal property names follow a pattern (lowercase; spaces and punctuation → `_`; `" ("` → `__`; `/` → `_`) — but a property renamed after creation keeps its original internal name, so it won't match the current label. **Always confirm via the properties API or the MCP connector; never ship a guess.**
- Enumeration and multi-checkbox properties return **stored values, not display labels**, and the two can differ. Resolve real values from the API. Multi-checkbox comes back as a semicolon-delimited string.
- Owner-type properties return an **owner ID**, not an email. Map owner ID → destination user explicitly.
- A score/level dropdown (e.g. Complexity 1–6) stores a **number**, not the label. Map the number to the destination option directly.
- Dates come back as ISO strings (be robust to epoch-ms too). Normalise to UTC midnight so a non-UTC server doesn't shift the date by a day.

### Search and stages

- **Never guess a stage's internal ID from the pipeline layout — verify it.** The same label ("Delivery") commonly exists in several pipelines including test ones, and a wrong ID matches nothing while looking completely correct. (Live: Delivery was `1084213066`, not the test pipeline's `1327154479`.)
- For "when did it enter this stage", use **`hs_v2_date_entered_<stageId>`** — a real, searchable datetime property. The older `hs_date_entered_<stageId>` looks similar but isn't reliably filterable. Bonus: the v2 property's label spells out the pipeline name, which disambiguates duplicate stage names.
- **"Flag not true OR not set" needs two OR'd filter groups** (`NEQ true` + `NOT_HAS_PROPERTY`). A bare `NEQ` misses records where the property was never set.
- Search returns only the properties you ask for. List every one you'll read, including the ones you only filter on.
- Search is paginated and rate-limited; `limit: 100` per page, and a high-volume portal needs paging rather than a bigger limit.

### Auth

- Type `hubspotAppToken`, predefined mode — see the credentials table above.
- Scopes are per use: a deals automation that writes a dedup flag needs `crm.objects.deals.read` **and** `.write`. A missing write scope fails at the last step, after the work is done.

### Nodes

- HubSpot's native trigger nodes in n8n are webhook/subscription based, not a stateful "poll every N minutes and fire on real changes" trigger. Don't force-fit — use the polling pattern.

## ClickUp

- **Custom fields need the field's UUID, not its label.** `{"id": "<uuid>", "value": …}`. Fetch them once (Get Accessible Custom Fields, or the UI) and put the map in the Config node.
- **Dropdown/select custom fields go further: the value must be the option's UUID, not the display text.** Plain text/number/url/date fields take the raw value; a dropdown's storage is an option ID. Sending the label fails or silently no-ops. Keep a second map — `dropdownOptionIds.<field>`: label → option UUID. (Built-in task `status` is the exception: it genuinely takes the plain status name.)
- **Task `assignees` wants numeric user IDs**, not emails. Keep a `userEmailToId` map from the team member list.
- **Create Task accepts `custom_fields`, `time_estimate` (ms) and `status` in one call; Update Task does NOT accept `custom_fields`.** The single highest-leverage ClickUp fact: set everything on the create and the follow-up update nodes (plus the task-ID extraction between them) disappear.
- **`users`/`people` custom fields are the exception** — they can't be set on Create Task (returns 400 "FIELD_341"). Set them in a follow-up call: `POST /task/{id}/field/{fieldId}` with `{ value: { add: [userId, …], rem: [] } }`.
- **Drop blank custom-field values before sending** — one blank can make ClickUp reject the whole create.
- **ClickUp automations and list templates modify tasks after you create them** — auto-setting time estimates, applying description templates, reassigning. When verifying a run, tell these apart from what the workflow set (tell: the task was updated a second after creation, or a value matches no source field). Usually intended — confirm rather than assume, and never "fix" a gap the automation is filling.
- Order a status flip around a downstream automation — see pattern 10 in the patterns library.
- The v3 Chat API is experimental. Keep it isolated (one branch of the error handler with email in parallel) so a breaking change doesn't cascade.
- The built-in ClickUp node's "Get all folders" has no server-side name filter. For "find folder by name", fetch all and filter in a Code node.
- `clickUpApi` (personal API token) covers both the v2 and v3 APIs. `clickUpOAuth2Api` also exists — check which the client set up.

## Xero

- **`POST /Invoices` accepts an ARRAY.** Send `{ "Invoices": [ … ] }` with `?summarizeErrors=false` and each invoice returns its own status. Collapses an N-invoice fan-out into one call. Xero recommends batching to stay inside the concurrency limit (5 in-flight calls).
- **`summarizeErrors=false` returns HTTP 200 even when individual invoices were rejected.** Inspect each returned invoice's `ValidationErrors` and `InvoiceID`. Guard the positional mapping: if the count returned differs from the count submitted, record nothing and alert.
- **Xero does NOT apply Invoice Settings or per-contact payment terms to API-created invoices.** Those terms are a UI convenience. Send `Date` and `DueDate` explicitly (`yyyy-MM-dd`) or the invoice ships with no due date at all. Anchor to the org's timezone (`DateTime.now().setZone('Australia/Sydney')`) — a UTC server running before 10am AEST would otherwise stamp yesterday.
- **Chained due dates should be derived from the issue date, not accumulated:** payment n = issue + firstTerm + interval × (n−1). A retry that creates only payment 3 then lands on the date it would have had in the original batch.
- **Contact search: use `EmailAddress=="…"`, not `.Contains(…)`.** `Contains()` is unoptimised and 500s on some organisations, and can match a longer address containing yours. Guard with `EmailAddress!=null&&(…)` or a contact with no email throws. Matching is case-sensitive — a lookup can fail for a contact plainly visible in the UI.
- Line items take `ItemCode` (the human-readable code), not the item's GUID. Optional: with `Description`, `UnitAmount`, account and `TaxType` set explicitly the invoice is complete without it.
- Via HTTP Request, **send `xero-tenant-id` as a header yourself** — the predefined credential carries the token, not the tenant. Add `Accept: application/json` or some endpoints return XML.
- **Credential setup: choose "Web app", not "Custom Connection".** n8n's own docs link to Xero's Custom Connections guide and then tell you to pick Web app — the links are wrong. Custom Connections use the client-credentials grant, which `xeroOAuth2Api` (authorization-code with a redirect URL) can't do; they also cost ~$10/month per connection and are single-organisation. The trade-off the other way is real: a Web app connection is authorised by a person's Xero login and breaks if they leave. Swapping later is a per-node dropdown change, not a rebuild.
- Setup quirks: Xero rejects app names containing "n8n"; the Client Secret is shown once only; scopes are requested at sign-in for Web apps, not configured in the portal; authorise the correct organisation or every call 403s in a way that looks like a permissions bug.
- The refresh token lapses after 60 days idle. A 15-minute poll never hits this; a long-unpublished workflow will.
- Scopes for invoicing: `accounting.contacts`, `accounting.transactions`. Scopes are requested at sign-in for Web apps, not configured in the portal.

## Gemini (direct HTTP, structured output)

- Request shape: `POST …/v1beta/models/<model>:generateContent`, body `contents: [{ role: "user", parts: [{ text }] }]` plus `generationConfig: { responseMimeType: "application/json", responseSchema: {…} }` — lowercase schema types, no `additionalProperties`, optional `temperature: 0`. Read the answer at `candidates[0].content.parts[0].text` and `JSON.parse` it.
- Auth: Header Auth, header `x-goog-api-key`. The key must be created in **Google AI Studio against a billed project** — plain Cloud-console keys are rejected with 401 `ACCESS_TOKEN_TYPE_UNSUPPORTED`. Use a billed project for client data; free-tier prompts may be used for training.
- A 404 at run time is almost always a **wrong model name**, not an API problem. Keep the model string in the Config node.
- Use the cheapest tier for well-scoped jobs. A folder-matcher on flash-lite costs cents a month.
- No predefined n8n credential type exists — Generic Header Auth is correct here, and this is the app most likely to be carrying n8n's default credential name.

## SMTP / email alerts

- Credential type `smtp`. For Gmail: host `smtp.gmail.com`, port 465, SSL on, Client Host Name blank, password = an **app password**.
- From must equal the authenticated account. Multiple recipients = one comma-separated string.
- n8n's own system emails use `N8N_SMTP_*` env vars; the Send Email node does not read them. This credential is separate even if system email works.

## Apps not yet used — add the first finding here

Stubs so there's an obvious place for the next discovery.

- Slack — not yet used.
- Google Sheets / Drive — not yet used.
- Gmail (as an action, not SMTP) — not yet used.
- Airtable — not yet used.
- Stripe — not yet used.
- Microsoft 365 / Outlook — not yet used.
- Zapier / Make hand-offs — not yet used.
