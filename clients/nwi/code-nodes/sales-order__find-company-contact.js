// The customer's company contact in BC (type Company). The Person contact is created under it.
const cust = ($input.first().json.value || [])[0];
if (!cust) throw new Error('Business Central customer not found when looking up its contacts');
const company = (cust.contactsInformation || []).find((x) => x.contactType === 'Company');
if (!company) throw new Error(`BC customer ${cust.number} has no company contact`);

const p = $('Build Customer Payload').first().json.personContact;
const q = (s) => String(s).replace(/'/g, "''");
const match = p.email ? `email eq '${q(p.email)}'` : `displayName eq '${q(p.displayName)}'`;
const createContactPayload = Object.fromEntries(
  Object.entries({ type: 'Person', companyNumber: company.contactNumber, ...p })
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
);
return [{ json: {
  customerNumber: cust.number,
  companyContactNumber: company.contactNumber,
  contactFilter: `type eq 'Person' and companyNumber eq '${company.contactNumber}' and ${match}`,
  createContactPayload,
} }];
