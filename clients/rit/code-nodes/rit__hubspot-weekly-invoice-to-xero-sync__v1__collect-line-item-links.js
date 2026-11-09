const ctx = $('Collect Billable Assets').first().json;
const outcomes = { ...ctx.outcomes };
const issues = [...ctx.issues];
const label = (id) => `${(ctx.companies[id] || {}).name || 'Company'} (${id})`;
const lineItemsByAsset = {};
const pagedAssets = new Set();
for (const item of $input.all()) {
  const r = item.json;
  // HubSpot reports a record with NO associations as an error entry rather than leaving it out. That is normal, not a failure.
  const real = (r.errors || []).filter(e => e.subCategory !== 'crm.associations.NO_ASSOCIATIONS_FOUND');
  if (real.length || (r.numErrors > 0 && !r.errors)) {
    throw new Error(`Asset to line item read returned errors: ${JSON.stringify(real.length ? real : r.errors)}`);
  }
  for (const row of r.results || []) {
    if (row.paging && row.paging.next) pagedAssets.add(String(row.from.id));
    lineItemsByAsset[String(row.from.id)] = (row.to || []).map(t => String(t.toObjectId));
  }
}
const billableByCompany = {};
const lineItemIds = new Set();
for (const [cid, assets] of Object.entries(ctx.billableByCompany)) {
  if (assets.some(a => pagedAssets.has(a.id))) {
    issues.push(`${label(cid)}: an asset has more line items than one HubSpot read returns - company skipped this week`);
    outcomes[cid] = { status: 'issue', message: 'asset line item list longer than one read' };
    continue;
  }
  const ids = assets.flatMap(a => lineItemsByAsset[a.id] || []);
  if (!ids.length) { outcomes[cid] = { status: 'no_line_items', message: 'No billable asset has a line item' }; continue; }
  billableByCompany[cid] = assets;
  ids.forEach(id => lineItemIds.add(id));
}
const { billableAssetIds, ...rest } = ctx;
return [{ json: { ...rest, outcomes, issues, billableByCompany, lineItemsByAsset, lineItemIds: [...lineItemIds] } }];
