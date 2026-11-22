// Node: Build Upsert Batches   ([SPL] Simpro -> HubSpot Companies Sync)
// Simpro company customer -> HubSpot company, keyed on the unique property simpro_customer_id.
// Same property mapping as [SPL] Upsert Company in HubSpot. One batch call per 100 companies.
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const inputs = records.map((customer) => ({
  idProperty: cfg.idProperty,
  id: String(customer.ID), // the unique ID property is set from this on create
  properties: keep({
    name: customer.CompanyName,
    address: customer.Address?.Address,
    city: customer.Address?.City,
    state: customer.Address?.State,
    zip: customer.Address?.PostalCode,
    country: customer.Address?.Country,
    billing_address: customer.BillingAddress?.Address,
    billing_city: customer.BillingAddress?.City,
    billing_state: customer.BillingAddress?.State,
    billing_zip: customer.BillingAddress?.PostalCode,
    billing_country: customer.BillingAddress?.Country,
    phone: customer.Phone,
    website: customer.Website,
    email: customer.Email,
    abn: customer.EIN,
  }),
}));

return chunk(inputs, cfg.hubspotBatchSize).map((part, n) => ({
  json: { url: cfg.objectUrl + '/batch/upsert', body: { inputs: part }, meta: { kind: 'upsert', batch: n + 1, count: part.length } },
}));
