// Node: Finish Run   (all five sync workflows)
// Runs ONCE per poll: when everything is done, or straight away when there was nothing to sync.
// Fails the run (-> error workflow) if any record failed; only advances the watermark on full success.
const cfg = $('Build Sync Window').first().json;
const get = (name) => { try { return $(name).first().json; } catch (e) { return null; } }; // null when that branch did not run

const changed = $('Build Record List').all().filter(i => i.json.hasRecords === true).length;
const sel = get('Select Test Records');
const upsert = get('Check Upsert Results');
const assoc = get('Check Association Results');
const li = get('Check Line Item Results');

const failures = [...((sel && sel.failures) || []), ...((li && li.failures) || [])];
if (failures.length > 0) {
  const lines = failures.slice(0, 20).map(f => '- ' + f.type + ' ' + f.id + ': ' + f.error);
  throw new Error(failures.length + ' ' + cfg.label + ' record(s) failed for window ' + cfg.windowFrom + ' to ' + cfg.windowTo
    + '. The window is NOT advanced, so the next run re-reads it (writes are idempotent).\n' + lines.join('\n'));
}

// Full success: advance the watermark. Only persists on production (trigger) runs.
const state = $getWorkflowStaticData('global');
state.lastWindowEnd = cfg.windowTo;

return [{ json: {
  status: 'ok',
  recordType: cfg.recordType,
  changedInSimpro: changed,
  syncedTestRecords: sel ? sel.records.length : 0,
  skippedNonTest: sel ? sel.skippedNonTest : 0,
  skippedGone: sel ? sel.skippedGone.length : 0,
  writtenToHubSpot: upsert ? (upsert.written ?? 0) : 0,
  associations: assoc ? assoc.associations : null,
  lineItems: li ? li.lineItems : null,
  windowFrom: cfg.windowFrom,
  windowTo: cfg.windowTo,
  windowStartedFrom: cfg.fromSource,
  watermarkSavedTo: cfg.windowTo,
} }];
