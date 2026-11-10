// One BC customer per HubSpot contact. Fails loudly if the deal can't become an order.
const dealId = String($('Get Deal').first().json.id);
const contacts = $('Get Deal Contact Associations').first().json.results || [];
const lineItems = $('Get Deal Line Item Associations').first().json.results || [];

if (contacts.length === 0) throw new Error(`Deal ${dealId} has no associated contact`);
if (lineItems.length === 0) throw new Error(`Deal ${dealId} has no line items`);

// HubSpot has no "primary contact" on a deal: with several contacts the first one returned is used.
return [{ json: {
  dealId,
  contactId: String(contacts[0].toObjectId),
  lineItemIds: lineItems.map((l) => String(l.toObjectId)),
} }];
