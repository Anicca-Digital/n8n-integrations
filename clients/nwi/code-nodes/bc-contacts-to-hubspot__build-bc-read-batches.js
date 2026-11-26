// Splits the changed BC contact numbers into batches so each BC page read and each HubSpot search
// covers many contacts in one call. Batch size comes from Workflow Config (batchSize).
const size = Number($('Workflow Config').first().json.batchSize) || 50;
const numbers = ($input.first().json.value || []).map((c) => c.number);
const batches = [];
for (let i = 0; i < numbers.length; i += size) {
  const chunk = numbers.slice(i, i + size);
  batches.push({ json: { numbers: chunk, filter: chunk.map((n) => `No eq '${n}'`).join(' or ') } });
}
return batches;
