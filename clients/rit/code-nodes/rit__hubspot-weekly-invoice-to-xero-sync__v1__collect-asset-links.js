const ctx = $('Guard Cleared').first().json;
const outcomes = { ...ctx.outcomes };
const issues = [...ctx.issues];
const label = (id) => `${(ctx.companies[id] || {}).name || 'Company'} (${id})`;
const assetIdsByCompany = {};
for (const item of $input.all()) {
  const r = item.json;
  // HubSpot reports a record with NO associations as an error entry rather than leaving it out. That is normal, not a failure.
  const real = (r.errors || []).filter(e => e.subCategory !== 'crm.associations.NO_ASSOCIATIONS_FOUND');
  if (real.length || (r.numErrors > 0 && !r.errors)) {
    throw new Error(`Company to asset read returned errors: ${JSON.stringify(real.length ? real : r.errors)}`);
  }
  for (const row of r.results || []) {
    const cid = String(row.from.id);
    if (row.paging && row.paging.next) {
      issues.push(`${label(cid)}: asset list is longer than one HubSpot read returns - company skipped this week`);
      outcomes[cid] = { status: 'issue', message: 'asset list longer than one read' };
      continue;
    }
    assetIdsByCompany[cid] = (row.to || []).map(t => String(t.toObjectId));
  }
}
const assetIds = new Set();
for (const cid of ctx.eligibleIds) {
  if (outcomes[cid]) continue;
  const ids = assetIdsByCompany[cid] || [];
  if (!ids.length) { outcomes[cid] = { status: 'no_assets', message: 'Company has no associated assets' }; continue; }
  ids.forEach(id => assetIds.add(id));
}
return [{ json: { ...ctx, outcomes, issues, assetIdsByCompany, assetIds: [...assetIds] } }];
