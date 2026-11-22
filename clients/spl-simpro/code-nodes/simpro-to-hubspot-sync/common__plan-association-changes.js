// Node: Plan Association Changes   (site, contact, quote and job workflows)
// Reads the answers to Build Association Reads, then diffs what HubSpot links now with what Simpro says:
//   reconcile links: keep matches, remove stale links, add missing ones.
//   addOnly links:   add missing ones, never remove (a link owned by another workflow, or ambiguous).
//   links with a `label` (Quote/Job -> Contact): the PRIMARY contact must carry the label (HubSpot user-defined
//   association, e.g. Decision Maker); the other (additional) contacts are linked with NO label. A label limit of
//   1-to-many means only one contact per deal can hold it, so a contact that holds the label but is no longer
//   the primary is unlinked first (archive) and re-linked without a label if it is still wanted.
// A related record that is not in HubSpot yet is SKIPPED and reported in the run summary (warnings).
// Output: ONE item { summary, requests } (requests may be empty = already in sync).
const cfg = $('Build Sync Window').first().json;
const plan = $('Build Association Reads').first().json.plan;
const built = $('Split Association Reads').all(); // the requests, in the order they were sent
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const okStatus = (s) => s === 200 || s === 207;

const lookup = {};  // toType -> { simproId: hubspotId }
const current = {}; // linkKey -> { fromHubspotId: Set(toHubspotId) }
const haveTypes = {}; // linkKey -> { fromHubspotId: { toHubspotId: Set(association type IDs) } }
plan.links.forEach(l => { current[l.key] = {}; haveTypes[l.key] = {}; });

$input.all().forEach((item, k) => {
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const meta = built[idx].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return; // nothing found / no associations yet
  if (!okStatus(r.statusCode)) {
    throw new Error('HubSpot ' + meta.kind + ' read failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  const results = (r.body && Array.isArray(r.body.results)) ? r.body.results : [];
  if (meta.kind === 'lookup') {
    lookup[meta.toType] = lookup[meta.toType] ?? {};
    for (const x of results) {
      const simproId = x.properties ? x.properties[meta.idProperty] : undefined;
      if (simproId !== undefined && simproId !== null) lookup[meta.toType][String(simproId)] = String(x.id);
    }
  } else {
    for (const row of results) {
      const from = String(row.from && row.from.id);
      current[meta.linkKey][from] = new Set((row.to ?? []).map(t => String(t.toObjectId)));
      haveTypes[meta.linkKey][from] = {};
      for (const t of (row.to ?? [])) {
        haveTypes[meta.linkKey][from][String(t.toObjectId)] = new Set((t.associationTypes ?? []).map(a => Number(a.typeId)));
      }
    }
  }
});

const warnings = [];
const requests = [];
let removed = 0;
let added = 0;

for (const l of plan.links) {
  const archiveInputs = [];
  const addInputs = [];
  const labelInputs = [];
  const labelType = l.label ? l.label.types[0].associationTypeId : null;
  for (const [simproId, fromHs] of Object.entries(plan.idMap)) {
    const wantedHs = new Set();
    for (const relatedSimproId of (plan.desired[l.key][simproId] ?? [])) {
      const hs = lookup[l.toType] ? lookup[l.toType][relatedSimproId] : undefined;
      if (hs) wantedHs.add(hs);
      else warnings.push({ link: l.key, simproId, relatedSimproId, reason: 'related ' + l.toType + ' not in HubSpot yet - link skipped' });
    }
    const primarySimproId = l.label ? (plan.primary[l.key][simproId] ?? null) : null;
    const primaryHs = primarySimproId && lookup[l.toType] ? (lookup[l.toType][primarySimproId] ?? null) : null;
    const have = l.mode === 'reconcile' ? (current[l.key][fromHs] ?? new Set()) : new Set();
    const types = (haveTypes[l.key] && haveTypes[l.key][fromHs]) || {};

    const rem = [...have].filter(id => !wantedHs.has(id));
    // holds the label but is not (or no longer) the primary: unlink, then re-link without a label below
    const dropLabel = l.label ? [...have].filter(id => wantedHs.has(id) && id !== primaryHs && types[id] && types[id].has(labelType)) : [];
    const toArchive = [...rem, ...dropLabel];
    if (toArchive.length) { archiveInputs.push({ from: { id: fromHs }, to: toArchive.map(id => ({ id })) }); removed += rem.length; }

    for (const id of wantedHs) {
      if (l.label && id === primaryHs) continue; // handled below with the label
      if (!have.has(id) || dropLabel.includes(id)) { addInputs.push({ from: { id: fromHs }, to: { id } }); added++; }
    }
    if (l.label && primaryHs && !(have.has(primaryHs) && types[primaryHs] && types[primaryHs].has(labelType))) {
      labelInputs.push({ from: { id: fromHs }, to: { id: primaryHs }, types: l.label.types });
      added++;
    }
  }
  const base = cfg.hubspotApiBase + '/crm/v4/associations/' + l.fromObject + '/' + l.toObject;
  // Order matters (requests run in order): archive first, then unlabelled adds, then the labelled primary.
  chunk(archiveInputs, cfg.hubspotBatchSize).forEach((part, n) => requests.push({
    url: base + '/batch/archive', body: { inputs: part }, meta: { kind: 'archive', link: l.key, batch: n + 1 } }));
  chunk(addInputs, cfg.hubspotBatchSize).forEach((part, n) => requests.push({
    url: base + '/batch/associate/default', body: { inputs: part }, meta: { kind: 'associate', link: l.key, batch: n + 1 } }));
  chunk(labelInputs, cfg.hubspotBatchSize).forEach((part, n) => requests.push({
    url: base + '/batch/create', body: { inputs: part }, meta: { kind: 'associateLabelled', link: l.key, batch: n + 1 } }));
}

const summary = { removed, added, warningCount: warnings.length, warnings: warnings.slice(0, 50) };
// ONE state item; Split Association Requests turns the requests into one item per batch call.
return [{ json: { summary, requests } }];
