# n8n Schema & Gotchas Cheatsheet

Node schemas and typeVersions change across n8n releases. Getting one wrong is the most common reason a generated workflow fails to import or silently does nothing.

## How to trust a typeVersion

Every shape below is tagged:

- **(live 2.23)** — read off real working workflows exported from a live n8n 2.23.2 instance and cross-checked programmatically. Trust these over any recalled default when the target instance is on 2.x.
- **(docs)** — from docs.n8n.io, not yet exercised. Verify before relying on it; promote to (live) once a build proves it.

Because every client runs their own instance, a version tag is evidence, not a guarantee. Before finalising node versions for a client:

1. **Ask for an export of any existing workflow from that instance** — it carries the real current typeVersions, settings keys and credential naming for that deployment. This is the single best piece of evidence available and costs the consultant thirty seconds.
2. Failing that, get the version number from the instance (bottom-left of the editor, or `/rest/settings`) and check docs.n8n.io for that release.
3. If the instance turns out to differ from anything stated here, say so in the delivery rather than silently following this file.

If you can't establish the version, say so in the delivery and name the versions you authored against. A node whose typeVersion is higher than the instance supports fails at import; one that's lower usually imports but may render with different parameter names.

Known version-sensitive spots: IF (2.2 vs 2.3 — different `options.version` and the `looseTypeValidation` sibling), Switch (3.x), Code (1 vs 2), executeWorkflow (`mode: "each"` deprecated, removed in 3.0), executeWorkflowTrigger (1 vs 1.1, `inputSource`), Schedule Trigger (1.1 vs 1.2).

## Workflow top-level shape

```json
{
  "name": "Workflow name",
  "nodes": [ /* node objects */ ],
  "connections": { /* connections object */ },
  "active": false,
  "settings": { "executionOrder": "v1", "binaryMode": "separate" },
  "pinData": {}
}
```

`settings` keys seen in live 2.x exports: `executionOrder` ("v1"), `binaryMode` ("separate"), `errorWorkflow` (the error handler's workflow ID — set on every workflow in an automation), `callerPolicy` ("workflowsFromSameOwner", on sub-workflows), `timeSavedMode`, `availableInMCP`. On import n8n adds `versionId`, `meta`, `id`, `tags`, `nodeGroups` — don't author those.

- **Credentials are never included in exports/imports.** Every node referencing a credential shows as "not connected" after import, on every workflow, every time. Expected — say so in the delivery notes so it isn't mistaken for a bug.
- `active` is `false` on delivery; the consultant publishes after verifying config.
- **`errorWorkflow` is an instance-specific ID.** It won't exist on a new client's instance until the error handler is imported there. Ship the field absent or with a comment, and make setting it a numbered step in the delivery notes.

## Node object shape

```json
{
  "parameters": { /* node-specific */ },
  "id": "<uuid>",
  "name": "Unique Display Name",
  "type": "n8n-nodes-base.xxx",
  "typeVersion": 2,
  "position": [x, y],
  "credentials": { "httpHeaderAuth": { "name": "Credential Name" } }
}
```

- `name` must be unique across the workflow — it's the handle every `$('Name')` expression and every `connections` entry uses.
- `credentials` entries need a `name` at minimum. **Omit `id` entirely** in generated files — an ID from another instance is meaningless on the target and n8n will prompt for a real credential anyway. **Exactly one entry per node.**

Node-level siblings (outside `parameters`):

- `"retryOnFail": true, "maxTries": 3, "waitBetweenTries": 3000` — **reads and idempotent writes only** (a GET, a flag PATCH, a status update). Never on a create call: a retry after a lost response duplicates the record.
- `"onError": "continueRegularOutput"` — continue-on-fail. Use on a dispatcher's Execute Workflow node so one bad record doesn't halt the batch.
- `"webhookId": "<uuid>"` — required on `webhook`, and also present on `emailSend` in real exports.
- `"notesInFlow": true` with `"notes": "..."` — surfaces a one-line note under the node on the canvas. Cheap documentation for a handover.

## Connections object shape

```json
"connections": {
  "Source Node Name": {
    "main": [
      [ { "node": "Target A", "type": "main", "index": 0 } ],
      [ { "node": "Target B", "type": "main", "index": 0 } ]
    ]
  }
}
```

`main` is an array of output slots. A node with one output has one array inside `main`, listing every downstream target from that output (fan-out to several nodes is fine). IF has 2 slots (true, false); Switch has one per rule, plus an extra if `fallbackOutput` is `"extraOutput"`. Two branches converging on the same next node need no Merge node — point both target lists at the same name.

## Expressions

Everything in `{{ }}` is JavaScript evaluated in n8n's sandbox. A field is either `"=literal text with {{ $json.x }} inline"` or a single whole-value expression `"={{ ... }}"`. Don't mix a whole-value expression with surrounding text.

Data accessors:

| Accessor | Meaning |
|---|---|
| `$json` | The current item, as output by the **immediately preceding node only**. |
| `$('Node Name').first().json` | That node's first output item. Correct and safe from anywhere downstream — but only if that node emits exactly one item. |
| `$('Node Name').item.json` | The item paired with the one being processed, via `pairedItem` lineage. **Required when the referenced node fanned out.** Only available in per-item contexts. |
| `$('Node Name').all()` | Every item that node output. |
| `$input.first().json` / `$input.all()` | This node's own input. Use on a branch — a node's own input is always the path that actually reached it. |
| `$now`, `$today`, `DateTime` | Luxon. `DateTime.now().setZone('Australia/Sydney')` etc. |
| `$execution.id`, `$workflow.name`, `$runIndex` | Context. Useful in error messages and idempotency keys. |

Rules that bite:

- **Object literals must be wrapped in parentheses:** `={{ ({ key: value }) }}`. Without them, `{{ { key: value } }}` parses as a code block and silently yields the wrong result.
- Pasting an `=`-prefixed value into a field already in Expression mode **doubles the prefix** (`= =https://…`). The `{{ }}` parts still resolve but the stray `=` lands in the output → cryptic "Invalid URL". In Expression mode, paste without the leading `=`.
- **Referencing a node that didn't run on the path taken throws** `Node '…' hasn't been executed` — and it's non-deterministic when the branch is data-dependent (an AI match that sometimes matches). Only reference nodes that are true ancestors on every path reaching the referencing node; otherwise use `$input`.
- **`$json` after an HTTP Request is the API's response, not your data.** See the IF traps.

## Node reference

### Code — `n8n-nodes-base.code`, typeVersion 2 (live 2.23)

```json
{ "mode": "runOnceForEachItem", "language": "javaScript", "jsCode": "return { json: {...} };" }
```

- Two modes: `runOnceForAllItems` (runs once total; read all items via `$input.all()`; return an **array** of `{json: …}`) and `runOnceForEachItem` (runs per item; `$json` is that item; return a **single** `{json: …}` object, not an array).
- **`mode` is omitted entirely for `runOnceForAllItems`** — it's the default and live exports carry no `mode` key. A missing `mode` is not a bug.
- **JS has no `\U` escape.** `"\U0001F534"` evaluates to the literal text `U0001F534`, not 🔴. Paste the character, or use the surrogate pair `\uD83D\uDD34`. Only lowercase `\uXXXX` is a real escape. (Found live in an error handler; it shipped broken and nobody noticed until they read an alert.)
- Built-ins with no import: `$input`, `$json`, `$now`, `$today`, `DateTime` (Luxon), `$('Node Name')`.
- **No HTTP and no filesystem from a Code node** — use HTTP Request.
- **Throwing is a legitimate design tool:** `throw new Error('…')` fails the execution loudly and triggers the error workflow, which is almost always better than passing garbage downstream.
- On self-hosted 2.x, env-var access is blocked by default (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`). Put values in the Config node rather than reading `process.env`.

**Fan-out correctness — the highest-frequency silent bug:**

- In `runOnceForAllItems`, there is no single "current item" once several are present. Bare `$json` is only meaningful where exactly one item flows. **Downstream of a fan-out, use `runOnceForEachItem`** so `$json` unambiguously means the item being processed.
- **`.first()` vs `.item`:** `.first()` always grabs output item 0 — correct for a node that only ever emits one (a config node, a single call before any branch or loop). If the referenced node fanned out, `.first()` pairs every lane with item 0's data. Use `.item` instead. Getting this backwards doesn't error; it produces wrong data.
- **Everything downstream of a fan-out runs once per item — including side effects.** A status update, an API write or a create after a fan-out fires N times. Steps that must run once per record go *before* it. (Live bug: a status-flip after a package fan-out re-fired a ClickUp automation once per package.)
- Rule of thumb: `.first()` for single-item nodes, `.item` for anything downstream of a fan-out.

### HTTP Request — `n8n-nodes-base.httpRequest`, typeVersion 4.2 (live 2.23)

```json
{
  "method": "POST",
  "url": "https://api.example.com/thing/{{ $json.id }}",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "clickUpApi",
  "sendQuery": true,
  "queryParameters": { "parameters": [ { "name": "archived", "value": "false" } ] },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ ({ name: $json.name }) }}",
  "options": {}
}
```

paired with `"credentials": { "clickUpApi": { "name": "Exact Name From That Instance" } }`.

- **Prefer Predefined Credential Type over Generic** whenever the app has a native n8n credential type (`clickUpApi`, `hubspotAppToken`, `slackApi`, `xeroOAuth2Api`, `openAiApi`, …). The `credentials` key must exactly equal `nodeCredentialType`. This is n8n's own recommendation and avoids a duplicate Header Auth credential per app per workflow.
- Generic mode: `"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth"` + `"credentials": { "httpHeaderAuth": { "name": "…" } }`. Generic types you'll use: `httpHeaderAuth`, `httpBasicAuth`, `oAuth2Api`.
- Useful options: `response.fullResponse` (to see status codes), `response.neverError` (handle non-2xx yourself), `batching`, `timeout`, `pagination`. Set `Accept: application/json` explicitly for APIs that default to XML.
- A non-2xx fails the node by default. That's usually what you want — it hits the error workflow. Override only where a 404 is a legitimate "not found" result you intend to branch on.

### IF — `n8n-nodes-base.if`, typeVersion 2.3 (live 2.23)

```json
{
  "conditions": {
    "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "loose", "version": 3 },
    "conditions": [
      {
        "id": "<uuid>",
        "leftValue": "={{ String($('Parse Match Result').first().json['Match found']) }}",
        "rightValue": "",
        "operator": { "type": "boolean", "operation": "true", "singleValue": true }
      }
    ],
    "combinator": "and"
  },
  "looseTypeValidation": true,
  "options": {}
}
```

At 2.3: `options.version` is `3`, `typeValidation` is `"loose"`, and a sibling `looseTypeValidation: true` sits alongside `conditions`. Outputs: index 0 = true, index 1 = false.

**Use the bulletproof boolean pattern above for any truthiness test** — coerce with `String(...)` and use the unary operator (`operation: "true"`, `singleValue: true`, empty `rightValue`). No right-hand value to mistype, no type to mismatch.

**Four IF traps, all silent. This is where most bugs hide:**

1. **An IF after an HTTP Request reading bare `$json` is testing the API response, not your data.** `$json.myFlag` is `undefined`, `String(undefined)` is `"undefined"` — a non-empty string, which loose validation reads as **true**. The node takes the true branch on every run. Fix: name the producing node — `$('Check Invoice Results').first().json.anyFailed`. The exception is when the IF deliberately tests that HTTP node's own response (`$json.Contacts.length > 0` straight after a lookup). Note `.first()` isn't the fix; *naming the node* is. (Caught live: a Xero partial-failure alert fired on every successful run.)
2. **Strict type validation routes to False without comparing.** A type mismatch shows a small red triangle and sends the item down False, never having evaluated it. Fix the expression's type, not the value.
3. **Hidden stacked conditions.** The editor shows one row at a time but a node can hold several, AND'd — a leftover silently vetoes everything and the node "always goes the same way". Tell: an AND/OR combinator selector is visible; a genuinely single-condition node shows none. To be sure: select the node, copy, paste into a text editor, count entries under `conditions`.
4. **Branch direction must read the same way as the node's name.** "Client Folder Exists" tests `is true` with True going to the exists path. Never invert logic to keep an action node on output 0.

### Switch — `n8n-nodes-base.switch`, typeVersion 3.2 (docs)

```json
{
  "rules": { "values": [
    { "conditions": { "...same shape as IF..." }, "renameOutput": true, "outputKey": "Migration Hours" },
    { "conditions": { "..." }, "renameOutput": true, "outputKey": "Dev Hours" }
  ] },
  "options": { "fallbackOutput": "none" }
}
```

One output per rule, in array order. `fallbackOutput: "none"` silently drops non-matching items — deliberate choice, not a default to leave unexamined. Use `"extraOutput"` if the else branch does something.

### Schedule Trigger — `n8n-nodes-base.scheduleTrigger`, typeVersion 1.2 (live 2.23)

```json
{ "rule": { "interval": [ { "field": "minutes", "minutesInterval": 15 } ] } }
```

Entry point for the source-polling pattern. **On self-hosted, requires a single always-on instance** — a scaled-to-zero or multi-instance deployment either doesn't fire or fires twice and double-processes a record. On n8n Cloud this is handled for you.

### Webhook — `n8n-nodes-base.webhook`, typeVersion 2.1 (docs)

```json
{ "httpMethod": "POST", "path": "distinctive-path", "authentication": "headerAuth", "responseMode": "onReceived", "options": {} }
```

plus `"credentials": { "httpHeaderAuth": { "name": "Inbound Webhook Auth" } }` and a `"webhookId": "<uuid>"` sibling alongside `parameters`.

- **`authentication` must be `headerAuth` or `basicAuth`, never `none`** unless the instance sits behind a network-level gate you've confirmed. Don't substitute an IF node comparing a header to a hardcoded string: not encrypted at rest, leaks in exports, no rotation path.
- The production path (`/webhook/<path>`) only responds once the workflow is **published**. The canvas's "listen for test event" only serves `/webhook-test/<path>` while the tab is open — easy to test successfully, forget to publish, and have the integration silently do nothing.
- **Paths are global to the instance, not per workflow.** Two workflows on one path conflict and the second won't publish. Give each a distinctive path.
- The base URL differs per deployment (Cloud subdomain vs. self-hosted host). Get it from the node's own panel on that instance — don't construct it.

### Execute Workflow Trigger — `n8n-nodes-base.executeWorkflowTrigger`, typeVersion 1.1 (live 2.23)

```json
{ "inputSource": "passthrough" }
```

Entry point of a per-record sub-workflow. Needs only to be saved, not published, for a parent to call it.

**Never ship this node with empty `parameters`.** A live export can show `{}` and still work, but on import n8n fills the unset field with its current default — "Define using fields below" with zero fields, a schema that accepts nothing. The parent sends the record, the trigger drops it, every downstream node gets no data. Write `inputSource: "passthrough"` explicitly, and tell the consultant to confirm the Input data mode dropdown reads **Accept all data** after import. (Caught live: a Xero migration failed its first dispatched run on exactly this.)

Test it standalone by pinning a realistic input item on this trigger and running from the top — don't try to prove it via the parent.

### Execute Workflow — `n8n-nodes-base.executeWorkflow`, typeVersion 1.2 (live 2.23)

```json
{
  "workflowId": { "__rl": true, "value": "<workflow id>", "mode": "list", "cachedResultName": "Target Workflow Name" },
  "options": {}
}
```

- `workflowId` is a resource locator (`__rl`), not a bare string. The target's ID doesn't exist until the sub-workflow is imported on that instance, so ship a placeholder and make "pick it from the list" a delivery step. One of the few things that genuinely can't be pre-filled.
- Pair with `"onError": "continueRegularOutput"`.
- **`mode: "each"` is deprecated and removed in n8n 3.0** — and on 2.16+ there's an open regression where that mode with *Wait for Sub-Workflow Completion* leaves the parent stuck in "Waiting" forever when more than one item arrives, while sub-executions complete fine. It only surfaces on multi-item runs, the case least likely to be tested. Use the forward-compatible wiring instead: Loop Over Items (batch size 1, `reset: false`) → Execute Workflow in run-once-with-all-items mode → wired back into the loop.

### Loop Over Items (Split In Batches) — `n8n-nodes-base.splitInBatches`, typeVersion 3 (live 2.23)

```json
{ "batchSize": 1, "options": { "reset": false } }
```

Output 0 is "done", output 1 is "loop" — the batch goes out of output 1, and the downstream branch must wire back into this node to continue. `reset: false` matters: with `reset: true` the return wire restarts the loop forever.

Most item lists do not need this node — n8n processes every item natively. Use it for genuinely sequential work, rate limiting, one-record-per-sub-execution dispatch, or a node documented as processing only the first item.

### Error Trigger — `n8n-nodes-base.errorTrigger`, typeVersion 1 (live 2.23)

```json
{}
```

Entry point of the shared error-handler workflow. Fires for any workflow whose Settings → Error Workflow points at it — there's no canvas arrow, it's a per-workflow setting (`settings.errorWorkflow`), and it must be set on **every** workflow in an automation since dispatcher and sub-workflow fail independently. Fires only on automatic/production runs, not manual tests. `$json` carries `execution` (`.error.message`, `.lastNodeExecuted`, `.url`) and `workflow` (`.name`) — guard every field, they can be absent for trigger-time errors.

### Send Email — `n8n-nodes-base.emailSend`, typeVersion 2 (live 2.23)

```json
{ "fromEmail": "={{ $json.emailFrom }}", "toEmail": "={{ $json.emailTo }}",
  "subject": "={{ $json.emailSubject }}", "text": "={{ $json.bodyText }}", "options": {} }
```

Credential type `smtp`. From must equal the authenticated account. Multiple recipients = one comma-separated string. Carries a `webhookId` sibling in real exports. Note: n8n's own system emails use `N8N_SMTP_*` env vars; this node does not read them — the credential is separate even if system email works.

### Sticky Note — `n8n-nodes-base.stickyNote`, typeVersion 1 (live 2.23)

```json
{ "content": "## Markdown text", "height": 300, "width": 400, "color": 5 }
```

Use for the setup checklist, for any non-obvious design decision, and **wherever a fan-out happens** — a fan-out is invisible on the canvas, so mark it or the next person won't see it. Colors in live use: 3 (error handler), 4 (explanatory), 5 (setup checklist).

## AI / structured extraction

Two real options:

- **HTTP Request directly against the provider's API — recommended default.** Depends only on a schema you can verify against public API docs, and uses a node you're already using. Gemini's shape is in `App_Integration_Notes.md`; OpenAI's equivalent is `chat/completions` with `response_format: {type: "json_schema", …}`.
- **LangChain nodes** (`@n8n/n8n-nodes-langchain.informationExtractor` with a chat-model sub-node wired via an `ai_languageModel` connection, not `main`). More native on canvas, but the sub-node connection type and parameter names are worth verifying per version — a wrong `ai_languageModel` wiring imports without error and misbehaves at run time. Also confirm the LangChain package is present on that instance.

Always validate the parsed result in a Code node. Structured output is usually right, never guaranteed: coerce types, sanity-check returned IDs against the real list you sent, fail loudly on garbage.

## Testing & debugging

- **After changing a node, re-run from the trigger** — don't "Execute step" on a downstream node. Execute-step feeds the node its upstream neighbours' cached output, so your fix silently isn't applied and you debug against stale data. This is behind most "I changed it and nothing happened".
- **Pinning** freezes a node's output so you can iterate downstream without re-calling APIs. Dev-only — unpin before going live. Caveat: on a full re-run, un-pinned create nodes fire for real again, so re-running past a point that already created records duplicates them. Pin-and-rerun is safest when what you're fixing sits before any real writes.
- **n8n can't resume a failed run from the node that failed** — "Retry" restarts from the trigger. A failure after real records were written is a manual fix, not a re-run. Design for it: put the dedup write immediately after the anchor record's creation.
- **Importing onto a canvas that already has nodes APPENDS** — n8n suffixes colliding names (`Workflow Config1`) and, since only one trigger is allowed, drops the incoming trigger and orphans the new chain. The dangerous part: existing nodes keep their names, so the chain still wired to the trigger is the OLD version. Tell: a second full copy below the first, every node suffixed `1`. Fix: select all → delete → import, which preserves the workflow ID so a parent's Execute Workflow link survives. For a one-line change, edit in place and don't import.
- Deliberately run the paths a happy-path test skips — already-exists, no-match, a fan-out with 2+ items.
- After a real run, check the destination app and tell workflow output apart from the app's own automations.
- Terminology: n8n 2.0 replaced Active/Inactive with **Publish/Unpublish**; changes autosave as drafts and production runs the *published* version, not the editor's. Say "publish" in delivery notes. `active` is still the JSON field name. On a 1.x client instance, say "activate".

## Stale credentials after an auth-mode switch

Switching an HTTP Request node from Generic Header Auth to a Predefined Credential Type leaves the old `httpHeaderAuth` entry in the node's JSON — invisible in the editor, inert, until someone flips the dropdown back and it silently authenticates as the wrong app or the wrong client. Every node should have exactly one entry under `credentials`. Tell: select the node, copy, paste into a text editor, count entries. Same trick as the hidden-IF-condition check.

## Before you deliver

See `QA_Validation_Checklist.md` for the full list. At minimum: parse the JSON, confirm every connection references a real node name, confirm no duplicate names, syntax-check every Code node's `jsCode`, and walk the connection graph rather than the node list.
