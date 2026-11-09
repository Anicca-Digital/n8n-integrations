/**
 * Matches a state/region against a hardcoded list of Xero Asset Types
 * and returns the matching assetTypeId. Falls back to the "Legacy"
 * asset type if no exact region match is found.
 */

// ==== ASSET TYPES (hardcoded) ====
const assetTypes = [
  {
    assetTypeId: 'df53318e-024d-4762-b99c-ac4fce94e910',
    assetTypeName: 'Legacy Rental Asset',
  },
  {
    assetTypeId: '034b445f-23dd-4b76-a96c-15b9258bc612',
    assetTypeName: 'VIC Rental Asset',
  },
  {
    assetTypeId: '73e83679-cfee-4a78-ab6b-587c271d24f4',
    assetTypeName: 'WA Rental Asset',
  },
];

// ==== CONFIG ====
// Region/state value comes from the incoming webhook body (see the pinned
// example item on the trigger node: body.stateregion).
const region = $input.first().json.body.stateregion;

if (!region) {
  throw new Error('No region/state value provided — check the CONFIG section of this node.');
}

const normalize = (s) => (s || '').toString().trim().toLowerCase();
const regionNorm = normalize(region);

// Exact-contains match on asset type name (e.g. "VIC" matches "VIC Rental Asset")
const match = assetTypes.find(a => normalize(a.assetTypeName).includes(regionNorm));

// Fallback: the Legacy asset type
const legacy = assetTypes.find(a => normalize(a.assetTypeName).includes('legacy'));

const result = match || legacy;

if (!result) {
  throw new Error(
    `No asset type found matching region "${region}", and no Legacy fallback asset type exists.`
  );
}

return [
  {
    json: {
      assetTypeId: result.assetTypeId,
      assetTypeName: result.assetTypeName,
      matchedByRegion: !!match,
    },
  },
];
