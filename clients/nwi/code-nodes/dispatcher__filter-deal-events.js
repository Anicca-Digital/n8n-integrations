// HubSpot Webhooks API posts a JSON array of events (up to 100 per call).
// Keep only "deal moved to Closed Won" events and de-duplicate by deal ID.
const cfg = $('Workflow Config').first().json;
const body = $('Receive HubSpot Deal Events').first().json.body;
const events = Array.isArray(body) ? body : [];
const seen = new Set();
const out = [];
for (const e of events) {
  // Legacy apps send 'deal.propertyChange'; developer-platform projects send 'object.propertyChange' + objectTypeId 0-3.
  const isDealChange = e.subscriptionType === 'deal.propertyChange'
    || (e.subscriptionType === 'object.propertyChange' && e.objectTypeId === '0-3');
  if (!isDealChange) continue;
  if (e.propertyName !== 'dealstage' || e.propertyValue !== cfg.closedWonStageId) continue;
  const dealId = String(e.objectId || '').trim();
  if (!dealId || seen.has(dealId)) continue;
  seen.add(dealId);
  out.push({ json: { dealId } });
}
return out;
