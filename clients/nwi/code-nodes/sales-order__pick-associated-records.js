// Decide which associated records to use. Fails loudly if the deal can't become an order.
const dealId = String($('Get Deal').first().json.id);
const companies = $('Get Deal Company Associations').first().json.results || [];
const contacts = $('Get Deal Contact Associations').first().json.results || [];
const lineItems = $('Get Deal Line Item Associations').first().json.results || [];

if (companies.length === 0) throw new Error(`Deal ${dealId} has no associated company`);
if (lineItems.length === 0) throw new Error(`Deal ${dealId} has no line items`);

// Primary company is association type 5; otherwise the first one.
const isPrimary = (a) => (a.associationTypes || []).some((t) => t.typeId === 5);
const company = companies.find(isPrimary) || companies[0];

return [{ json: {
  dealId,
  companyId: String(company.toObjectId),
  contactId: contacts.length ? String(contacts[0].toObjectId) : null,
  lineItemIds: lineItems.map((l) => String(l.toObjectId)),
} }];
