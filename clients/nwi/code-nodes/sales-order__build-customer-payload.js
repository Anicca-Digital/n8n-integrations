// Builds the Business Central customer from the HubSpot contact.
// One contact = one BC customer. The contact hosts all the properties;
// the BC customer NAME is the contact's Company name property.
// Input ($input) is the Get Contact response.
const cfg = $('Workflow Config').first().json;
const contact = $input.first().json;
const c = contact.properties || {};

const name = String(c.company || '').trim();
if (!name) throw new Error(`HubSpot contact ${contact.id} has no Company name (property "company"), which becomes the BC customer name`);

const countryRaw = String(c.country || '').trim();
let country;
if (/^[A-Za-z]{2}$/.test(countryRaw)) country = countryRaw.toUpperCase();
else country = cfg.countryMap[countryRaw.toLowerCase()];   // undefined = omitted, BC keeps its value

const cut = (v, n) => (v === undefined || v === null ? undefined : String(v).trim().slice(0, n));
const raw = {
  displayName: cut(name, 100),
  type: 'Company',
  addressLine1: cut(c.address, 100),
  city: cut(c.city, 30),
  state: cut(c.state, 30),
  country,
  postalCode: cut(c.zip, 20),
  phoneNumber: cut(c.phone || c.mobilephone, 30),
  email: cut(c.email, 80),
  website: cut(c.website, 80),
};
// Never send blanks: on update they would wipe values already in Business Central.
const customerPayload = Object.fromEntries(
  Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
);

// New customers go through the OData Customer_Card page, which uses page field names.
const odataPayload = Object.fromEntries(Object.entries({
  ...cfg.bc.newCustomerDefaults,   // posting groups first
  Name: raw.displayName,
  Address: raw.addressLine1,
  City: raw.city,
  County: raw.state,
  Post_Code: raw.postalCode,
  Country_Region_Code: raw.country,
  Phone_No: raw.phoneNumber,
  E_Mail: raw.email,
  Home_Page: raw.website,
}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''));

const bcId = String(c.business_central_id || '').trim();
const isGuid = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(bcId);
const bcCustomerFilter = isGuid ? `id eq ${bcId}` : `number eq '${bcId.replace(/'/g, "''")}'`;

return [{ json: { hasBcId: bcId !== '', bcId, bcCustomerFilter, customerPayload, odataPayload } }];
