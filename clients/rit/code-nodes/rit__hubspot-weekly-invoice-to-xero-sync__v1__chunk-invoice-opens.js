const ctx = $input.first().json;
const size = $('Workflow Config').first().json.openBatchSize;
const ids = ctx.openInvoiceIds;
const chunks = [];
for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
// FAN-OUT: one item per batch of invoices to open. draft -> open is a flag write, so it is safe to retry.
return chunks.map(c => ({ json: { inputs: c.map(id => ({ id, properties: { hs_invoice_status: 'open' } })) } }));
