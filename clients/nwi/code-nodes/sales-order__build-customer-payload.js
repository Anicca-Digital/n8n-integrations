// Builds the Business Central customer from the HubSpot company (+ contact).
// Input ($input) is the contact record, or the empty contact.
const cfg = $('Workflow Config').first().json;
const company = $('Get Company').first().json.properties || {};
const contact = $input.first().json.properties || {};

const name = String(company.name || '').trim();
if (!name) throw new Error(`HubSpot company ${$('Get Company').first().json.id} has no name`);

const countryRaw = String(company.country || '').trim();
let country;
if (/^[A-Za-z]{2}$/.test(countryRaw)) country = countryRaw.toUpperCase();
else country = cfg.countryMap[countryRaw.toLowerCase()];   // undefined = omitted, BC keeps its value

const cut = (v, n) => (v === undefined || v === null ? undefined : String(v).trim().slice(0, n));
const raw = {
  displayName: cut(name, 100),
  type: 'Company',
  addressLine1: cut(company.address, 100),
  addressLine2: cut(company.address2, 50),
  city: cut(company.city, 30),
  state: cut(company.state, 30),
  country,
  postalCode: cut(company.zip, 20),
  phoneNumber: cut(company.phone || contact.phone, 30),
  email: cut(contact.email, 80),
  website: cut(company.website || company.domain, 80),
};
// Never send blanks: on update they would wipe values already in Business Central.
const customerPayload = Object.fromEntries(
  Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
);

const bcId = String(company.business_central_id || '').trim();
const isGuid = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(bcId);
const bcCustomerFilter = isGuid ? `id eq ${bcId}` : `number eq '${bcId.replace(/'/g, "''")}'`;

return [{ json: { hasBcId: bcId !== '', bcId, bcCustomerFilter, customerPayload } }];
