// Runs alongside the sender notice on a genuine failure. Throwing fails the execution so the shared Error Workflow emails the team.
const src = (typeof $prevNode !== 'undefined' && $prevNode && $prevNode.name) || 'unknown step';
const err = $input.first().json.error || {};
let proposal = 'unknown';
try { proposal = $('Parse Quote PDF').first().json.deal.proposalNumber || 'unknown'; } catch (e) {}
throw new Error(
  `Caterlink quote ${proposal} failed at "${src}": ${err.message || err.description || JSON.stringify(err).slice(0, 300)}`
);
