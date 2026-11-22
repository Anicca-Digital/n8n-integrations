// Node: Report Result   ([SPL] HubSpot -> Simpro (Real Time))
// Last step. Looks at every call of this run. If any failed, the run fails (-> error workflow) with the details; the
// records that WERE created already have their Simpro ID saved, so a repeated webhook will not create them twice.
// Otherwise returns a short summary (what was created, what was skipped and why).
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } };
const live = (name) => safeAll(name).filter(i => !(i.json && i.json.skip));
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
const get = (name) => { try { return $(name).first().json; } catch (e) { return null; } };
const STAGES = [
  ['Build Record Writes', 'Write Records to Simpro', 'create in Simpro'],
  ['Build ID Write-Back', 'Write IDs to HubSpot', 'save Simpro ID in HubSpot'],
  ['Build Site Links', 'Write Site Links', 'link site in Simpro'],
];
const failures = [];
const created = { company: 0, contact: 0, site: 0 };
let linked = 0;
for (const [reqNode, resNode, label] of STAGES) {
  const reqs = live(reqNode);
  live(resNode).forEach((item, k) => {
    const meta = (reqs[idxOf(item, k)] && reqs[idxOf(item, k)].json.meta) || {};
    const r = item.json ?? {};
    const who = meta.hsId ? meta.type + ' ' + meta.hsId : 'batch ' + (meta.batch ?? '?');
    if (r.error !== undefined) { failures.push(label + ' (' + who + '): ' + (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)).slice(0, 200)); return; }
    if (r.statusCode === undefined || r.statusCode >= 400) { failures.push(label + ' (' + who + '): HTTP ' + r.statusCode + ' ' + JSON.stringify(r.body).slice(0, 200)); return; }
    const errs = r.body && Array.isArray(r.body.errors) ? r.body.errors : [];
    if (errs.length) { failures.push(label + ' (' + who + '): ' + errs.slice(0, 2).map(e => e.message || JSON.stringify(e)).join(' | ')); return; }
    if (meta.kind === 'create') created[meta.type]++;
    if (meta.kind === 'siteLinks') linked++;
  });
}
if (failures.length) throw new Error(failures.length + ' call(s) failed:\n' + failures.slice(0, 20).map(f => '- ' + f).join('\n'));

const prep = get('Prepare Records');
const resolved = get('Resolve Plan');
const skipped = ((resolved && resolved.skipped) || []).map(s => s.type + ' ' + s.hsId + ': ' + s.reason);
const warnings = ((resolved && resolved.records) || []).flatMap(r => (r.warnings ?? []).map(w => r.type + ' ' + r.hsId + ': ' + w));
if (skipped.length || warnings.length) $execution.customData.set('notes', [...skipped, ...warnings].join(' | ').slice(0, 250));
return [{ json: { status: 'ok', created, siteLinksSet: linked, ...(prep ? prep.counts : {}), skippedNotReady: skipped.length, skippedDetails: skipped, warnings } }];
