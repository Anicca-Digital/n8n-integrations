# QA / Validation Checklist

Run through this before calling any build done. If code execution is available, the "automated" items should actually be run, not eyeballed.

## Structural (automated)

Run `python3 shared/tools/validate_workflow.py <file.json>` first. It covers most of this section mechanically, including the two graph checks that reading the JSON reliably misses. Anything it reports as **ERROR** is a defect; **WARN** and **INFO** need a human decision, not a reflex fix. It cannot judge typeVersion suitability, credential names, or whether the logic matches the spec — those stay below and stay manual.

- [ ] File parses as valid JSON.
- [ ] Every node has a unique `name`.
- [ ] Every `connections` source key matches a real node name.
- [ ] Every `{"node": "..."}` inside `connections` matches a real node name.
- [ ] Every node except the trigger and sticky notes has at least one incoming connection.
- [ ] Every Code node's `jsCode` passes a JS syntax check (`node --check`).
- [ ] Every `httpRequest` node's `url`/`jsonBody` expressions have balanced `{{ }}`, and the JS inside is syntactically valid.
- [ ] Any object-literal expression is wrapped in parentheses (`={{ ({...}) }}`).
- [ ] No expression value has a doubled `=` prefix (`= =…`) — a paste artifact that corrupts the resolved value.
- [ ] No node's `typeVersion` was guessed. Each is either verified against an export from the target instance or against docs.n8n.io for that instance's version.
- [ ] Every Code node downstream of a fan-out is `runOnceForEachItem`, and cross-references to other fanned-out nodes use `.item`, not `.first()`. *(Silent when wrong.)*
- [ ] No `$('X')` reference points at a node that isn't a true upstream ancestor on every path that reaches the referencing node (the conditional-branch "hasn't been executed" trap).
- [ ] Every IF downstream of an HTTP Request that tests your own computed data references its source node explicitly (`$('Node').first().json.x`), never bare `$json`. *(Bare `$json` is correct when the IF deliberately tests that HTTP node's own response — read the intent, don't flag every instance.)*
- [ ] Every dropdown/select custom field sends the option's ID, not the display label.
- [ ] No Code node contains a `\U` escape — JS has none, so it silently ships literal text.
- [ ] Every node has exactly one entry under `credentials`, and no `id` field.
- [ ] `retryOnFail` appears only on reads and idempotent writes, never on a create call.
- [ ] Any step that must run once per record (status flip, dedup-flag write) is before the fan-out, not after it.
- [ ] Every `executeWorkflowTrigger` sets `inputSource: "passthrough"` — empty `parameters` imports as a zero-field schema that accepts nothing.
- [ ] No `executeWorkflow` node uses `mode: "each"`.
- [ ] Every `splitInBatches` used as a loop has `reset: false` and a return wire.
- [ ] Every workflow in the automation has `settings.errorWorkflow` set, or a delivery step telling the consultant to set it (dispatcher **and** sub-workflow — they fail independently).
- [ ] `"active": false`.

## Spec conformance

- [ ] Every line of the approved Build Spec maps to something in the output — nothing silently dropped, nothing added that wasn't agreed.
- [ ] Every branch in the spec exists, with the same number of real branches plus correct fallback behaviour.
- [ ] Each IF/Switch routes the right way — the true case reaches the intended branch, and the condition reads the same direction as the node's name (no double negatives).
- [ ] No IF node holds a hidden extra condition (count entries under `conditions`).
- [ ] Every truthiness test uses the type-safe form (`String(...)` + unary boolean).
- [ ] Every loop is handled deliberately — native item processing vs. Loop Over Items — matching whether order and rate limits actually matter.
- [ ] The dedup mechanism matches what was agreed, and a partial failure leaves the state the spec says it should.
- [ ] The trigger's filter conditions match the spec exactly, including the backlog-exclusion filter.
- [ ] Any judgement call made where the spec was silent is listed in the delivery notes, not left implicit.

## Client isolation

- [ ] No ID, property name, credential name or URL from another client's build appears anywhere in the output.
- [ ] Every resolved value came from this client's system (or is a flagged placeholder), not from the reference workflows or `Build_Records.md`.
- [ ] typeVersions are appropriate for this instance's n8n version.

## Security

- [ ] No literal API key, token, or password appears anywhere in the output JSON.
- [ ] Every credential-shaped value found in any material the consultant shared is called out, with a note to rotate it if it was ever in a plaintext file.
- [ ] Credentials are referenced by name and type only (no fabricated `id`).
- [ ] Every Webhook node has `authentication` set to `headerAuth` or `basicAuth`.

## Testing (do this, don't assume)

- [ ] Tested by running from the trigger, not "Execute step" on a downstream node (which replays cached upstream data and hides the fix).
- [ ] Ran each branch, including the ones a happy-path test skips — already-exists, no-match, a fan-out with 2+ items.
- [ ] Unpinned anything pinned during development.
- [ ] Sub-workflows tested standalone with a pinned realistic input on their Execute Workflow Trigger — not proven only via the parent.
- [ ] After a real run, checked the result in the destination app, and told workflow output apart from the app's own automations.
- [ ] Any automated dry-run walked the **connection graph**, not just the node list. Testing Code nodes in isolation with hand-fed input passes even when the next node reads the wrong source — exactly how a live `$json`-after-HTTP bug survived a clean validation run.
- [ ] After importing, confirmed the canvas holds one copy of the flow (no `NodeName1` suffixes).
- [ ] Clicked into every credentialed node and confirmed no "not connected" warning remains (n8n sometimes auto-relinks and looks fine; a silently-unlinked node fails at run time, not import time).

## Completeness of the deliverable

- [ ] The `.json` file(s) present are the ones actually validated above, not an earlier draft.
- [ ] A sticky note on the canvas states the manual-completion checklist.
- [ ] The chat response also states it — don't rely on the consultant opening the file.
- [ ] Import order is stated where there's more than one file (error handler → sub-workflow → dispatcher).
- [ ] The cutover action is stated (pre-ticking the dedup flag on records already in scope).
- [ ] Every placeholder left in the file is listed, with where to find the value.
- [ ] Any design decision with more than one reasonable option is explained, with the alternatives noted.
- [ ] New knowledge from this build is proposed as an addition to the relevant knowledge-base doc.
