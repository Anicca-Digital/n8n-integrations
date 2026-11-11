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

// Fields written through the OData Customer_Card page (page field names).
// Segment and Responsibility_Center exist only on the page, not in the standard API.
const nonBlank = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
);
const pageFields = {
  Name: raw.displayName,
  Address: raw.addressLine1,
  City: raw.city,
  County: raw.state,
  Post_Code: raw.postalCode,
  Country_Region_Code: raw.country,
  Phone_No: cut(c.phone, 30),
  MobilePhoneNo: cut(c.mobilephone, 30),
  E_Mail: raw.email,
  Invoice_Email: raw.email,   // invoices go to the same address as the email field
  Home_Page: raw.website,
  Segment: cut(c.segment, 30),
  Responsibility_Center: cut(c.responsibility_center, 10),
  Location_Code: cut(c.location_code, 10),
  ABN: cut(c.abn, 30),
};
// New customer: posting groups first. Existing customer: never touch their posting groups.
const odataPayload = nonBlank({ ...cfg.bc.newCustomerDefaults, ...pageFields });
const odataUpdatePayload = nonBlank(pageFields);

// The HubSpot contact becomes the BC customer's primary contact (shows as "ERC Primary Contact Name").
// Skipped when the HubSpot contact has no first or last name.
const personName = [c.firstname, c.lastname].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
const personContact = personName
  ? nonBlank({ displayName: cut(personName, 100), email: cut(c.email, 80), phoneNumber: cut(c.phone, 30), mobilePhoneNumber: cut(c.mobilephone, 30) })
  : null;

const bcId = String(c.business_central_record_id || '').trim();
const isGuid = /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(bcId);
const bcCustomerFilter = isGuid ? `id eq ${bcId}` : `number eq '${bcId.replace(/'/g, "''")}'`;

return [{ json: { hasBcId: bcId !== '', bcId, bcCustomerFilter, customerPayload, odataPayload, odataUpdatePayload, personContact } }];
