// Node: Build Record Writes   ([SPL] HubSpot -> Simpro (Real Time))
// Create every planned record in Simpro (POST), throttled. Real Time only creates, it never updates.
const { records } = $('Resolve Plan').first().json;
const writes = records.map(r => ({ json: { method: 'POST', url: r.createUrl, body: r.body, meta: { type: r.type, hsId: r.hsId, kind: 'create' } } }));
if (writes.length === 0) return [{ json: { skip: true } }];
return writes;
