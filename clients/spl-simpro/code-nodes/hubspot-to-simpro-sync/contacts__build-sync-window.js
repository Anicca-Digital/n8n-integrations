// Node: Build Sync Window   ([SPL] HubSpot -> Simpro Contacts Sync)
// Settings + time window for this sync. Single source of truth: edit values HERE only.
// The watermark lives in THIS workflow's own static data, so the five HubSpot -> Simpro syncs never share a window.
const CONFIG = {
  recordType: 'contact', // company | contact | site | quote | job
  label: 'Contacts',
  // --- TEST MODE: while true, only TEST records are sent to Simpro. Set to false to send everything. ---
  testOnly: true,
  // A record is a test record when its name starts with namePrefix OR its own email domain is in emailDomains (case-insensitive).
  testRecords: { namePrefix: 'HSTEST-', emailDomains: ['aniccadigital.io', 'spl.com.au'], nameFields: ['firstname', 'lastname'], emailField: 'email' },
  // --- HubSpot ---
  hubspotApiBase: 'https://api.hubapi.com',
  objectPath: 'crm/objects/2026-09/contacts',
  assocObject: 'contacts', // object type name used by the associations API
  idProperty: 'simpro_contact_id', // HubSpot property that holds the Simpro ID
  modifiedProperty: 'lastmodifieddate', // what 'changed' means in HubSpot
  pipelineId: null, // deals: only this pipeline
  onlyAlreadyInSimpro: true, // true = only records that already have a Simpro ID (never creates new ones in Simpro), as today
  properties: ['simpro_contact_id', 'firstname', 'lastname', 'email', 'phone', 'salutation', 'department', 'jobtitle'],
  // --- Simpro ---
  simproBaseUrl: 'https://spl.simprosuite.com/api/v1.0',
  // --- Window (use windowStartOverride for a one-off backfill, e.g. '2020-01-01T00:00:00Z', then clear it) ---
  overlapMinutes: 5, // re-read this far back from the last window end (late edits). Writes only happen when something differs.
  initialLookbackMinutes: 35, // used when there is no saved watermark (first run, or any manual test run)
  windowStartOverride: '',
};

const state = $getWorkflowStaticData('global'); // only persists on production (trigger) runs, not manual test runs
const now = new Date();
let from;
let fromSource;
if (CONFIG.windowStartOverride) {
  from = new Date(CONFIG.windowStartOverride);
  if (isNaN(from.getTime())) throw new Error('windowStartOverride is not a valid ISO date-time: ' + CONFIG.windowStartOverride);
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

// The HubSpot search: records changed since the window start (+ the pipeline for deals, + "already in Simpro" if set).
const filters = [{ propertyName: CONFIG.modifiedProperty, operator: 'GTE', value: String(from.getTime()) }];
if (CONFIG.pipelineId) filters.push({ propertyName: 'pipeline', operator: 'EQ', value: CONFIG.pipelineId });
if (CONFIG.onlyAlreadyInSimpro) filters.push({ propertyName: CONFIG.idProperty, operator: 'HAS_PROPERTY' });

return [{ json: {
  ...CONFIG,
  searchUrl: CONFIG.hubspotApiBase + '/' + CONFIG.objectPath + '/search',
  searchBody: { filterGroups: [{ filters }], properties: CONFIG.properties, sorts: ['hs_object_id'], limit: 200 },
  windowFrom: from.toISOString(),
  windowTo: now.toISOString(),
  fromSource,
} }];
