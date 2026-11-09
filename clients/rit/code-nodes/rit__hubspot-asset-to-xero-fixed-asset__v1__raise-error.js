// Final step of the error path. Throwing fails the execution so the shared Error Workflow emails the team.
let ctx = {};
try { ctx = $('Normalize Error').first().json; } catch (e) {}
const serial = ctx.serialNumber ? ` (serial ${ctx.serialNumber})` : '';
const hint = ctx.failedNode === 'Create Fixed Asset in Xero'
  ? ' Check the Asset Number is unique in Xero before re-enrolling the deal.'
  : '';
throw new Error(
  `Xero asset sync failed at "${ctx.failedNode || 'unknown step'}" for HubSpot asset ${ctx.assetId || 'unknown'}${serial} on deal ${ctx.dealId || 'unknown'}: ${ctx.errorMessage || 'see execution log'}.${hint}`
);
