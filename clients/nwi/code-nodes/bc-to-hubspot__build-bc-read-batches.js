// Splits the changed BC order numbers into batches so each BC read and each HubSpot search
// covers many orders in one call. Batch size comes from Workflow Config (batchSize).
const size = Number($('Workflow Config').first().json.batchSize) || 50;
const numbers = ($input.first().json.value || []).map((o) => o.number);
const batches = [];
for (let i = 0; i < numbers.length; i += size) {
  const chunk = numbers.slice(i, i + size);
  batches.push({ json: {
    numbers: chunk,
    filter: `Document_Type eq 'Order' and (${chunk.map((n) => `No eq '${n}'`).join(' or ')})`,
  } });
}
return batches;
