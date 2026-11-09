// BC API URLs need the company GUID. Resolve it from the company name; fail if it is not exactly one.
const bc = $('Workflow Config').first().json.bc;
const found = $input.first().json.value || [];
if (found.length !== 1) {
  throw new Error(`Expected exactly one Business Central company named "${bc.companyName}" but found ${found.length}`);
}
return [{ json: { companyId: found[0].id, apiRoot: `${bc.companiesUrl}(${found[0].id})` } }];
