const size = $('Workflow Config').first().json.batchSize;
const failures = $input.first().json.failures;
const taskInputs = failures.map(p => {
  const properties = {
    hs_task_subject: `Xero sync error - Invoice ${p.purchaseOrderNumber || p.invoiceNumber || p.hubspotInvoiceId}`,
    hs_task_body: `An error occurred while preparing this invoice for Xero.\n\nFailed step: ${p.stage}\nHubSpot invoice ID: ${p.hubspotInvoiceId}\nInvoice number: ${p.invoiceNumber ?? ''}\nPO Number: ${p.purchaseOrderNumber ?? ''}\nError: ${String(p.errorMessage).slice(0, 2000)}\n\nThe HubSpot invoice is open but not in Xero. Fix the cause; a re-run the same day retries it automatically.`,
    hs_task_status: 'NOT_STARTED',
    hs_task_priority: 'HIGH',
    hs_task_type: 'TODO',
    hs_timestamp: new Date().toISOString()
  };
  if (p.ownerId) properties.hubspot_owner_id = p.ownerId;
  return { properties };
});
const chunks = [];
for (let i = 0; i < taskInputs.length; i += size) chunks.push(taskInputs.slice(i, i + size));
// FAN-OUT: one item per batch of tasks. Emits nothing when there are no failures, which simply ends this side branch.
return chunks.map(inputs => ({ json: { inputs } }));
