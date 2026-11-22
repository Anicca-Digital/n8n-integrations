// Node: Build Sync Window   ([SPL] Simpro -> HubSpot Companies Sync)
// Sync window + config for this poller. Single source of truth: edit values HERE only.
// The watermark lives in THIS workflow's own static data, so the five sync workflows never share a window.
const CONFIG = {
  recordType: 'company', // company | contact | site | quote | job
  label: 'Companies',
  // --- Simpro ---
  simproBaseUrl: 'https://spl.simprosuite.com/api/v1.0',
  listPath: 'companies/0/customers/companies/', // changed-since list (If-Modified-Since). Quotes and Jobs use Simpro company ID 4 (confirmed with SPL).
  detailPath: 'companies/0/customers/companies/', // + record ID = the full record
  // --- HubSpot ---
  hubspotApiBase: 'https://api.hubapi.com',
  objectPath: 'crm/objects/2026-09/companies',
  assocObject: 'companies', // object type name used by the associations API
  idProperty: 'simpro_customer_id', // unique HubSpot property that holds the Simpro ID
  needsReadBack: false, // read the HubSpot IDs back after the write
  hubspotBatchSize: 100, // HubSpot batch limit
  // --- Test-record rule (do not loosen without asking SPL) ---
  testRecords: { namePrefix: 'HSTEST-', contactEmailDomains: ['aniccadigital.io', 'spl.com', 'spl.com.au'], orEmailDomains: ['aniccadigital.io', 'spl.com.au'] },
  // --- Window ---
  overlapMinutes: 2, // re-read this far back from the last window end (clock skew / late commits). Writes are idempotent.
  initialLookbackMinutes: 35, // used when there is no saved watermark (first run, or any manual test run)
  windowStartOverride: '', // optional ISO date-time e.g. '2026-11-20T00:00:00Z' - forces the window start (backfill / recovery). Clear afterwards.
};

const state = $getWorkflowStaticData('global'); // only persists on production (trigger) runs, not manual test runs
const now = new Date();
let from;
let fromSource;

if (CONFIG.windowStartOverride) {
  from = new Date(CONFIG.windowStartOverride);
  if (isNaN(from.getTime())) {
    throw new Error('windowStartOverride is not a valid ISO date-time: ' + CONFIG.windowStartOverride);
  }
  fromSource = 'override';
} else if (state.lastWindowEnd) {
  from = new Date(new Date(state.lastWindowEnd).getTime() - CONFIG.overlapMinutes * 60000);
  fromSource = 'watermark';
} else {
  from = new Date(now.getTime() - CONFIG.initialLookbackMinutes * 60000);
  fromSource = 'initial lookback';
}
if (from.getTime() >= now.getTime()) {
  throw new Error('Sync window starts in the future (' + from.toISOString() + '). Check windowStartOverride and the saved watermark.');
}

return [{ json: {
  ...CONFIG,
  listUrl: CONFIG.simproBaseUrl + '/' + CONFIG.listPath,
  detailUrlPrefix: CONFIG.simproBaseUrl + '/' + CONFIG.detailPath,
  objectUrl: CONFIG.hubspotApiBase + '/' + CONFIG.objectPath,
  windowFrom: from.toISOString(),
  windowTo: now.toISOString(),
  ifModifiedSince: from.toUTCString(), // Simpro If-Modified-Since needs an HTTP-date in GMT
  fromSource,
} }];
