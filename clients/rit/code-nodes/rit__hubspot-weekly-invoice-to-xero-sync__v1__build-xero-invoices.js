const ctx = $('Collect Invoice Line Items Links').first().json;
const cfg = $('Workflow Config').first().json;
const lineItemById = {};
for (const item of $input.all()) {
  const r = item.json;
  if (!Array.isArray(r.results)) continue;             // the no-line-items path passes the context item straight through
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Line item read returned errors: ${JSON.stringify(r.errors)}`);
  }
  for (const li of r.results) lineItemById[String(li.id)] = li;
}
const prepared = [];
const failures = [];
for (const inv of ctx.xeroInvoices) {
  const company = ctx.companies[inv.companyId] || {};
  const ownerId = inv.ownerId || company.ownerId || null;
  const base = { hubspotInvoiceId: String(inv.invoiceId), invoiceNumber: inv.number || null, ownerId, purchaseOrderNumber: inv.po || '' };
  const fail = (msg) => failures.push({ ...base, stage: 'Prepare Xero invoice', errorMessage: msg });
  if (!company.xeroContactId) { fail(`${company.name || 'Company'} has no xero_customer_id on its HubSpot company record, so the invoice cannot be created in Xero.`); continue; }
  if (ctx.pagedInvoiceIds.includes(inv.invoiceId)) { fail('Invoice has more line items than one HubSpot read returns.'); continue; }
  const ids = ctx.lineItemIdsByInvoice[inv.invoiceId] || [];
  if (!ids.length) { fail('HubSpot invoice has no line items.'); continue; }
  const region = String(company.state || '').trim().toUpperCase();
  const accountCode = cfg.stateAccounts[region] || cfg.defaultAccountId;
  try {
    const lineItems = ids.map(id => {
      const li = lineItemById[String(id)];
      if (!li) throw new Error(`Line item ${id} could not be read from HubSpot`);
      const p = li.properties || {};
      const amount = parseFloat(p.amount != null ? p.amount : parseFloat(p.price) * parseFloat(p.quantity == null ? 1 : p.quantity));
      if (!Number.isFinite(amount)) throw new Error(`Line item ${id} has a non-numeric amount`);
      const first = [p.asset_number, 'Weekly Invoice', p.name].filter(Boolean).join(' | ');
      const description = p.serial_number ? `${first}\nSerial Number ${p.serial_number}` : first;
      const line = { Description: description, Quantity: 1, UnitAmount: amount, AccountCode: accountCode, LineAmount: amount };
      if (p.asset_number) line.ItemCode = p.asset_number;
      return line;
    });
    const xeroInvoice = {
      Type: 'ACCREC', Contact: { ContactID: company.xeroContactId }, Date: inv.date, DueDate: inv.dueDate,
      InvoiceNumber: inv.number, Reference: inv.po, Status: cfg.invoiceStatus, CurrencyCode: cfg.currency,
      BrandingThemeID: cfg.brandingThemeId, LineItems: lineItems
    };
    prepared.push({ ...base, xeroInvoice });
  } catch (e) {
    fail(e.message);
  }
}
const { xeroInvoices, lineItemIdsByInvoice, lineItemIds, pagedInvoiceIds, ...rest } = ctx;
return [{ json: { ...rest, prepared, failures } }];
