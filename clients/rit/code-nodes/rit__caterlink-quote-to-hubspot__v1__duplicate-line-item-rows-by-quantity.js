const output = [];

const rateFields = ['rate12Month', 'rate24Month', 'rate36Month'];

for (const entry of $input.all()) {
  const item = entry.json;
  const qty = item.qty || 1;

  // pre-divide rates once per source item
  const dividedRates = {};
  for (const field of rateFields) {
    const raw = item[field];
    if (raw !== undefined && raw !== null && raw !== '') {
      const num = parseFloat(raw);
      dividedRates[field] = qty > 0 ? +(num / qty).toFixed(2) : num;
    }
  }

  for (let i = 1; i <= qty; i++) {
    output.push({
      json: {
        ...item,
        ...dividedRates,
        qty: 1,
        unitIndex: i,
        totalUnits: qty
      }
    });
  }
}

return output;
