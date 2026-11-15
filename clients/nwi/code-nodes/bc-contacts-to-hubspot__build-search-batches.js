// Splits the changed BC contact numbers into batches of up to 100 (the HubSpot search IN limit),
// so one search call finds the HubSpot contacts for a whole batch.
const numbers = ($input.first().json.value || []).map((c) => c.number);
const batches = [];
for (let i = 0; i < numbers.length; i += 100) batches.push({ json: { numbers: numbers.slice(i, i + 100) } });
return batches;
