// Node: Check Is New   ([SPL] Simpro -> HubSpot (Real Time))
// Real Time only CREATES. A record that is already in HubSpot ends here on purpose (no item out): updates are
// the job of the 30-minute sync workflows. A contact needs its email AND Simpro ID to match: a NEW Simpro contact
// whose email already belongs to another HubSpot contact is not created or merged, the run fails loudly.
const cfg = $('Workflow Config').first().json;
const rec = $('Get Simpro Record').first().json;
const hits = $input.first().json.results;
if (!Array.isArray(hits)) throw new Error('Unexpected HubSpot search response (no results array): ' + JSON.stringify($input.first().json).slice(0, 200));
const idProperty = cfg.objects[cfg.type].idProperty;

if (cfg.type !== 'contact') {
  return hits.length ? [] : [{ json: { isNew: true } }];
}
if (hits.some(h => String(h.properties && h.properties[idProperty]) === String(rec.ID))) return []; // already there
if (hits.length) {
  const other = hits[0];
  throw new Error('Contact ' + rec.ID + ' (' + rec.Email + ') was NOT created: that email already belongs to HubSpot contact '
    + other.id + ' (simpro_contact_id: ' + ((other.properties && other.properties[idProperty]) || 'none')
    + '). Email and Simpro ID must match - resolve it in HubSpot, then re-run.');
}
return [{ json: { isNew: true } }];
