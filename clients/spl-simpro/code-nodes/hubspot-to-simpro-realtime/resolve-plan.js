// Node: Resolve Plan   ([SPL] HubSpot -> Simpro (Real Time))
// For each record to create: where to create it in Simpro, the body (same field mapping as the old
// [SPL] Upsert ... in Simpro sub-workflows), and the Simpro IDs of what it links to. A record that cannot be created
// yet because its parent is not in Simpro (a contact whose company has no Simpro ID) is listed under `skipped`,
// never created half-linked. Related records are never created here. One state item out.
const cfg = $('Workflow Config').first().json;
const { records } = $('Prepare Records').first().json;
const base = cfg.simproBaseUrl;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } };
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;

// what each record is linked to in HubSpot: assoc[type][to][hubspotId] = [{ id, types:Set(typeId) }]
const assoc = { contact: { companies: {} }, site: { companies: {}, contacts: {} } };
const assocReqs = safeAll('Build Association Reads');
safeAll('Read Associations').forEach((item, k) => {
  const meta = assocReqs[idxOf(item, k)].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return;
  for (const row of ((r.body && r.body.results) || [])) {
    assoc[meta.type][meta.to][String(row.from.id)] = (row.to ?? []).map(t => ({ id: String(t.toObjectId), types: new Set((t.associationTypes ?? []).map(a => Number(a.typeId))) }));
  }
});
// the Simpro ID of each related record
const simproOf = { companies: {}, contacts: {} };
const idProp = { companies: cfg.types.company.idProperty, contacts: cfg.types.contact.idProperty };
const relReqs = safeAll('Build Related Reads');
safeAll('Read Related Objects').forEach((item, k) => {
  const meta = relReqs[idxOf(item, k)].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return;
  for (const x of ((r.body && r.body.results) || [])) {
    const v = x.properties && x.properties[idProp[meta.to]];
    if (!blank(v)) simproOf[meta.to][String(x.id)] = String(v);
  }
});
const related = (type, hsId, to, preferType) => {
  const list = ((assoc[type][to] ?? {})[hsId] ?? []).filter(t => simproOf[to][t.id] !== undefined);
  const preferred = preferType ? list.filter(t => t.types.has(preferType)) : [];
  return [...preferred, ...list.filter(t => !preferred.includes(t))].map(t => simproOf[to][t.id]);
};
const notInSimpro = (type, hsId, to) => (((assoc[type][to] ?? {})[hsId]) ?? []).filter(t => simproOf[to][t.id] === undefined).length;
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)));

const plan = [];
const skipped = [];
for (const rec of records) {
  const p = rec.props;
  const out = { type: rec.type, hsId: rec.hsId, name: '', createUrl: null, body: {}, links: null, warnings: [] };
  if (rec.type === 'company') {
    out.name = p.name ?? '';
    out.createUrl = base + '/companies/0/customers/companies/';
    out.body = {
      CompanyName: p.name,
      Address: { Address: p.address || '', City: p.city || '', State: p.state || '', PostalCode: p.zip || '', Country: p.country || '' },
      BillingAddress: { Address: p.billing_address || '', City: p.billing_city || '', State: p.billing_state || '', PostalCode: p.billing_zip || p.billing_postalcode || '', Country: p.billing_country || '' },
      Phone: p.phone || '', Website: p.website || '', EIN: p.abn || '',
    };
  } else if (rec.type === 'contact') {
    out.name = [p.firstname, p.lastname].filter(Boolean).join(' ');
    const customer = related('contact', rec.hsId, 'companies', 1)[0]; // the primary company first
    if (!customer) { skipped.push({ type: rec.type, hsId: rec.hsId, reason: 'its company is not in Simpro yet (no Simpro customer ID)' }); continue; }
    out.createUrl = base + '/companies/0/customers/' + customer + '/contacts/';
    out.body = { GivenName: p.firstname || '', FamilyName: p.lastname || '', Email: p.email || '', WorkPhone: p.phone || '', Title: p.salutation || '', Department: p.department || '', Position: p.jobtitle || '' };
  } else { // site
    out.name = p.hs_name ?? '';
    out.createUrl = base + '/companies/0/sites/';
    const address = keep({ Address: p.hs_address_1, City: p.hs_city, State: p.hs_state_province, PostalCode: p.hs_zip, Country: p.country });
    const billing = keep({ Address: p.billing_address, City: p.billing_city, State: p.billing_state, PostalCode: p.billing_postal_code });
    out.body = { ...keep({ Name: p.hs_name }), ...(blank(p.zone) ? {} : { Zone: Number(p.zone) }), ...(Object.keys(address).length ? { Address: address } : {}), ...(Object.keys(billing).length ? { BillingAddress: billing } : {}) };
    out.links = { customers: related('site', rec.hsId, 'companies').map(Number), primaryContact: related('site', rec.hsId, 'contacts')[0] ?? null };
    const missing = notInSimpro('site', rec.hsId, 'companies');
    if (missing) out.warnings.push(missing + ' linked company(ies) not in Simpro yet - not linked');
  }
  plan.push(out);
}
return [{ json: { records: plan, skipped } }];
