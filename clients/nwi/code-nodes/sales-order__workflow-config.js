// Environment-specific values live here and nowhere else.
const bc = {
  baseUrl: 'https://api.businesscentral.dynamics.com/v2.0',
  tenantId: '0dc6b780-5b9e-4809-afb6-6bc499280f23',
  environment: 'Production',
  companyId: '4b4f1461-9f6d-ea11-a813-000d3acaa8ce', // National Weighing & Instrument (from GET .../api/v2.0/companies)
};
bc.apiRoot = `${bc.baseUrl}/${bc.tenantId}/${bc.environment}/api/v2.0/companies(${bc.companyId})`;
// New customers are CREATED through the OData Customer_Card page (web service published in BC).
// The standard API create fails: BC applies the customer template's GST 10% default, which does not exist.
// Updates, lookups and sales orders still use the standard API.
bc.companyName = 'National Weighing & Instrument';
bc.customerCardUrl = `${bc.baseUrl}/${bc.tenantId}/${bc.environment}/ODataV4/Company('${encodeURIComponent(bc.companyName)}')/Customer_Card`;
// Same values as existing customers (e.g. CM007815). Sent first so BC does not apply the template's bad GST group.
bc.newCustomerDefaults = { Gen_Bus_Posting_Group: 'DOMESTIC', VAT_Bus_Posting_Group: 'DOMESTIC', Customer_Posting_Group: 'DOMESTIC' };
return [{ json: {
  hubspot: {
    pipelineId: 'default',
    // Any ONE of these starts the sync. Subscribe the HubSpot webhook to whichever property you use.
    triggers: [
      { property: 'dealstage', value: 'closedwon' },
      { property: 'hs_is_closed_won', value: 'true' },
      { property: 'closed_won', value: 'true' },
    ],
    dealProperties: 'dealname,pipeline,dealstage,amount,bc_order_id,hs_is_closed_won,closed_won',
    contactProperties: 'firstname,lastname,company,email,phone,mobilephone,address,city,state,zip,country,website,business_central_id',
    lineItemProperties: ['name', 'hs_sku', 'quantity', 'price'],
  },
  bc,
  // HubSpot country text -> BC country/region code (2-letter codes pass through as-is).
  countryMap: { 'australia': 'AU', 'new zealand': 'NZ', 'united states': 'US', 'united kingdom': 'GB', 'singapore': 'SG' },
} }];
