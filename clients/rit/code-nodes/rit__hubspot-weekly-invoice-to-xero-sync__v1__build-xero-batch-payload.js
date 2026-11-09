// Turns this batch of prepared invoices into ONE Xero request body.
const MAX_BATCH = 100;           // HubSpot batch update / task-create endpoints accept at most 100 records
const MAX_BYTES = 3000000;       // Xero rejects a POST over 3.5 MB; stay clear of it

const items = $input.all();
if (!items.length) throw new Error('Build Xero Batch Payload received no invoices');
if (items.length > MAX_BATCH) {
  throw new Error(`Batch of ${items.length} exceeds ${MAX_BATCH}. Lower xeroBatchSize in Workflow Config.`);
}

// Drop null / empty values - a blank field can make Xero reject an otherwise valid invoice.
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

const payload = { Invoices: items.map((i) => clean(i.json.xeroInvoice)) };

const bytes = JSON.stringify(payload).length;
if (bytes > MAX_BYTES) {
  throw new Error(`Batch payload is ${bytes} bytes (limit ~3.5 MB). Lower xeroBatchSize in Workflow Config.`);
}

// What we sent, in the same order - used to match Xero's response back to HubSpot records.
const submitted = items.map((i) => ({
  hubspotInvoiceId: String(i.json.hubspotInvoiceId),
  invoiceNumber: i.json.invoiceNumber ?? null,
  ownerId: i.json.ownerId ?? null,
  purchaseOrderNumber: i.json.purchaseOrderNumber ?? '',
}));

const batchNumber = $runIndex + 1;
console.log(`Batch ${batchNumber}: ${items.length} invoice(s), ${bytes} bytes`);

return [{ json: { batchNumber, count: items.length, payloadBytes: bytes, payload, submitted } }];
