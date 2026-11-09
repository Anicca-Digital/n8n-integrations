const ACCOUNTS = [
  { accountId: 'WA1106', name: 'Secutiry Deposits (WA)' },
  { accountId: 'VIC1106', name: 'Secutiry Deposits (VIC)' },
  { accountId: '1106', name: 'Secutiry Deposits (Legacy)' },
];
const DEFAULT_ACCOUNT_ID = '1106';

for (const item of $input.all()) {
  let region = null;
  try {
    region = $('Loop Over Line Items').item.json.state ?? null;
  } catch (e) {
    console.log('Could not resolve item from Loop Through Line Items:', e.message);
  }

  if (region == null) {
    console.log('⚠ No state found on the Loop Through Line Items item — region will be null.');
  }

  const matchedAccount = region ? ACCOUNTS.find((a) => a.name.includes(region)) : null;

  item.json.region = region;
  item.json.account_id = matchedAccount ? matchedAccount.accountId : DEFAULT_ACCOUNT_ID;
}

return $input.all();
