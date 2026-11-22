// Node: Build Simpro Reads   (all five HubSpot -> Simpro sync workflows)
// Compare before write: for every record that already has a Simpro ID, read what Simpro holds today, so we only
// write when something really differs. This is what stops the HubSpot <-> Simpro ping-pong. Reads are throttled.
const { records } = $('Resolve Plan').first().json;
const reads = records.filter(r => r.simproId).map(r => ({ json: { url: r.updateUrl, meta: { hsId: r.hsId } } }));
if (reads.length === 0) return [{ json: { skip: true } }];
return reads;
