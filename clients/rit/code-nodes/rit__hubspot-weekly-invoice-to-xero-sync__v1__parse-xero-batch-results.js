// Xero returns HTTP 200 for a batch even when individual invoices were rejected, so every invoice
// is checked on its own. Results are matched to HubSpot records by position AND invoice number.
const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
const build = $('Build Xero Batch Payload').first().json;
const submitted = build.submitted;
const resp = $input.first().json;

const failAll = (stage, errorMessage) => [{
  json: {
    batchNumber: build.batchNumber,
    okInvoices: [],
    failures: submitted.map((s) => ({ ...s, stage, errorMessage })),
  },
}];

// 1. The whole request failed (network, auth, 4xx/5xx, timeout)
if (resp.error || !Array.isArray(resp.Invoices)) {
  const e = resp.error;
  const detail = typeof e === 'string' ? e : [e?.message, e?.description].filter(Boolean).join(' - ') || 'no Invoices array in the response';
  return failAll('Xero create (whole batch)', `Xero batch request failed: ${detail}. No invoices from this batch were written to HubSpot.`);
}

// 2. Positional mapping is only safe if the counts and invoice numbers line up
const returned = resp.Invoices;
const numberMismatch = returned.some((inv, i) => submitted[i] && submitted[i].invoiceNumber && inv.InvoiceNumber && inv.InvoiceNumber !== submitted[i].invoiceNumber);
if (returned.length !== submitted.length || numberMismatch) {
  return failAll('Xero create (response mismatch)',
    `Xero returned ${returned.length} invoice(s) for ${submitted.length} submitted (or invoice numbers did not line up), so results cannot be matched safely. Some invoices may exist in Xero - check Xero for this batch before re-running. Nothing was written to HubSpot.`);
}

// 3. Per-invoice outcome
const okInvoices = [];
const failures = [];
returned.forEach((inv, i) => {
  const s = submitted[i];
  const errs = (inv.ValidationErrors || []).map((e) => e.Message).filter(Boolean);
  const created = inv.InvoiceID && inv.InvoiceID !== ZERO_GUID && inv.StatusAttributeString !== 'ERROR' && !inv.HasErrors;
  if (created) {
    okInvoices.push({ ...s, xeroInvoiceId: inv.InvoiceID });
  } else {
    failures.push({ ...s, stage: 'Xero create', errorMessage: errs.length ? errs.join(' | ') : `Xero rejected the invoice (status ${inv.StatusAttributeString ?? 'unknown'})` });
  }
});

console.log(`Batch ${build.batchNumber}: ${okInvoices.length} created, ${failures.length} rejected`);
return [{ json: { batchNumber: build.batchNumber, okInvoices, failures } }];
