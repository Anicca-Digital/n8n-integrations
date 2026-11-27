// Node: Build Upsert Batches   ([SPL] Simpro -> HubSpot Quotes Sync)
// Simpro quote -> HubSpot deal (Quote pipeline), keyed on the unique property simpro_quote_id.
// Same property mapping as [SPL] Upsert Quote in HubSpot. The SPL Users table is read ONCE (Load SPL Users).
// NOTE (carried over unchanged): the existing sub-workflow looks up BOTH the sales person and the project
// manager with quote.ProjectManager.ID. Kept as is so behaviour does not change; raise with SPL before fixing.
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const day = (iso) => iso ? DateTime.fromISO(iso, { zone: 'utc' }).startOf('day').toMillis() : '';
const users = {}; // SPL Users data table: Simpro_ID -> HubSpot_ID
for (const row of $input.all()) {
  const j = row.json ?? {};
  if (j.Simpro_ID !== undefined && j.Simpro_ID !== null) users[String(j.Simpro_ID)] = j.HubSpot_ID;
}

const stages = {
  'quote to be completed': cfg.deal.stageToBeCompleted,
  'quote overdue': cfg.deal.stageToBeCompleted,
  'quote won': cfg.deal.stageWon,
  'quote lost': cfg.deal.stageLost,
};

const inputs = records.map((quote) => {
  const customField = (id) => (quote.CustomFields ?? []).find(f => f.CustomField?.ID === Number(id))?.Value ?? '';
  const status = String(quote.Status?.Name ?? '').trim().toLowerCase();
  const owner = users[String(quote.ProjectManager?.ID)];
  return {
    idProperty: cfg.idProperty,
    id: String(quote.ID),
    properties: {
      dealname: quote.Name,
      amount: quote.Total?.ExTax,
      description: quote.Notes ?? '',
      pipeline: cfg.deal.pipeline,
      dealstage: stages[status] ?? cfg.deal.stageDefault,
      hubspot_owner_id: owner,
      project_manager: owner,
      approved_date: day(quote.DateApproved),
      due_date: day(quote.DueDate),
      orderno: quote.OrderNo ?? '',
      validity: quote.ValidityDays ?? '',
      estimate_net_margin: quote.Totals.NettMargin.Estimate,
      simpro_description: quote.Description ?? '',
      project_tags: (quote.Tags ?? []).map(tag => tag.ID).join(';'),
      tender_number: customField(cfg.deal.cfTenderNumber),
      tender_status: customField(cfg.deal.cfTenderStatus),
      quote_type: quote.Type ?? '',
      vertical: customField(cfg.deal.cfVertical),
    },
  };
});

return chunk(inputs, cfg.hubspotBatchSize).map((part, n) => ({
  json: { url: cfg.objectUrl + '/batch/upsert', body: { inputs: part }, meta: { kind: 'upsert', batch: n + 1, count: part.length } },
}));
