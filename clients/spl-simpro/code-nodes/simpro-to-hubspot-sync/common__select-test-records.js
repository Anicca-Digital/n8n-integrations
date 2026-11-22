// Node: Select Test Records   (all five sync workflows)
// Collapses the per-record Simpro detail results into ONE item and applies the test-record rule
// BEFORE anything is written to HubSpot. Same rule as [SPL] Check Simpro Test Record:
//   Contacts: email domain is one of testRecords.contactEmailDomains (exact match, not case-sensitive).
//   Everything else: name starts with testRecords.namePrefix (not case-sensitive).
//   Optional extra rule (set per workflow in Build Sync Window, currently the Companies Sync only):
//   testRecords.orEmailDomains = the record is ALSO a test record when its own Email has one of these domains
//   (exact domain, not case-sensitive). Same rule as the Real Time workflow: name OR email domain.
// Do not loosen this without asking SPL.
const cfg = $('Build Sync Window').first().json;
const ids = $('Build Record List').all().map(i => String(i.json.id));
const prefix = String(cfg.testRecords.namePrefix).toLowerCase();
const domains = cfg.testRecords.contactEmailDomains.map(d => String(d).trim().toLowerCase()).filter(Boolean);
const orDomains = (cfg.testRecords.orEmailDomains ?? []).map(d => String(d).trim().toLowerCase()).filter(Boolean);

const isTestRecord = (rec) => {
  if (cfg.recordType === 'contact') {
    const email = String(rec.Email ?? '').trim().toLowerCase();
    const domain = email.includes('@') ? email.split('@').pop() : '';
    return domains.includes(domain);
  }
  const name = String(rec.Name ?? rec.CompanyName ?? [rec.GivenName, rec.FamilyName].filter(Boolean).join(' ')).trim();
  if (name.toLowerCase().startsWith(prefix)) return true;
  if (orDomains.length === 0) return false;
  const ownEmail = String(rec.Email ?? '').trim().toLowerCase();
  const ownDomain = ownEmail.includes('@') ? ownEmail.split('@').pop() : '';
  return ownDomain !== '' && orDomains.includes(ownDomain);
};

const records = [];
let skippedNonTest = 0;
const skippedGone = [];
const failures = [];

$input.all().forEach((item, k) => {
  // With "continue on error" a failed fetch comes back as an item carrying `error`, paired to its input item.
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const simproId = ids[idx];
  const j = item.json ?? {};
  if (j.error !== undefined && (j.ID === undefined || j.ID === null)) {
    const msg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
    if (/\b404\b|could not be found|not found/i.test(msg)) skippedGone.push(simproId); // deleted since it was listed
    else failures.push({ type: cfg.recordType, id: simproId, error: msg.slice(0, 300) });
    return;
  }
  if (j.ID === undefined || j.ID === null) {
    failures.push({ type: cfg.recordType, id: simproId, error: 'Simpro returned a record with no ID' });
    return;
  }
  if (isTestRecord(j)) records.push(j);
  else skippedNonTest++;
});

return [{ json: { fetched: ids.length, records, skippedNonTest, skippedGone, failures } }];
