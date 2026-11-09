// Turns HubSpot line items into BC sales order lines. Matches on SKU = BC item number.
// Throws (before anything is written to BC) if any line can't be ordered.
const results = $input.first().json.results || [];
const expected = $('Pick Associated Records').first().json.lineItemIds.length;
if (results.length !== expected) {
  throw new Error(`Expected ${expected} line items from HubSpot but got ${results.length}`);
}
const problems = [];
const lines = results.map((li) => {
  const p = li.properties || {};
  const label = p.name || li.id;
  const sku = String(p.hs_sku || '').trim();
  const quantity = Number(p.quantity);
  const unitPrice = Number(p.price);
  if (!sku) problems.push(`${label}: no SKU`);
  if (!(quantity > 0)) problems.push(`${label}: quantity must be greater than 0`);
  if (!Number.isFinite(unitPrice)) problems.push(`${label}: no unit price`);
  return { lineType: 'Item', lineObjectNumber: sku, quantity, unitPrice };
});
if (problems.length) {
  throw new Error(`Deal ${$('Pick Associated Records').first().json.dealId} cannot become a sales order: ${problems.join('; ')}`);
}
return [{ json: { lines } }];
