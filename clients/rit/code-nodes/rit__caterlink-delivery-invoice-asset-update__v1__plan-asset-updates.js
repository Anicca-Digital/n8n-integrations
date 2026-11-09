// Plans the whole invoice in one pass. One HubSpot search returned every asset on the contract;
// here each parsed line item is matched to an asset by name and the batch-update payload is built.
// Nothing here throws: problems are recorded per line item so the summary can report them all.
const parsed = $('Parse Invoice PDF').first().json;
const search = $input.first().json;

const MAX_BATCH = 100; // HubSpot batch update limit

const norm = (s) => String(s ?? '')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const errText = (e) => typeof e === 'string'
  ? e
  : (e && (e.message || e.description)) || JSON.stringify(e).slice(0, 300);

const hasDeliveryDate = (a) => {
  const v = a.props.delivery_date;
  return v !== null && v !== undefined && String(v).trim() !== '';
};

let fatal = null;
if (search.error) {
  fatal = `HubSpot asset search failed: ${errText(search.error)}`;
} else if (search.paging && search.paging.next) {
  fatal = 'More than 200 assets on this contract - pagination needed in the search step.';
} else if (!Number.isFinite(parsed.deliveryDateMs)) {
  fatal = 'Invoice date could not be read from the PDF, so no delivery date can be set.';
} else if (parsed.lineItems.length > MAX_BATCH) {
  fatal = `${parsed.lineItems.length} line items exceeds the ${MAX_BATCH}-record batch limit.`;
}

const rows = [];
const inputs = [];

if (fatal) {
  for (const li of parsed.lineItems) {
    rows.push({ itemNum: li.itemNum, description: li.description, status: 'failed', detail: fatal });
  }
} else {
  const assets = (search.results || []).map((r) => ({ id: String(r.id), props: r.properties || {} }));
  const claimed = new Set(); // assets already given to an earlier line item on this invoice

  for (const li of parsed.lineItems) {
    const row = { itemNum: li.itemNum, description: li.description };
    const named = assets.filter((a) => norm(a.props.name) === norm(li.description));
    const pending = named.filter((a) => !claimed.has(a.id) && !hasDeliveryDate(a));

    if (named.length === 0) {
      rows.push({ ...row, status: 'failed', detail: 'No matching asset found for this contract and description.' });
      continue;
    }
    if (pending.length === 0) {
      rows.push({ ...row, status: 'skipped', detail: 'Already delivered (every matching asset has a delivery date or is taken by an earlier line).' });
      continue;
    }

    const asset = pending[0];
    claimed.add(asset.id);

    // keep an existing asset_number, otherwise derive "{contract}-{itemNum}"
    const assetNumber = asset.props.asset_number || `${asset.props.contract_number || parsed.poNum}-${li.itemNum}`;

    const properties = {
      delivery_date: String(parsed.deliveryDateMs),
      price: String(li.unitPrice),
      asset_number: assetNumber,
    };
    if (li.serialNumber) properties.serial_number = li.serialNumber;
    if (li.manufacturer) properties.manufacturer = li.manufacturer;
    if (parsed.invoiceNum) properties.invoice_reference = parsed.invoiceNum;

    inputs.push({ id: asset.id, properties });
    rows.push({ ...row, status: 'queued', assetId: asset.id, assetNumber });
  }
}

return [{
  json: {
    poNum: parsed.poNum,
    invoiceNum: parsed.invoiceNum,
    deliveryDateMs: parsed.deliveryDateMs,
    fatal,
    rows,
    inputs,
  },
}];
