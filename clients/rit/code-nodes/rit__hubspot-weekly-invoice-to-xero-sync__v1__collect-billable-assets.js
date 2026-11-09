const ctx = $('Collect Asset Links').first().json;
const cfg = $('Workflow Config').first().json;
const assetById = {};
for (const item of $input.all()) {
  const r = item.json;
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Asset read returned errors: ${JSON.stringify(r.errors)}`);
  }
  for (const a of r.results || []) assetById[String(a.id)] = a;
}
const outcomes = { ...ctx.outcomes };
const billableByCompany = {};
const billableAssetIds = [];
for (const cid of ctx.eligibleIds) {
  if (outcomes[cid]) continue;
  const billable = (ctx.assetIdsByCompany[cid] || [])
    .map(id => assetById[id])
    .filter(a => a && cfg.billableStatuses.includes(String((a.properties || {}).status || '').toLowerCase()))
    .map(a => ({
      id: String(a.id),
      serialNumber: a.properties.serial_number || '',
      contractNumber: a.properties.contract_number || '',
      assetNumber: a.properties.asset_number || '',
      xeroAssetId: a.properties.xero_asset_id || '',
      xeroItemId: a.properties.xero_item_id || ''
    }));
  if (!billable.length) { outcomes[cid] = { status: 'no_active_assets', message: 'No asset is Active or To be Returned' }; continue; }
  billableByCompany[cid] = billable;
  billable.forEach(a => billableAssetIds.push(a.id));
}
const { assetIds, assetIdsByCompany, ...rest } = ctx;
return [{ json: { ...rest, outcomes, billableByCompany, billableAssetIds } }];
