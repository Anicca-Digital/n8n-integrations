// Node: Build Cost Center Requests   ([SPL] Simpro -> HubSpot (Real Time))
// One request per Simpro section (this node only runs when there is at least one section).
const cfg = $('Workflow Config').first().json;
const requests = $input.all()
  .map(i => i.json)
  .filter(s => s && s.ID !== undefined && s.ID !== null)
  .map(s => ({ json: { url: cfg.recordUrl + '/sections/' + s.ID + '/costCenters/?pageSize=250' } }));
return requests; // none = no usable section, the branch ends on purpose
