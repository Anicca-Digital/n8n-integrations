// Build Xero Bill Line Items Payload
// ---------------------------------------------------------------------------
// Runs once after "Loop Over Assets For Registration" finishes
// (done output, index 0). Takes the invoice line items already built by
// "Build Xero Line Items Payload" and replaces:
//   - UnitAmount / LineAmount -> Xero asset purchasePrice
//   - Description             -> "<assetName>\nSerial Number <serialNumber>"
//   - AccountCode             -> RIT Rental Assets @ Cost account for the state
//
// Match key: invoice line ItemCode (HubSpot asset_number) <-> Xero assetNumber
// Source priority:
//   1. "Update Xero Asset Status to Registered" response (post-registration)
//   2. "Get Xero Asset Details" response (pre-registration fallback)
// ---------------------------------------------------------------------------

// Bill account codes by state. Anything else falls back to the legacy account.
const BILL_ACCOUNTS = [
  { accountCode: 'WA1460', name: 'RIT Rental Assets @ Cost (WA)', region: 'WA' },
  { accountCode: 'VIC1460', name: 'RIT Rental Assets @ Cost (VIC)', region: 'VIC' },
];
const DEFAULT_BILL_ACCOUNT_CODE = '1460'; // Legacy Rental Asset @ Cost

const norm = (v) => (v == null ? '' : String(v).trim().toUpperCase());

// Work out the state for a line. Prefers an explicit region/state on the line,
// otherwise reads the prefix of the invoice's rental income account
// (WA5000 -> WA, VIC5000 -> VIC, NSW5000 -> NSW).
const resolveRegion = (line) => {
  const explicit = norm(line.region ?? line.state);
  if (explicit) return explicit;
  const match = norm(line.AccountCode).match(/^[A-Z]+/);
  return match ? match[0] : '';
};

const resolveBillAccountCode = (line) => {
  const region = resolveRegion(line);
  const matched = BILL_ACCOUNTS.find((a) => a.region === region);
  if (!matched) {
    console.log(
      `ℹ Region "${region || 'unknown'}" for ${line.ItemCode} has no state account - using ${DEFAULT_BILL_ACCOUNT_CODE}.`
    );
  }
  return matched ? matched.accountCode : DEFAULT_BILL_ACCOUNT_CODE;
};

// Collect every run of a node inside a loop (each loop iteration = one run).
const collectRuns = (nodeName) => {
  const out = [];
  for (let run = 0; run < 1000; run++) {
    try {
      const items = $(nodeName).all(0, run);
      if (!items || items.length === 0) break;
      out.push(...items);
    } catch (e) {
      break;
    }
  }
  return out;
};

// Xero Assets API can return the asset at the root or wrapped - handle both.
const unwrapAsset = (json) => {
  if (!json) return null;
  if (json.assetNumber || json.assetId) return json;
  if (Array.isArray(json.items) && json.items[0]) return json.items[0];
  if (json.asset) return json.asset;
  return null;
};

// ---- 1. Build assetNumber -> asset details map -----------------------------
const assetByNumber = new Map();

const addAssets = (items, overwrite) => {
  for (const item of items) {
    const asset = unwrapAsset(item.json);
    if (!asset || !asset.assetNumber) continue; // skips error-branch items
    const price = parseFloat(asset.purchasePrice);
    if (Number.isNaN(price)) continue;
    const key = norm(asset.assetNumber);
    if (overwrite || !assetByNumber.has(key)) {
      assetByNumber.set(key, {
        price,
        assetId: asset.assetId,
        assetName: asset.assetName ?? '',
        serialNumber: asset.serialNumber ?? '',
      });
    }
  }
};

// Fallback first, then overwrite with post-registration values.
addAssets(collectRuns('Get Xero Asset Details'), false);
addAssets(collectRuns('Update Xero Asset Status to Registered'), true);
addAssets($input.all(), true); // loop "done" aggregate of the same responses

// ---- 2. Pull the invoice line items already built --------------------------
let invoiceLineItems;
try {
  invoiceLineItems = $('Build Xero Line Items Payload').first().json.lineItems;
} catch (e) {
  throw new Error(
    'Build Xero Line Items Payload has not run yet - the invoice line item loop must finish before the asset registration loop.'
  );
}

if (!Array.isArray(invoiceLineItems) || invoiceLineItems.length === 0) {
  throw new Error('No line items found on Build Xero Line Items Payload.');
}

// ---- 3. Rebuild line items from the Xero asset -----------------------------
const missingPurchasePrice = [];

const lineItems = invoiceLineItems.map((line) => {
  const asset = assetByNumber.get(norm(line.ItemCode));

  if (!asset) {
    missingPurchasePrice.push(line.ItemCode);
    console.log(`⚠ No Xero asset found for ${line.ItemCode} - UnitAmount set to 0, invoice description kept.`);
  }

  const unitAmount = asset ? asset.price : 0;
  const quantity = line.Quantity ?? 1;

  const description = asset
    ? `${asset.assetName}\nSerial Number ${asset.serialNumber}`
    : line.Description;

  return {
    Description: description,
    Quantity: quantity,
    UnitAmount: unitAmount,
    ItemCode: line.ItemCode,
    AccountCode: resolveBillAccountCode(line),
    LineAmount: Math.round(unitAmount * quantity * 100) / 100,
  };
});

return [
  {
    json: {
      lineItems,
      missingPurchasePrice,
      hasMissingPurchasePrice: missingPurchasePrice.length > 0,
    },
  },
];
