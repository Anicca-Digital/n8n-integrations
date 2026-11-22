// Node: Build Dependent Writes   (companies, sites, quotes and jobs)
// Everything that needs the record's Simpro ID to exist first, in one list (items run in order):
//   companies: link the company to its sites that are in Simpro (only ADD, never remove)
//   sites:   link the site to its customers (only ADD, never remove) and set its primary contact only when Simpro has none
//   quotes:  the Tender Number / Tender Status / Vertical custom fields, only when they differ
//   deals:   line items -> Simpro cost centers: update the ones whose price/name differ, create the new ones in the
//            deal's first section. Price is the GST-EXCLUSIVE total (cfg.costCenterTotalField).
const cfg = $('Build Sync Window').first().json;
const plan = $('Resolve Plan').first().json.records;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } }; // [] when that stage did not run
const live = (name) => safeAll(name).filter(i => !(i.json && i.json.skip));
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
// What Simpro holds today for each record we are updating (from Read from Simpro)
const current = {};
{ const reqs = live('Build Simpro Reads');
  live('Read from Simpro').forEach((item, k) => { const m = reqs[idxOf(item, k)].json.meta; const r = item.json ?? {}; if (r.statusCode === 200) current[m.hsId] = r.body; }); }
// Simpro IDs created in this run (from Write Records to Simpro)
const created = {};
{ const reqs = live('Build Record Writes');
  live('Write Records to Simpro').forEach((item, k) => { const m = reqs[idxOf(item, k)].json.meta; const r = item.json ?? {};
    if (m.kind === 'create' && (r.statusCode === 200 || r.statusCode === 201) && r.body && r.body.ID !== undefined) created[m.hsId] = String(r.body.ID); }); }
const finalId = (rec) => rec.simproId ?? created[rec.hsId] ?? null;
const recordUrl = (rec) => rec.createUrl.replace(/\/$/, '') + '/' + finalId(rec);


const norm = (v) => (v === null || v === undefined) ? '' : String(v).trim();
const warnings = [];
const writes = [];

// sections and cost centers read for each deal
const secReqs = live('Build Section Reads');
const sectionsOf = {};
live('Read Sections').forEach((item, k) => {
  const m = secReqs[idxOf(item, k)].json.meta; const r = item.json ?? {};
  if (r.statusCode === 200 && Array.isArray(r.body)) sectionsOf[m.hsId] = r.body.filter(s => s && s.ID !== undefined).map(s => s.ID);
});
const ccReqs = live('Build Cost Center Reads');
const costCenters = {}; // hsId -> { costCenterId: { sectionId, cur } }
live('Read Cost Centers').forEach((item, k) => {
  const m = ccReqs[idxOf(item, k)].json.meta; const r = item.json ?? {};
  if (r.statusCode === 200 && Array.isArray(r.body)) for (const c of r.body) (costCenters[m.hsId] = costCenters[m.hsId] ?? {})[String(c.ID)] = { sectionId: m.sectionId, cur: c };
});

for (const rec of plan) {
  const id = finalId(rec);
  if (!id) continue; // the create failed: reported by Finish Run
  const cur = current[rec.hsId];

  if (cfg.recordType === 'company' && rec.links) {
    const haveSites = ((cur && cur.Sites) || []).map(s => Number(s.ID));
    const addSites = rec.links.sites.filter(s => !haveSites.includes(s));
    if (addSites.length) writes.push({ json: { method: 'PATCH', url: recordUrl(rec), body: { Sites: [...haveSites, ...addSites] }, meta: { hsId: rec.hsId, kind: 'companySites' } } });
  }

  if (cfg.recordType === 'site' && rec.links) {
    const haveCustomers = ((cur && cur.Customers) || []).map(c => Number(c.ID));
    const addCustomers = rec.links.customers.filter(c => !haveCustomers.includes(c));
    const havePrimary = cur && cur.PrimaryContact && cur.PrimaryContact.Contact && cur.PrimaryContact.Contact.ID;
    const body = {};
    if (addCustomers.length) body.Customers = [...haveCustomers, ...addCustomers];
    if (rec.links.primaryContact && !havePrimary) body.PrimaryContact = { Contact: Number(rec.links.primaryContact) };
    if (Object.keys(body).length) writes.push({ json: { method: 'PATCH', url: recordUrl(rec), body, meta: { hsId: rec.hsId, kind: 'siteLinks' } } });
  }

  if (cfg.recordType === 'quote') {
    for (const cf of rec.customFields) {
      const have = ((cur && cur.CustomFields) || []).find(f => f.CustomField && Number(f.CustomField.ID) === Number(cf.id));
      if (norm(cf.value) === norm(have && have.Value)) continue;
      writes.push({ json: { method: 'PATCH', url: recordUrl(rec) + '/customFields/' + cf.id, body: { Value: cf.value }, meta: { hsId: rec.hsId, kind: 'customField', field: cf.id } } });
    }
  }

  if (cfg.recordType === 'quote' || cfg.recordType === 'job') {
    for (const li of rec.lineItems) {
      if (li.cost_centre === undefined || li.cost_centre === null || li.cost_centre === '' || li.price === undefined || li.price === null || li.price === '') {
        warnings.push({ hsId: rec.hsId, lineItem: li.id, reason: 'line item has no cost centre or price - not sent' }); continue;
      }
      const body = { CostCenter: Number(li.cost_centre), Name: li.name ?? '', Total: { [cfg.costCenterTotalField]: Number(li.price) } };
      const existing = li.simpro_id && costCenters[rec.hsId] ? costCenters[rec.hsId][String(li.simpro_id)] : null;
      if (existing) {
        const c = existing.cur;
        const curPrice = c.Total ? c.Total[cfg.costCenterTotalField] : undefined;
        const curName = c.Name ?? (c.CostCenter && c.CostCenter.Name);
        const curCc = c.CostCenter && c.CostCenter.ID;
        const differs = Math.abs(Number(curPrice) - Number(li.price)) > 0.005 || isNaN(Number(curPrice)) || norm(curName) !== norm(li.name) || Number(curCc) !== Number(li.cost_centre);
        if (differs) writes.push({ json: { method: 'PATCH', url: recordUrl(rec) + '/sections/' + existing.sectionId + '/costCenters/' + li.simpro_id, body, meta: { hsId: rec.hsId, kind: 'costCenterUpdate', lineItem: li.id } } });
      } else {
        const section = (sectionsOf[rec.hsId] ?? [])[0];
        if (section === undefined) { warnings.push({ hsId: rec.hsId, lineItem: li.id, reason: 'the Simpro record has no section yet - line item not sent' }); continue; }
        writes.push({ json: { method: 'POST', url: recordUrl(rec) + '/sections/' + section + '/costCenters/', body, meta: { hsId: rec.hsId, kind: 'costCenterCreate', lineItem: li.id, sectionId: section } } });
      }
    }
  }
}
if (warnings.length) $execution.customData.set('skippedLineItems', warnings.map(w => w.hsId + ':' + w.lineItem).join(', ').slice(0, 250));
if (writes.length === 0) return [{ json: { skip: true } }];
return writes;
