
const parsed = $('Parse Quote PDF').item.json;
return [{
  json: {
    message: `Contact has no valid email (quote may show a placeholder like "TBC") - contact was not created automatically. Please create the contact manually in HubSpot and link it to the deal.`,
    poNum: parsed.deal.proposalNumber,
    description: parsed.contact.firstName ? `${parsed.contact.firstName} ${parsed.contact.lastName || ""}`.trim() : "unknown contact",
  },
}];
