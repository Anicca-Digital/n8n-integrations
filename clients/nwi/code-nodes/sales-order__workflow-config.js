// Environment-specific values live here and nowhere else.
const bc = {
  baseUrl: 'https://api.businesscentral.dynamics.com/v2.0',
  tenantId: '0dc6b780-5b9e-4809-afb6-6bc499280f23',
  environment: 'Production',
  companyName: 'National Weighing & Instrument', // the company's `name`; its GUID is looked up each run
};
bc.companiesUrl = `${bc.baseUrl}/${bc.tenantId}/${bc.environment}/api/v2.0/companies`;
return [{ json: {
  hubspot: {
    pipelineId: 'default',
    triggerProperty: 'closed_won',
    triggerValue: 'true',
    dealProperties: 'dealname,pipeline,dealstage,amount,bc_order_id,closed_won',
    companyProperties: 'name,address,address2,city,state,zip,country,phone,website,domain,business_central_id',
    contactProperties: 'firstname,lastname,email,phone',
    lineItemProperties: ['name', 'hs_sku', 'quantity', 'price'],
  },
  bc,
  // HubSpot country text -> BC country/region code (2-letter codes pass through as-is).
  countryMap: { 'australia': 'AU', 'new zealand': 'NZ', 'united states': 'US', 'united kingdom': 'GB', 'singapore': 'SG' },
} }];
