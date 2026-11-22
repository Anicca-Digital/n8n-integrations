// Node: Workflow Config   ([SPL] Simpro -> HubSpot (Real Time))
// Single source of truth for this workflow: edit values HERE only.
// It also turns the Simpro webhook event into "which record type is this and where do I fetch it".
// An event for a record type we do not handle ends here on purpose (no item out).
const CONFIG = {
  simproBaseUrl: 'https://spl.simprosuite.com/api/v1.0',
  hubspotApiBase: 'https://api.hubapi.com',
  // --- Test-record rule (do not loosen without asking SPL) ---
  // A record is a test record when EITHER its name starts with testNamePrefix OR its email (if it has one) has one
  // of testEmailDomains. Both checks are case-insensitive; the domain must match exactly.
  testNamePrefix: 'HSTEST-',
  testEmailDomains: ['aniccadigital.io', 'spl.com.au'],
  // --- HubSpot object paths, unique Simpro-ID properties and association API names ---
  objects: {
    site: { path: 'crm/objects/2026-09/0-420', idProperty: 'simpro_site_id', assoc: '0-420' },
    company: { path: 'crm/objects/2026-09/companies', idProperty: 'simpro_customer_id', assoc: 'companies' },
    contact: { path: 'crm/objects/2026-09/contacts', idProperty: 'simpro_contact_id', assoc: 'contacts' },
    quote: { path: 'crm/objects/2026-09/deals', idProperty: 'simpro_quote_id', assoc: 'deals' }, // a quote is a deal
    job: { path: 'crm/objects/2026-09/deals', idProperty: 'simpro_job_id', assoc: 'deals' },
  },
  // --- Custom association labels (HubSpot user-defined) ---
  decisionMaker: [{ associationCategory: 'USER_DEFINED', associationTypeId: 10 }], // primary contact on a quote/job deal
  quoteJob: [{ associationCategory: 'USER_DEFINED', associationTypeId: 11 }], // label "Job" on the quote, "Quote" on the job; quote is the FROM side
  // --- Quote deals ---
  quote: {
    pipeline: 'default',
    stageToBeCompleted: '3788243436', // Quote to be completed / Quote overdue
    stageWon: 'closedwon',
    stageLost: 'closedlost',
    stageDefault: '3788243437',
    cfTenderNumber: 35, // Simpro custom field IDs
    cfTenderStatus: 36,
    cfVertical: 49,
  },
  // --- Job deals ---
  job: {
    pipeline: '2172954069',
    stagePending: '3783391728',
    stageProgress: '3783391729',
    stageComplete: '3783391730',
    stageArchived: '3783391734',
    stageDefault: '3783391728',
  },
};

const body = $input.first().json.body ?? {};
const r = body.reference ?? {};
const ROUTES = {
  'Site': { type: 'site', id: r.siteID, path: 'companies/' + r.companyID + '/sites/' + r.siteID },
  'Company customer': { type: 'company', id: r.customerID, path: 'companies/0/customers/companies/' + r.customerID },
  'Contact': { type: 'contact', id: r.contactID, path: 'companies/0/contacts/' + r.contactID },
  'Quote': { type: 'quote', id: r.quoteID, path: 'companies/' + r.companyID + '/quotes/' + r.quoteID },
  'Job': { type: 'job', id: r.jobID, path: 'companies/' + r.companyID + '/jobs/' + r.jobID },
};
const route = ROUTES[body.name];
if (!route || route.id === undefined || route.id === null) return []; // not a record type we handle

return [{ json: {
  ...CONFIG,
  type: route.type,
  simproId: String(route.id),
  recordUrl: CONFIG.simproBaseUrl + '/' + route.path,
  event: { name: body.name, action: body.action ?? null },
} }];
