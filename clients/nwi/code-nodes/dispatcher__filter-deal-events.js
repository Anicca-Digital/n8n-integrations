// HubSpot Webhooks API posts a JSON array of events (up to 100 per call).
// Keep only "deal moved to Closed Won" events and de-duplicate by deal ID.
const cfg = $('Workflow Config').first().json;
const body = $('Receive HubSpot Deal Events').first().json.body;
const events = Array.isArray(body) ? body : [];
const seen = new Set();
const out = [];
for (const e of events) {
  if (e.subscriptionType !== 'deal.propertyChange') continue;
  if (e.propertyName !== 'dealstage' || e.propertyValue !== cfg.closedWonStageId) continue;
  const dealId = String(e.objectId || '').trim();
  if (!dealId || seen.has(dealId)) continue;
  seen.add(dealId);
  out.push({ json: { dealId } });
}
return out;
