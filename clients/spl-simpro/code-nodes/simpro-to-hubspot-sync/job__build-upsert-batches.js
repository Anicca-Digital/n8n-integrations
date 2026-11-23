// Node: Build Upsert Batches   ([SPL] Simpro -> HubSpot Jobs Sync)
// Simpro job -> HubSpot deal (Jobs pipeline), keyed on the unique property simpro_job_id.
// Same property mapping as [SPL] Upsert Job in HubSpot. The SPL Users table is read ONCE (Load SPL Users).
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
  pending: cfg.deal.stagePending,
  progress: cfg.deal.stageProgress,
  complete: cfg.deal.stageComplete,
  archived: cfg.deal.stageArchived,
};

const inputs = records.map((job) => {
  const stageKey = String(job.Stage ?? '').trim().toLowerCase();
  // Job status Job Paid / Job Invoiced wins over the Stage (cfg.deal.invoicedStatuses -> stageInvoiced)
  const statusKey = String(job.Status?.Name ?? '').trim().toLowerCase();
  const dealstage = cfg.deal.invoicedStatuses.includes(statusKey) ? cfg.deal.stageInvoiced : (stages[stageKey] ?? cfg.deal.stageDefault);
  return {
    idProperty: cfg.idProperty,
    id: String(job.ID),
    properties: {
      dealname: job.Name,
      amount: job.Total?.ExTax,
      description: job.Notes ?? '',
      pipeline: cfg.deal.pipeline,
      dealstage,
      hubspot_owner_id: users[String(job.Salesperson?.ID)],
      project_manager: users[String(job.ProjectManager?.ID)],
      approved_date: day(job.DateApproved),
      due_date: day(job.DueDate),
      orderno: job.OrderNo ?? '',
      simpro_description: job.Description ?? '',
      project_tags: (job.Tags ?? []).map(tag => tag.ID).join(';'),
      job_type: job.Type ?? '',
    },
  };
});

return chunk(inputs, cfg.hubspotBatchSize).map((part, n) => ({
  json: { url: cfg.objectUrl + '/batch/upsert', body: { inputs: part }, meta: { kind: 'upsert', batch: n + 1, count: part.length } },
}));
