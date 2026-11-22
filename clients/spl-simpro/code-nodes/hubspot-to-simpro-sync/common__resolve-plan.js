// Node: Resolve Plan   (all five HubSpot -> Simpro sync workflows)
// Turns each changed HubSpot record into a plan for Simpro: where to create/update it, the body to send, and the
// Simpro IDs of the records it links to (read from HubSpot in the previous steps). A record that cannot be sent
// yet (for example its company is not in Simpro) is listed under `skipped`, never created half-linked.
// One state item out; later nodes read it with $('Resolve Plan').first().
const cfg = $('Build Sync Window').first().json;
const { records } = $('Prepare Records').first().json;
const base = cfg.simproBaseUrl;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } };
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;

// --- what each record is linked to in HubSpot: assoc[to][hubspotId] = [{ id, types:Set(typeId) }]
const assoc = { companies: {}, contacts: {}, '0-420': {}, line_items: {} };
const assocReqs = safeAll('Build Association Reads');
safeAll('Read Associations').forEach((item, k) => {
  const meta = assocReqs[idxOf(item, k)].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return;
  for (const row of ((r.body && r.body.results) || [])) {
    assoc[meta.to][String(row.from.id)] = (row.to ?? []).map(t => ({ id: String(t.toObjectId), types: new Set((t.associationTypes ?? []).map(a => Number(a.typeId))) }));
  }
});

// --- the Simpro ID of each related record, and the line item properties
const simproOf = { companies: {}, contacts: {}, '0-420': {} };
const lineItem = {};
const ID_PROP = { companies: 'simpro_customer_id', contacts: 'simpro_contact_id', '0-420': 'simpro_site_id' };
const relReqs = safeAll('Build Related Reads');
safeAll('Read Related Objects').forEach((item, k) => {
  const meta = relReqs[idxOf(item, k)].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return;
  for (const x of ((r.body && r.body.results) || [])) {
    if (meta.type === 'line_items') lineItem[String(x.id)] = x.properties ?? {};
    else if (!blank(x.properties && x.properties[ID_PROP[meta.type]])) simproOf[meta.type][String(x.id)] = String(x.properties[ID_PROP[meta.type]]);
  }
});
// related records of one type that already have a Simpro ID, preferred association type first
const related = (hsId, to, preferType) => {
  const list = (assoc[to][hsId] ?? []).filter(t => simproOf[to][t.id] !== undefined);
  const preferred = preferType ? list.filter(t => t.types.has(preferType)) : [];
  return [...preferred, ...list.filter(t => !preferred.includes(t))].map(t => simproOf[to][t.id]);
};
const notInSimpro = (hsId, to) => (assoc[to][hsId] ?? []).filter(t => simproOf[to][t.id] === undefined).length;

// --- SPL Users data table (HubSpot_ID -> Simpro_ID) for deal owners
const users = {};
for (const row of safeAll('Load SPL Users')) {
  const j = row.json ?? {};
  if (!blank(j.HubSpot_ID) && !blank(j.Simpro_ID)) users[String(j.HubSpot_ID)] = Number(j.Simpro_ID);
}
const asDate = (v) => /^\d+$/.test(String(v)) ? DateTime.fromMillis(Number(v), { zone: 'utc' }) : DateTime.fromISO(String(v), { zone: 'utc' });
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)));

const plan = [];
const skipped = [];
for (const rec of records) {
  const p = rec.props;
  const out = { hsId: rec.hsId, simproId: rec.simproId, name: '', createUrl: null, updateUrl: null, body: {}, createExtra: {}, links: null, customFields: [], lineItems: [], warnings: [] };
  const skip = (reason) => skipped.push({ hsId: rec.hsId, reason });
  const urlsFor = (collection) => { out.createUrl = collection + '/'; out.updateUrl = rec.simproId ? collection + '/' + rec.simproId : null; };

  if (cfg.recordType === 'company') {
    out.name = p.name ?? '';
    urlsFor(base + '/companies/0/customers/companies');
    out.body = {
      CompanyName: p.name,
      Address: { Address: p.address || '', City: p.city || '', State: p.state || '', PostalCode: p.zip || '', Country: p.country || '' },
      BillingAddress: { Address: p.billing_address || '', City: p.billing_city || '', State: p.billing_state || '', PostalCode: p.billing_zip || p.billing_postalcode || '', Country: p.billing_country || '' }, // billing_zip is what the Simpro -> HubSpot sync writes
      Phone: p.phone || '', Website: p.website || '', EIN: p.abn || '',
    };
    out.links = { sites: related(rec.hsId, '0-420').map(Number) }; // the sites linked to this company that already have a Simpro ID
    const missingSites = notInSimpro(rec.hsId, '0-420');
    if (missingSites) out.warnings.push(missingSites + ' linked site(s) not in Simpro yet - not linked');
  } else if (cfg.recordType === 'contact') {
    out.name = [p.firstname, p.lastname].filter(Boolean).join(' ');
    const customer = related(rec.hsId, 'companies', 1)[0]; // the primary company first
    if (!customer) { skip('its company is not in Simpro yet (no Simpro customer ID)'); continue; }
    urlsFor(base + '/companies/0/customers/' + customer + '/contacts');
    out.body = { GivenName: p.firstname || '', FamilyName: p.lastname || '', Email: p.email || '', WorkPhone: p.phone || '', Title: p.salutation || '', Department: p.department || '', Position: p.jobtitle || '' };
  } else if (cfg.recordType === 'site') {
    out.name = p.hs_name ?? '';
    urlsFor(base + '/companies/0/sites');
    const address = keep({ Address: p.hs_address_1, City: p.hs_city, State: p.hs_state_province, PostalCode: p.hs_zip, Country: p.country });
    const billing = keep({ Address: p.billing_address, City: p.billing_city, State: p.billing_state, PostalCode: p.billing_postal_code });
    out.body = { ...keep({ Name: p.hs_name }), ...(blank(p.zone) ? {} : { Zone: Number(p.zone) }), ...(Object.keys(address).length ? { Address: address } : {}), ...(Object.keys(billing).length ? { BillingAddress: billing } : {}) };
    out.links = { customers: related(rec.hsId, 'companies').map(Number), primaryContact: (related(rec.hsId, 'contacts')[0] ?? null) };
    const missing = notInSimpro(rec.hsId, 'companies');
    if (missing) out.warnings.push(missing + ' linked company(ies) not in Simpro yet - not linked');
  } else { // quote or job
    const isQuote = cfg.recordType === 'quote';
    out.name = p.dealname ?? '';
    const customer = related(rec.hsId, 'companies')[0];
    const site = related(rec.hsId, '0-420')[0];
    if (!customer || !site) { skip('its ' + (!customer ? 'company' : 'site') + ' is not in Simpro yet (no Simpro ID)'); continue; }
    const contact = related(rec.hsId, 'contacts', cfg.decisionMakerTypeId)[0]; // the Decision Maker first, else the first contact
    urlsFor(base + '/companies/' + cfg.simproCompanyId + (isQuote ? '/quotes' : '/jobs'));
    out.body = {
      Customer: Number(customer),
      ...(contact ? { CustomerContact: Number(contact) } : {}),
      Site: Number(site),
      Name: p.dealname ?? '',
      Description: p.simpro_description ?? '',
      Notes: p.description ?? '',
      ...(!isQuote && users[String(p.hubspot_owner_id)] ? { Salesperson: users[String(p.hubspot_owner_id)] } : {}),
      ...(users[String(p.project_manager)] ? { ProjectManager: users[String(p.project_manager)] } : {}),
      DueDate: p.due_date ? asDate(p.due_date).toFormat('yyyy-MM-dd') : null,
      OrderNo: p.orderno ?? '',
      ...(isQuote && p.validity ? { ValidityDays: Number(p.validity) } : {}),
      Tags: (p.project_tags ?? '').split(';').filter(Boolean).map(Number),
    };
    // Only set when the record is CREATED: the type, and for quotes the sales person. The Simpro -> HubSpot quote mapping puts the
    // PROJECT MANAGER in hubspot_owner_id (carried-over quirk), so syncing the owner back would overwrite a quote's real sales person.
    out.createExtra = { Type: (isQuote ? p.quote_type : p.job_type) ?? '', ...(isQuote && users[String(p.hubspot_owner_id)] ? { Salesperson: users[String(p.hubspot_owner_id)] } : {}) };
    if (isQuote) out.customFields = [
      { id: cfg.customFields.tenderNumber, value: p.tender_number ?? '' },
      { id: cfg.customFields.tenderStatus, value: p.tender_status ?? '' },
      { id: cfg.customFields.vertical, value: p.vertical ?? '' },
    ];
    out.lineItems = (assoc.line_items[rec.hsId] ?? []).map(t => ({ id: t.id, ...(lineItem[t.id] ?? {}) }));
  }
  plan.push(out);
}
return [{ json: { records: plan, skipped } }];
