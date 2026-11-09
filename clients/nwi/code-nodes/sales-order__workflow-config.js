// Environment-specific values live here and nowhere else.
// REPLACE_* values must be filled in before publishing (see the sticky note).
const bc = {
  baseUrl: 'https://api.businesscentral.dynamics.com/v2.0',
  tenantId: 'REPLACE_ENTRA_TENANT_ID',
  environment: 'REPLACE_BC_ENVIRONMENT_NAME',   // e.g. Production or Sandbox
  companyId: 'REPLACE_BC_COMPANY_GUID',         // GET .../api/v2.0/companies
};
bc.apiRoot = `${bc.baseUrl}/${bc.tenantId}/${bc.environment}/api/v2.0/companies(${bc.companyId})`;
return [{ json: {
  hubspot: {
    pipelineId: 'default',
    closedWonStageId: 'closedwon',
    dealProperties: 'dealname,pipeline,dealstage,amount,bc_order_id',
    companyProperties: 'name,address,address2,city,state,zip,country,phone,website,domain,business_central_id',
    contactProperties: 'firstname,lastname,email,phone',
    lineItemProperties: ['name', 'hs_sku', 'quantity', 'price'],
  },
  bc,
  // HubSpot country text -> BC country/region code (2-letter codes pass through as-is).
  countryMap: { 'australia': 'AU', 'new zealand': 'NZ', 'united states': 'US', 'united kingdom': 'GB', 'singapore': 'SG' },
} }];
