const ctx = $input.first().json;
const size = $('Workflow Config').first().json.batchSize;
const list = ctx.lineItemInputs;
const chunks = [];
for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
// FAN-OUT: one item per batch of up to batchSize records. The HTTP node below runs once per batch.
return chunks.map(inputs => ({ json: { inputs } }));
