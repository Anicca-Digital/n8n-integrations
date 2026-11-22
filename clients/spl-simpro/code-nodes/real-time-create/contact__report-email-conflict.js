// Node: Report Email Conflict   ([SPL] Simpro -> HubSpot (Real Time))
// A NEW Simpro contact whose email already belongs to a HubSpot contact is NOT created or merged:
// the email and the Simpro ID must match. Fail loudly so the error workflow can alert, then fix it in HubSpot.
const hit = ($input.first().json.results ?? [])[0] ?? {};
const c = $('Get Simpro Contact').first().json;
throw new Error('Contact ' + c.ID + ' (' + c.Email + ') was NOT created: that email already belongs to HubSpot contact '
  + hit.id + ' (simpro_contact_id: ' + ((hit.properties && hit.properties.simpro_contact_id) || 'none')
  + '). Email and Simpro ID must match - resolve it in HubSpot, then re-run.');
