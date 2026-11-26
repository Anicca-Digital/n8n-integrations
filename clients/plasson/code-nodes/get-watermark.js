// Where this run's NetSuite pull starts. Must stay a Code node: the watermark lives in workflow static data.
const s = $json;
const store = $getWorkflowStaticData('global');
const basis = s.forceSince || store.lastSuccessfulRun || s.cutoverStart;
const start = DateTime.fromISO(basis, { zone: 'utc' });
if (!start.isValid) {
  throw new Error('Watermark is not a valid ISO timestamp: ' + basis);
}
// Quotes that had no matching deal are re-pulled every run for parkDays.
const parked = store.parkedQuotes || {};
const cutoff = DateTime.utc().minus({ days: s.parkDays }).toISO();
const parkedIds = Object.keys(parked).filter(id => /^\d+$/.test(id) && parked[id].firstParked >= cutoff).slice(0, 500);
return [{ json: {
  ...s,
  runStartedAt: DateTime.utc().toISO(),
  since: start.minus({ minutes: s.overlapMinutes }).setZone(s.netsuiteTimezone).toFormat('yyyy-MM-dd HH:mm:ss'),
  parkedIds
} }];
