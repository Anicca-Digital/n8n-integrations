// Gathers every failure from this batch into HubSpot task inputs (one per invoice, assigned to the invoice owner).
// Input is EITHER the write-back response (when invoices were created) OR the parsed result itself (when none were).
const parsed = $('Parse Xero Batch Results').first().json;
const incoming = $input.first().json;
const ranWriteBack = !Array.isArray(incoming.okInvoices);

const problems = parsed.failures.map((f) => ({ ...f }));

if (ranWriteBack && parsed.okInvoices.length) {
  let missed = [];
  let reason = '';
  if (incoming.error) {
    const e = incoming.error;
    reason = typeof e === 'string' ? e : [e?.message, e?.description].filter(Boolean).join(' - ') || 'unknown error';
    missed = parsed.okInvoices;
  } else {
    const done = new Set((incoming.results || []).map((r) => String(r.id)));
    missed = parsed.okInvoices.filter((o) => !done.has(String(o.hubspotInvoiceId)));
    reason = incoming.errors?.[0]?.message ?? 'HubSpot did not confirm the update';
  }
  for (const o of missed) {
    problems.push({
      ...o,
      stage: 'HubSpot write-back',
      errorMessage: `The Xero invoice WAS created (Xero InvoiceID ${o.xeroInvoiceId}) but xero_invoice_id could not be saved on the HubSpot invoice: ${reason}. Set it manually before the next run or the invoice may be created twice.`,
    });
  }
}

const taskInputs = problems.map((p) => {
  const properties = {
    hs_task_subject: `Xero sync error - Invoice ${p.purchaseOrderNumber || p.invoiceNumber || p.hubspotInvoiceId}`,
    hs_task_body: `An error occurred while syncing this invoice to Xero.\n\nFailed step: ${p.stage}\nHubSpot invoice ID: ${p.hubspotInvoiceId}\nInvoice number: ${p.invoiceNumber ?? ''}\nPO Number: ${p.purchaseOrderNumber ?? ''}\nBatch: ${parsed.batchNumber}\nError: ${String(p.errorMessage).slice(0, 2000)}`,
    hs_task_status: 'NOT_STARTED',
    hs_task_priority: 'HIGH',
    hs_task_type: 'TODO',
    hs_timestamp: new Date().toISOString(),
  };
  if (p.ownerId) properties.hubspot_owner_id = p.ownerId;
  return { properties };
});

return [{ json: {
  batchNumber: parsed.batchNumber,
  created: parsed.okInvoices.length - problems.filter((p) => p.stage === 'HubSpot write-back').length,
  failed: problems.length,
  taskInputs,
} }];
