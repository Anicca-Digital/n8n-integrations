// Node: Build Cost Center Requests   (quote and job workflows)
// One request per (deal, section). A section fetch that failed is recorded against its deal and that
// deal's line items are left untouched this run (the run fails at Finish Run so the window is retried).
const cfg = $('Build Sync Window').first().json;
const reqs = $('Build Section Requests').all();

const out = [];
const failures = [];
$input.all().forEach((item, k) => {
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const meta = reqs[idx].json.meta;
  const j = item.json ?? {};
  if (j.error !== undefined) {
    failures.push({ type: cfg.recordType, id: meta.simproId, error: 'sections: ' + (typeof j.error === 'string' ? j.error : JSON.stringify(j.error)).slice(0, 250) });
    return;
  }
  if (!Array.isArray(j.body)) {
    failures.push({ type: cfg.recordType, id: meta.simproId, error: 'sections: expected an array, got ' + typeof j.body });
    return;
  }
  for (const section of j.body) {
    if (section && section.ID !== undefined && section.ID !== null) {
      out.push({ url: cfg.detailUrlPrefix + meta.simproId + '/sections/' + section.ID + '/costCenters/?pageSize=250',
        meta: { simproId: meta.simproId, dealId: meta.dealId, sectionId: section.ID } });
    }
  }
});

// ONE state item; Split Cost Center Requests turns the requests into one item per call.
return [{ json: { failures, requests: out } }];
