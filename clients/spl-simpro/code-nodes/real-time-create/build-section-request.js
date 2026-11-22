// Node: Build Section Request   ([SPL] Simpro -> HubSpot (Real Time))
// Quotes and jobs only: ask Simpro for the sections of the new quote/job (cost centers hang off sections).
// Any other record type ends here on purpose (no item out).
const cfg = $('Workflow Config').first().json;
if (cfg.type !== 'quote' && cfg.type !== 'job') return [];
return [{ json: { url: cfg.recordUrl + '/sections/?pageSize=250' } }];
