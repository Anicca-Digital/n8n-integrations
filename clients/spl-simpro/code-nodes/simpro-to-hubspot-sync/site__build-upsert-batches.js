// Node: Build Upsert Batches   ([SPL] Simpro -> HubSpot Sites Sync)
// Simpro site -> HubSpot Site (0-420), keyed on the unique property simpro_site_id.
// Same property mapping as [SPL] Upsert Site in HubSpot. One batch call per 100 sites.
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const inputs = records.map((site) => ({
  idProperty: cfg.idProperty,
  id: String(site.ID), // the unique ID property is set from this on create
  properties: keep({
    hs_name: site.Name,
    hs_address_1: site.Address?.Address,
    hs_city: site.Address?.City,
    hs_state_province: site.Address?.State,
    hs_zip: site.Address?.PostalCode,
    country: site.Address?.Country,
    zone: site.Zone?.ID,
    billing_address: site.BillingAddress?.Address,
    billing_city: site.BillingAddress?.City,
    billing_state: site.BillingAddress?.State,
    billing_postal_code: site.BillingAddress?.PostalCode,
  }),
}));

return chunk(inputs, cfg.hubspotBatchSize).map((part, n) => ({
  json: { url: cfg.objectUrl + '/batch/upsert', body: { inputs: part }, meta: { kind: 'upsert', batch: n + 1, count: part.length } },
}));
