// Node: Workflow Config   ([SPL] HubSpot -> Simpro (Real Time))
// Single source of truth for this workflow: edit values HERE only.
// Also turns the HubSpot webhook payload into the list of records to look at. HubSpot can send SEVERAL events in one
// call, so every event is read (not just the first). Only company, contact and Site events are handled; deal events
// (quotes and jobs), deletions and anything else are ignored. If nothing is left, the run ends here on purpose.
const CONFIG = {
  // --- TEST MODE: while true, only TEST records are created in Simpro. Set to false to create everything. ---
  testOnly: true,
  // A record is a test record when its name starts with namePrefix OR its own email domain is in emailDomains (case-insensitive).
  testRecords: { namePrefix: 'HSTEST-', emailDomains: ['aniccadigital.io', 'spl.com.au'] },
  hubspotApiBase: 'https://api.hubapi.com',
  simproBaseUrl: 'https://spl.simprosuite.com/api/v1.0',
  // --- What is handled: HubSpot object, the property holding the Simpro ID, and the properties needed for Simpro ---
  types: {
    company: {
      path: 'crm/objects/2026-09/companies', assoc: 'companies', idProperty: 'simpro_customer_id', nameFields: ['name'], emailField: 'email',
      properties: ['simpro_customer_id', 'name', 'address', 'city', 'zip', 'state', 'phone', 'website', 'country', 'email', 'abn', 'billing_address', 'billing_city', 'billing_state', 'billing_postalcode', 'billing_zip', 'billing_country'],
    },
    contact: {
      path: 'crm/objects/2026-09/contacts', assoc: 'contacts', idProperty: 'simpro_contact_id', nameFields: ['firstname', 'lastname'], emailField: 'email',
      properties: ['simpro_contact_id', 'firstname', 'lastname', 'email', 'phone', 'salutation', 'department', 'jobtitle'],
    },
    site: {
      path: 'crm/objects/2026-09/0-420', assoc: '0-420', idProperty: 'simpro_site_id', nameFields: ['hs_name'], emailField: null,
      properties: ['simpro_site_id', 'hs_name', 'hs_address_1', 'hs_city', 'hs_zip', 'country', 'zone', 'hs_state_province', 'billing_address', 'billing_state', 'billing_city', 'billing_postal_code'],
    },
  },
};

const body = $input.first().json.body;
const events = Array.isArray(body) ? body : [];
const typeOf = (e) => {
  const st = String(e.subscriptionType ?? '');
  if (st.includes('deletion')) return null;                       // the record is gone
  if (e.objectTypeId === '0-420') return 'site';
  if (st.startsWith('company') || e.objectTypeId === '0-2') return 'company';
  if (st.startsWith('contact') || e.objectTypeId === '0-1') return 'contact';
  return null;                                                      // deals (quotes and jobs) and everything else
};
const seen = new Set();
const records = [];
let ignored = 0;
for (const e of events) {
  const type = typeOf(e || {});
  if (!type || e.objectId === undefined || e.objectId === null) { ignored++; continue; }
  const key = type + ':' + e.objectId;
  if (seen.has(key)) continue; // the same record twice in one call
  seen.add(key);
  records.push({ type, hsId: String(e.objectId) });
}
if (records.length === 0) return [];
$execution.customData.set('records', records.map(r => r.type + ':' + r.hsId).join(', ').slice(0, 250));
return [{ json: { ...CONFIG, records, ignored } }];
