// Node: Build Section Requests   (quote and job workflows)
// One request per synced deal: the Simpro sections of that quote/job (cost centers hang off sections).
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const idMap = $('Build Association Reads').first().json.plan.idMap; // simpro id -> HubSpot deal id

return records.map(r => ({
  json: {
    url: cfg.detailUrlPrefix + r.ID + '/sections/?pageSize=250',
    meta: { simproId: String(r.ID), dealId: idMap[String(r.ID)] },
  },
}));
