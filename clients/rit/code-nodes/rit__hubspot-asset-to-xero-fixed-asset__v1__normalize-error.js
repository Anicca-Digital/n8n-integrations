/**
 * Normalizes error context from whichever node failed (HubSpot fetch,
 * Xero asset/item creation, write-back) into one item for Raise Error.
 */
function safeGet(fn, fallback) {
  try {
    const val = fn();
    return val === undefined || val === null ? fallback : val;
  } catch (e) {
    return fallback;
  }
}

const rawError = $json.error;
let errorMessage =
  typeof rawError === "string"
    ? rawError
    : rawError?.message || $json.message || "Unknown error - check execution log";
errorMessage = errorMessage.replace(/\s*\[line \d+\]\s*$/i, "");

const failedNode = (typeof $prevNode !== 'undefined' && $prevNode && $prevNode.name) || "unknown";
const assetId = safeGet(() => $('Get Asset Details').item.json.id, "unknown");
const serialNumber = safeGet(() => $('Get Asset Details').item.json.properties.serial_number, "");
const dealId = safeGet(() => $('Receive Closed Won Deal Webhook').first().json.body.hs_object_id, "unknown");

return { json: { errorMessage, failedNode, assetId, serialNumber, dealId } };
