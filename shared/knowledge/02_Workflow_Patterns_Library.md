# Workflow Patterns Library

The architectures this team has built and tested. Check here before inventing a shape — most requests are a variant of something below. Each pattern states when to use it, the node sequence, and the failure it exists to prevent.

## 1. Source polling with a dedup flag

**Use when** an automation should fire off a change in a source system (a deal reaching a stage, a form submission, a record updated) and you don't have — or don't want — a push webhook. **This is the default trigger design.**

**Shape:** Schedule Trigger → Code (build search query) → HTTP Request (search the source) → Code (one item per record) → process → write a flag back onto the record

**How dedup works:** a boolean property on the source record (`clickup_project_created`, `xero_invoicing_complete`). The search excludes ticked records; the workflow ticks it **immediately after the anchor object is created**, not at the end. That placement is deliberate: n8n can't resume a failed run from the failed node, so an early failure should be safely retryable and a late one should be a manual fix rather than a duplicate.

Three details that are easy to get wrong:

- **"Flag not true OR not set" needs two OR'd filter groups.** A bare `NEQ true` misses every record where the property was never set at all. Build `[baseFilters + NEQ true]` and `[baseFilters + NOT_HAS_PROPERTY]` as separate groups.
- **On-entry semantics ≠ currently-in-stage.** "Fires when the record *enters* the stage" is not "*is in* the stage". Reproduce it with a stage-entry timestamp filter (HubSpot: `hs_v2_date_entered_<stageId> >= now - N days`), or the first poll enrols everything already sitting there.
- **The cutover step is part of the deliverable.** Before publishing, records already in scope must be pre-ticked, or the first poll processes the whole backlog. Say this explicitly and give the count if you can.

**Check the recency filter against the stage it's paired with.** A trigger matching several stages with one shared "changed in the last N days" date filter can be near-dead for some of them. Live example: a trigger matched Closed Won *or* Delivery with Close Date in the last 3 days — but Close Date is stamped at Closed Won and deals then sit in Delivery for weeks, so of 182 Delivery deals exactly one fell inside the window. Query the source and count what each condition actually matches rather than reading the filter and assuming.

**Why not n8n's Remove Duplicates node** ("Remove Items Processed in Previous Executions"): it keeps dedup state in n8n's own database, node-scoped, capped (~10,000 items by default). Reject it for anything financial or auditable — it's invisible from the source record (you can't answer "was this deal invoiced?" from the deal), a re-import orphans it, old entries evict, and being boolean it can't express partial completion. It's right for high-volume low-stakes cases where you don't own the source record ("don't re-notify me about this RSS item").

**Reference:** HubSpot Delivery Dispatcher, HubSpot Invoice Dispatcher.

## 2. Dispatcher + per-record sub-workflow

**Use when** a single trigger window can enrol more than one record — which is most of the time, since a user can move several records at once.

**Shape:**

- *Dispatcher:* Schedule → search → one item per record → Loop Over Items (batch 1, `reset: false`) → Execute Workflow (run once with all items) → wired back into the loop
- *Sub-workflow:* Execute Workflow Trigger (`inputSource: "passthrough"`) → all the work for exactly one record

**Why split:** one record per sub-execution keeps every `$('…').first()` valid and removes nested-loop headaches. It also means one bad record doesn't poison the batch (set the Execute Workflow node to `onError: "continueRegularOutput"`).

**Rules:**

- One dispatcher per distinct trigger condition; one sub-workflow per unit of work. The sub-workflow is the reusable asset; the dispatcher is a small template you copy and re-point.
- **Single-source the shared config.** Anything both need — property-name maps, the flag name, IDs — is defined once in the dispatcher and passed in with each record. Two copies drift, and "filled it in one place, not the other" is a hard bug to see.
- Set `settings.errorWorkflow` on **both**. They fail independently.
- Don't use `mode: "each"` on the Execute Workflow node — deprecated, removed in 3.0, and subject to a 2.16+ regression that hangs the parent in "Waiting" on multi-item runs. The loop wiring above is the forward-compatible equivalent.
- Delivery order matters: error handler first, then sub-workflow, then dispatcher — each needs the previous one's ID.

**Reference:** both dispatcher/worker pairs. The Xero pair has the cleaner wiring; copy that one.

## 3. Reconciliation ledger (one record → N side effects)

**Use when** a single source record produces several things that must each exist exactly once — three invoices, five tasks, a set of emails. A boolean "done" flag cannot express "2 of 3 exist", so a failure halfway through leaves no safe state: tick early and the remainder is lost forever, tick late and a re-run duplicates what already worked.

**Shape:** record which sub-units completed — a multi-line text property on the source record, one line per unit, prefixed with its index: `2/3 | INV-0042 | <id>`. Every run computes `remaining = expected − recorded` and creates only the gap.

**Why it's worth the effort:**

- A re-run after full success is a no-op.
- A re-run after partial failure creates only what's missing.
- The recovery path is the same code path as a first run, so it's exercised by normal operation instead of discovered broken the day you need it.

Pair it with a cheap boolean the dispatcher's search can filter on (most search APIs can't count lines in a text field and compare to another property) — **but never let the worker trust that boolean.** The worker always recomputes from the ledger, so a wrong flag costs a wasted sub-execution rather than a duplicate invoice.

**Order the writes: record what succeeded, THEN alert.** On a partial failure, write the successful IDs back before throwing. Alerting first and failing the run means the next poll duplicates whatever worked.

**Reference:** Deal Closed -> Xero Invoices (Plan Invoice Run, Check Invoice Results, Write Invoice Record To Deal).

## 4. Shared error handler

**Use always.** n8n surfaces nothing when a production run fails — no email, no notification, nothing but a row in the executions list nobody is watching. This is a required part of every automation, not an extra.

**Shape:** Error Trigger → Code (build message) → two or more alert channels in parallel (chat + email off the one build node, so a dead transport doesn't silence alerts).

**Rules:**

- One handler per instance, referenced by ID from every other workflow's `settings.errorWorkflow`. There is no canvas arrow — it's a setting, and it's the thing most often forgotten on the second workflow of a pair.
- It fires **only on automatic/production runs**. Manual test runs show errors in the editor instead, which is why "I tested it and the alert didn't come" is usually not a bug.
- Guard every field from the trigger payload — `execution` and `workflow` keys can be absent for trigger-time errors.
- If a transport itself fails there's no further alert for that branch. Accept it; don't nest error handlers.
- The workflow ID is instance-specific: on a new client, this is the first thing imported and its ID feeds every other delivery step.

**Reference:** Error Handler - Post to ClickUp.

## 5. Config node

**Use always.** One Code node immediately after the trigger holding every environment-specific value: IDs, internal property names, enum maps, model strings, custom field UUIDs, user maps, thresholds. Everything downstream reads from it by reference.

Two reasons beyond tidiness: it's the only place a consultant has to look when a client renames a pipeline or moves a space, and on a handover it's the documentation. Comment each value with where it came from.

In a dispatcher/sub-workflow pair, the config lives in the dispatcher and travels with each record.

## 6. Payload builder + HTTP pair

**Use when** a create or update call needs many dynamic fields — custom fields, conditional values, computed dates. A Code node builds the JSON body; an HTTP Request node sends it.

This is the norm for anything custom-field-heavy, not an exception. It's more reliable than a long inline expression, it's debuggable (you can see the exact body in the Code node's output), and it's editable by someone who doesn't write n8n expressions.

**Naming:** the HTTP node takes the business name (`Create Master Project Task`); the Code node is `Build Master Task Payload`. The pair reads as one step on the canvas.

Drop blank values before sending — a single empty custom field can make an API reject an otherwise valid create.

## 7. Structured AI extraction

**Use when** a step requires judgement that rules can't express: matching a company name to an existing folder despite spelling differences, classifying free text, extracting fields from a message.

**Shape:** Code (build request) → HTTP Request (call model with a response schema) → Code (parse and validate) — three nodes, one logical step.

**Rules:**

- Use the cheapest model that does the job. Classification and matching run on a flash/mini tier for cents a month.
- Request structured output via the provider's schema mechanism, not by asking nicely in the prompt.
- **Always validate the parsed result.** Coerce types, check any returned ID against the real list you sent, and throw on garbage. Never let unvalidated model output reach a create call.
- Keep the model string in the Config node — a 404 at run time is almost always a wrong model name, and that makes it a one-line fix.

**Reference:** Match Deal To Client Folder cluster in the ClickUp worker.

## 8. Batch write to a single API call

**Use when** the destination API accepts an array (Xero's `POST /Invoices`, HubSpot's batch endpoints, ClickUp's bulk operations). One call replaces a fan-out, which removes the entire `.first()`/`.item` bug class along with it.

**The trap:** a batch endpoint with partial-failure semantics returns HTTP 200 even when individual records were rejected. A node that only checks the status code calls a failed batch a success. Inspect each returned record's own status/validation errors, and **guard the positional mapping** — if the count returned differs from the count submitted, you can't tell which result belongs to which input, so record nothing and alert.

Respect the API's concurrency limit (Xero: 5 in-flight calls) and batch to stay inside it.

## 9. Webhook-triggered workflow

**Use when** push latency genuinely matters and the source app can call out. Otherwise poll — polling is free, stateless from the source app's perspective, and doesn't need a developer app.

**Rules:** authentication is `headerAuth` or `basicAuth`, never `none`, unless you've confirmed a network-level gate in front of the instance. The path is global to the instance, so make it distinctive. The production path only answers once published. Get the base URL from the node's own panel on that instance.

For HubSpot specifically, the three options and their trade-offs:

| Option | How it works | Cost / prerequisites | Watch out for |
|---|---|---|---|
| **Polling (Schedule + Search) — default** | n8n polls and searches for matching records | None | Not instant; you handle dedup |
| **Native Webhooks API** | HubSpot pushes property-change events | Free on any tier, but needs a developer/public app | Delivers only the changed property + record ID (add a get-record call); one target URL per app, so multiple webhook workflows need a router |
| **"Send a webhook" workflow action** | A HubSpot workflow posts a full payload | Data Hub Professional (~$720+/mo) | Don't buy Data Hub for this alone |

## 10. Ordering side effects around the destination app's own automations

Not a node shape — a sequencing rule that comes up on nearly every build and is invisible in the request.

If the destination app fires an automation on a status change, and that automation reads fields the workflow is still populating, **create the record in a holding status and flip it to the trigger status as the last single-item step, before any fan-out.** Otherwise the automation fires on a half-filled record. A record stuck in the holding status is also a useful "the build didn't finish" marker.

A status write placed *after* a fan-out re-fires the automation once per item. That's a real bug from a live build, not a hypothetical.

Always ask what reacts to creates, edits and status changes in the destination app before finalising order.
