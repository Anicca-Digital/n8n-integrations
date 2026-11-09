// One execution per webhook call. HubSpot posts a JSON array of events; keep the "Closed Won? ticked" ones.
const hs = $('Workflow Config').first().json.hubspot;
const body = $('Receive HubSpot Deal Events').first().json.body;
const events = Array.isArray(body) ? body : [];
const ids = [];
for (const e of events) {
  // Legacy apps send 'deal.propertyChange'; developer-platform projects send 'object.propertyChange' + objectTypeId 0-3.
  const isDealChange = e.subscriptionType === 'deal.propertyChange'
    || (e.subscriptionType === 'object.propertyChange' && e.objectTypeId === '0-3');
  if (!isDealChange) continue;
  if (e.propertyName !== hs.triggerProperty || String(e.propertyValue).toLowerCase() !== hs.triggerValue) continue;
  const id = String(e.objectId || '').trim();
  if (id && !ids.includes(id)) ids.push(id);
}
if (ids.length === 0) return [];   // not a "ticked" event (e.g. un-tick): end quietly
if (ids.length > 1) {
  // This workflow handles one deal per run. Fail loudly rather than silently drop deals.
  throw new Error(`Webhook call carried ${ids.length} closed-won deals (${ids.join(', ')}); this workflow handles one per run.`);
}
return [{ json: { dealId: ids[0] } }];
