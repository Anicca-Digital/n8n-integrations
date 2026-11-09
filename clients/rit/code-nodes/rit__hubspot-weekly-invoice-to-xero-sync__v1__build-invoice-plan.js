const ctx = $('Collect Line Item Links').first().json;
const lineItemById = {};
for (const item of $input.all()) {
  const r = item.json;
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Line item read returned errors: ${JSON.stringify(r.errors)}`);
  }
  for (const li of r.results || []) lineItemById[String(li.id)] = li;
}
const outcomes = { ...ctx.outcomes };
const issues = [...ctx.issues];
const label = (id) => `${(ctx.companies[id] || {}).name || 'Company'} (${id})`;
const plans = {};
for (const [cid, assets] of Object.entries(ctx.billableByCompany)) {
  let fallbackSequence = 1;          // advances only when an asset has no asset_number but has a contract_number
  const lines = [];
  try {
    for (const asset of assets) {
      const ids = ctx.lineItemsByAsset[asset.id] || [];
      let assetNumber = asset.assetNumber;
      if (ids.length && !assetNumber && asset.contractNumber) assetNumber = `${asset.contractNumber}-${fallbackSequence++}`;
      for (const id of ids) {
        const li = lineItemById[String(id)];
        if (!li) throw new Error(`line item ${id} could not be read`);
        const lp = li.properties || {};
        const price = parseFloat(lp.price == null ? 0 : lp.price);
        const quantity = parseFloat(lp.quantity == null ? 1 : lp.quantity);
        if (!Number.isFinite(price) || !Number.isFinite(quantity)) throw new Error(`line item ${id} has a non-numeric price or quantity`);
        const parts = [];
        if (lp.description) parts.push(lp.description);
        if (asset.contractNumber) parts.push(`Contract: ${asset.contractNumber}`);
        if (asset.serialNumber) parts.push(`S/N: ${asset.serialNumber}`);
        const props = { name: lp.name, quantity: '1', price: (price * quantity).toFixed(2), description: parts.join(' | ') };
        if (lp.hs_product_id) props.hs_product_id = lp.hs_product_id;
        if (lp.hs_sku) props.hs_sku = lp.hs_sku;
        if (assetNumber) props.asset_number = assetNumber;
        if (asset.serialNumber) props.serial_number = asset.serialNumber;
        if (asset.xeroAssetId) props.xero_asset_id = asset.xeroAssetId;
        if (asset.xeroItemId) props.xero_item_id = asset.xeroItemId;
        lines.push(props);
      }
    }
  } catch (e) {
    issues.push(`${label(cid)}: ${e.message} - company skipped this week`);
    outcomes[cid] = { status: 'issue', message: e.message };
    continue;
  }
  if (!lines.length) { outcomes[cid] = { status: 'no_line_items', message: 'No billable asset has a line item' }; continue; }
  plans[cid] = lines;
}
const { billableByCompany, lineItemsByAsset, lineItemIds, ...rest } = ctx;
return [{ json: { ...rest, outcomes, issues, plans, planIds: Object.keys(plans) } }];
