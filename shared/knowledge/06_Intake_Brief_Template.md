# Intake Brief Template

Fill this in before starting a build, or paste it in blank and let Claude walk you through it. Anything left empty becomes an assumption Claude has to make and flag — which is fine, as long as it's deliberate.

The purpose is to catch the things that are invisible from the outside: what else reacts in the destination app, what must never happen twice, and what's deliberately left alone.

## 0. What to attach

Attach whatever exists — a diagram or a mapping sheet usually answers half the questions below faster than prose does. In rough order of usefulness:

- **An export of any existing workflow from this client's n8n instance.** The single highest-value attachment even if it's unrelated to this build: it carries the instance's real node versions, credential names and settings. If it's a brand-new instance, say so. (In the repo: existing workflow JSON in `clients/<client>/workflows/` counts.)
- **A process diagram** — Miro, Lucidchart, a whiteboard photo, a flowchart in a doc. Say which parts are agreed and which are still a sketch.
- **A field-mapping sheet** — source field → destination field, with any transformation. If one exists, it's the spec for most of the build.
- **Screenshots** of the source and destination records: the HubSpot deal with its properties visible, the ClickUp task template, the invoice layout. Screenshots settle "which field do you mean" instantly.
- **A sample record end to end** — one real (or realistic) example, with the values it should produce in the destination system. This is the best possible test case and doubles as the acceptance criterion.
- **Existing automations that touch the same records**: an exported HubSpot workflow, a Zap, a screenshot of the automation list in the destination app.
- **API docs or a Postman collection** for anything bespoke or niche — an in-house system, a small vendor, a regional app.
- **The SOW or scope note**, if the automation was scoped commercially and there's wording you're being held to.

If a diagram and this brief disagree, say which one wins.

## 1. Client and instance

- Client:
- n8n instance: Cloud / self-hosted (who manages it?)
- n8n version: (bottom-left of the editor)
- Single always-on instance? (Self-hosted only — schedule triggers don't fire on a scaled-to-zero service and fire twice on a multi-instance one.)
- Community nodes / LangChain package installed?
- Who owns this workflow after handover? Us / the client / joint

## 2. What should happen, in one sentence

e.g. "When a deal reaches Closed Won, raise the agreed number of draft invoices in Xero."

## 3. Trigger

- What fires it? A record changing in an app / a schedule / an inbound call from another system
- Which record, in which system, and what exact condition? (Stage, status, property value, form)
- How soon does it need to run after the event? Minutes are fine / near-instant matters
- Can more than one record qualify at the same time? (If yes, expect a dispatcher + per-record sub-workflow.)
- What should happen to records that already meet the condition today? (There's almost always a backlog. If they shouldn't be processed, that's a cutover step before publishing.)

## 4. What the automation does

List the actions in order, in plain language. For each: which system, what gets created or changed, and where the values come from.

- Which of these must never happen twice? (Invoices, emails, payments, anything a client sees.)
- Is anything conditional? What's the condition, and what happens when it isn't met?
- Is anything repeated per item in a list? What list, and how long does it typically get?

## 5. The destination app's own behaviour — the questions that get missed

- Does anything in the destination app react when a record is created, edited, or changes status? Automations, notifications, integrations, Zaps, list templates.
- Is any field deliberately left unset because something else fills it? (An automation supplying a value looks exactly like a gap in the brief. Getting this wrong doubles values up.)
- Does a record need to visibly pass through an in-between state — for reporting, an audit trail, or someone watching a board?
- Are there existing automations touching the same records? Anything already running in n8n, HubSpot workflows, Zapier, Make.

## 6. Failure and recovery

- If it fails halfway, what should be left behind? Nothing / the part that succeeded, recorded so a re-run finishes the job
- Is it safe to run the same record twice? If not, what stops it?
- Who should be alerted on failure, and how? Email / chat channel / both
- Is there an error-handler workflow on this instance already?

## 7. Constraints

- Rate limits, per-call costs, or licence limits on any system involved
- Volume: roughly how many records per day/week
- Anything that must not be touched — fields, records, statuses

## 8. Credentials

- Which apps does this touch?
- For each: does a working credential already exist on the instance, and what is its exact name?
- If not, who creates it — us or the client?

## 9. Done means

- How will you check it worked? Which screen in which app, showing what.
- What would tell you it worked but wrongly? (The subtle failures — a value in the wrong field, an automation firing twice.)
