// Node: Finish Run   (all five HubSpot -> Simpro sync workflows)
// Runs ONCE per poll: when everything is done, or straight away when there was nothing to sync.
// Looks at every call made in this run. If anything failed it fails the run (-> error workflow) and the window is
// NOT advanced, so the next run retries it (writes are idempotent: existing records are only changed when they differ,
// and new Simpro IDs are saved right after creation). Only a fully successful run advances the watermark.
const cfg = $('Build Sync Window').first().json;
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } };
const live = (name) => safeAll(name).filter(i => !(i.json && i.json.skip));
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
const get = (name) => { try { return $(name).first().json; } catch (e) { return null; } };

const prep = get('Prepare Records');
const resolved = get('Resolve Plan');

// every Simpro / HubSpot call of this run: [request node, response node, label]
const STAGES = [
  ['Build Simpro Reads', 'Read from Simpro', 'read from Simpro'],
  ['Build Record Writes', 'Write Records to Simpro', 'write to Simpro'],
  ['Build ID Write-Back', 'Write IDs to HubSpot', 'save Simpro ID in HubSpot'],
  ['Build Section Reads', 'Read Sections', 'read Simpro sections'],
  ['Build Cost Center Reads', 'Read Cost Centers', 'read Simpro cost centers'],
  ['Build Dependent Writes', 'Write Links and Cost Centers', 'links / custom fields / cost centers'],
  ['Build Line Item Write-Back', 'Write Line Item IDs to HubSpot', 'save line item IDs in HubSpot'],
];
const failures = [];
const gone = [];
const counts = { created: 0, updated: 0, siteLinks: 0, companySites: 0, customFields: 0, costCentersCreated: 0, costCentersUpdated: 0 };
for (const [reqNode, resNode, label] of STAGES) {
  const reqs = live(reqNode);
  live(resNode).forEach((item, k) => {
    const meta = (reqs[idxOf(item, k)] && reqs[idxOf(item, k)].json.meta) || {};
    const r = item.json ?? {};
    const who = meta.hsId ? 'HubSpot ' + meta.hsId : 'batch ' + (meta.batch ?? '?');
    if (r.error !== undefined) { failures.push(label + ' (' + who + '): ' + (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)).slice(0, 200)); return; }
    const status = r.statusCode;
    if (status === 404 && resNode === 'Read from Simpro') { gone.push(meta.hsId); return; } // deleted in Simpro: not retried forever
    if (status >= 400 || status === undefined) { failures.push(label + ' (' + who + '): HTTP ' + status + ' ' + JSON.stringify(r.body).slice(0, 200)); return; }
    const errs = r.body && Array.isArray(r.body.errors) ? r.body.errors : [];
    if (errs.length) { failures.push(label + ' (' + who + '): ' + errs.slice(0, 2).map(e => e.message || JSON.stringify(e)).join(' | ')); return; }
    if (meta.kind === 'create') counts.created++;
    else if (meta.kind === 'update') counts.updated++;
    else if (meta.kind === 'siteLinks') counts.siteLinks++;
    else if (meta.kind === 'companySites') counts.companySites++;
    else if (meta.kind === 'customField') counts.customFields++;
    else if (meta.kind === 'costCenterCreate') counts.costCentersCreated++;
    else if (meta.kind === 'costCenterUpdate') counts.costCentersUpdated++;
  });
}
if (failures.length > 0) {
  throw new Error(failures.length + ' call(s) failed for ' + cfg.label + ' in window ' + cfg.windowFrom + ' to ' + cfg.windowTo
    + '. The window is NOT advanced, so the next run retries it.\n' + failures.slice(0, 20).map(f => '- ' + f).join('\n'));
}

const state = $getWorkflowStaticData('global');
state.lastWindowEnd = cfg.windowTo; // only persists on production (trigger) runs

const skipped = (resolved && resolved.skipped) || [];
const warnings = ((resolved && resolved.records) || []).flatMap(r => (r.warnings ?? []).map(w => 'HubSpot ' + r.hsId + ': ' + w));
return [{ json: {
  status: 'ok',
  recordType: cfg.recordType,
  testOnly: cfg.testOnly,
  changedInHubSpot: prep ? prep.counts.changedInHubSpot : 0,
  skippedNonTest: prep ? prep.counts.skippedNonTest : 0,
  ...counts,
  skippedNotReady: skipped.length,
  skippedDetails: skipped.slice(0, 25).map(s => 'HubSpot ' + s.hsId + ': ' + s.reason),
  goneInSimpro: gone.length,
  warnings: warnings.slice(0, 25),
  windowFrom: cfg.windowFrom,
  windowTo: cfg.windowTo,
  windowStartedFrom: cfg.fromSource,
  watermarkSavedTo: cfg.windowTo,
} }];
