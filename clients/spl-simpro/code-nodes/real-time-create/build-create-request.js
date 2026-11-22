// Node: Build Create Request   ([SPL] Simpro -> HubSpot (Real Time))
// Builds the ONE HubSpot create call for this record (same field mapping as the old Upsert sub-workflows and
// the batch sync workflows) and the list of related records it should be linked to (`related`).
//   related[].ids      Simpro IDs of the related records
//   related[].primary  (labelled links only) the Simpro ID that gets the label; the other ids get NO label
//   related[].label    HubSpot association type(s) used for the labelled link
//   related[].quoteIsFrom  the related record is the FROM side of the labelled link (Quote -> Job)
const cfg = $('Workflow Config').first().json;
const rec = $('Get Simpro Record').first().json;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]));
const ids = (arr) => [...new Set(arr.filter(v => !blank(v)).map(String))];
const day = (iso) => iso ? DateTime.fromISO(iso, { zone: 'utc' }).startOf('day').toMillis() : '';
const o = cfg.objects[cfg.type];

// SPL Users data table (Simpro_ID -> HubSpot_ID), only used by quotes and jobs
const users = {};
for (const row of $input.all()) {
  const j = row.json ?? {};
  if (j.Simpro_ID !== undefined && j.Simpro_ID !== null) users[String(j.Simpro_ID)] = j.HubSpot_ID;
}

let properties;
let related;
switch (cfg.type) {
  case 'company':
    properties = keep({
      simpro_customer_id: rec.ID, name: rec.CompanyName,
      address: rec.Address?.Address, city: rec.Address?.City, state: rec.Address?.State, zip: rec.Address?.PostalCode, country: rec.Address?.Country,
      billing_address: rec.BillingAddress?.Address, billing_city: rec.BillingAddress?.City, billing_state: rec.BillingAddress?.State,
      billing_zip: rec.BillingAddress?.PostalCode, billing_country: rec.BillingAddress?.Country,
      phone: rec.Phone, website: rec.Website, email: rec.Email, abn: rec.EIN,
    });
    related = [
      { key: 'contact', toType: 'contact', ids: ids((rec.Contacts ?? []).map(c => c.ID)) },
      { key: 'site', toType: 'site', ids: ids((rec.Sites ?? []).map(s => s.ID)) },
    ];
    break;
  case 'site':
    properties = keep({
      simpro_site_id: rec.ID, hs_name: rec.Name,
      hs_address_1: rec.Address?.Address, hs_city: rec.Address?.City, hs_state_province: rec.Address?.State, hs_zip: rec.Address?.PostalCode,
      country: rec.Address?.Country, zone: rec.Zone?.ID,
      billing_address: rec.BillingAddress?.Address, billing_city: rec.BillingAddress?.City, billing_state: rec.BillingAddress?.State,
      billing_postal_code: rec.BillingAddress?.PostalCode,
    });
    related = [
      { key: 'company', toType: 'company', ids: ids((rec.Customers ?? []).map(c => c.ID)) },
      { key: 'primaryContact', toType: 'contact', ids: ids([rec.PrimaryContact?.Contact?.ID]) },
    ];
    break;
  case 'contact':
    properties = keep({
      simpro_contact_id: rec.ID, email: String(rec.Email ?? '').trim(),
      firstname: rec.GivenName, lastname: rec.FamilyName, jobtitle: rec.Position, phone: rec.WorkPhone, salutation: rec.Title, department: rec.Department,
    });
    related = [
      { key: 'company', toType: 'company', ids: ids((rec.Customers ?? []).map(c => c.ID)) },
      { key: 'site', toType: 'site', ids: ids((rec.Sites ?? []).map(s => s.ID)) },
    ];
    break;
  case 'quote': {
    const d = cfg.quote;
    const customField = (id) => (rec.CustomFields ?? []).find(f => f.CustomField?.ID === Number(id))?.Value ?? '';
    const stages = { 'quote to be completed': d.stageToBeCompleted, 'quote overdue': d.stageToBeCompleted, 'quote won': d.stageWon, 'quote lost': d.stageLost };
    const status = String(rec.Status?.Name ?? '').trim().toLowerCase();
    // NOTE (carried over from [SPL] Upsert Quote in HubSpot): owner AND project manager are both looked up with ProjectManager.ID
    const owner = users[String(rec.ProjectManager?.ID)];
    properties = {
      dealname: rec.Name, amount: rec.Total?.ExTax, description: rec.Notes ?? '', pipeline: d.pipeline,
      dealstage: stages[status] ?? d.stageDefault, hubspot_owner_id: owner, project_manager: owner,
      simpro_quote_id: String(rec.ID), approved_date: day(rec.DateApproved), due_date: day(rec.DueDate),
      orderno: rec.OrderNo ?? '', validity: rec.ValidityDays ?? '', simpro_description: rec.Description ?? '',
      project_tags: (rec.Tags ?? []).map(tag => tag.ID).join(';'),
      tender_number: customField(d.cfTenderNumber), tender_status: customField(d.cfTenderStatus),
      quote_type: rec.Type ?? '', vertical: customField(d.cfVertical),
    };
    related = [
      { key: 'site', toType: 'site', ids: ids([rec.Site?.ID]) },
      { key: 'contact', toType: 'contact', ids: ids([rec.CustomerContact?.ID, ...(rec.AdditionalContacts ?? []).map(c => c.ID)]), primary: blank(rec.CustomerContact?.ID) ? null : String(rec.CustomerContact.ID), label: cfg.decisionMaker },
      { key: 'company', toType: 'company', ids: ids([rec.Customer?.ID]) },
    ];
    break;
  }
  case 'job': {
    const d = cfg.job;
    const stages = { pending: d.stagePending, progress: d.stageProgress, complete: d.stageComplete, archived: d.stageArchived };
    const stageKey = String(rec.Stage ?? '').trim().toLowerCase();
    properties = {
      dealname: rec.Name, amount: rec.Total?.ExTax, description: rec.Notes ?? '', pipeline: d.pipeline,
      dealstage: stages[stageKey] ?? d.stageDefault,
      hubspot_owner_id: users[String(rec.Salesperson?.ID)], project_manager: users[String(rec.ProjectManager?.ID)],
      simpro_job_id: String(rec.ID), approved_date: day(rec.DateApproved), due_date: day(rec.DueDate),
      orderno: rec.OrderNo ?? '', simpro_description: rec.Description ?? '',
      project_tags: (rec.Tags ?? []).map(tag => tag.ID).join(';'), job_type: rec.Type ?? '',
    };
    related = [
      { key: 'site', toType: 'site', ids: ids([rec.Site?.ID]) },
      { key: 'contact', toType: 'contact', ids: ids([rec.CustomerContact?.ID, ...(rec.AdditionalContacts ?? []).map(c => c.ID)]), primary: blank(rec.CustomerContact?.ID) ? null : String(rec.CustomerContact.ID), label: cfg.decisionMaker },
      { key: 'company', toType: 'company', ids: ids([rec.Customer?.ID]) },
      // the quote this job was converted from (a quote is a deal): Simpro ConvertedFromQuote.ID, or ConvertedFrom when its Type is Quote
      { key: 'quote', toType: 'quote', ids: ids([rec.ConvertedFromQuote?.ID ?? (rec.ConvertedFrom?.Type === 'Quote' ? rec.ConvertedFrom.ID : undefined)]), label: cfg.quoteJob, quoteIsFrom: true },
    ];
    break;
  }
  default:
    throw new Error('Unhandled record type: ' + cfg.type);
}

return [{ json: {
  recordType: cfg.type,
  fromObject: o.assoc,
  url: cfg.hubspotApiBase + '/' + o.path,
  body: { properties },
  related: related.filter(x => x.ids.length > 0),
} }];
