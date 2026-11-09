// Runs on a genuine failure. Throwing fails the execution so the shared Error Workflow emails the team.
const first = $input.first().json;
// End-of-run path: one or more line items failed. Include the full summary in the alert.
if (first.report) {
  throw new Error(`Caterlink delivery invoice (PO ${first.poNum || 'unknown'}): ${first.failed} of ${first.total} line item(s) failed.\n\n${first.report}`);
}
const src = (typeof $prevNode !== 'undefined' && $prevNode && $prevNode.name) || 'unknown step';
const err = $input.first().json.error || {};
let po = 'unknown';
try { po = $('Parse Invoice PDF').first().json.poNum || 'unknown'; } catch (e) {}
throw new Error(
  `Caterlink delivery invoice (PO ${po}) failed at "${src}": ${err.message || err.description || JSON.stringify(err).slice(0, 300)}`
);
