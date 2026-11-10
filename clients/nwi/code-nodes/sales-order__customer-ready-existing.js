// Output of "Update BC Customer" is the updated Customer_Card record (customer number = "No").
const c = $input.first().json;
return [{ json: { customerNumber: c.No } }];
