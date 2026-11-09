function splitAddress(line) {
  if (!line) return { suburb: null, state: null, postcode: null };
  const m = line.match(/^(.*)\s+([A-Z]{2,3})\s+(\d{4})$/);
  return m ? { suburb: m[1].trim(), state: m[2], postcode: m[3] } : { suburb: line, state: null, postcode: null };
}

function splitName(full) {
  if (!full) return { firstName: null, lastName: null };
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || null };
}

const ROW_START = /^\s*(\d+\.\d{2})(?:\s+(.*))?$/;
const ROW_END = /(?:^|\s)(\d+)\.\d{2}\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const CODE_TOKEN = /^[A-Z0-9][A-Z0-9\-\/.]*$/;
const MODEL_LINE_MAX_TOKENS = 3;

const tokensOf = (s) => s.trim().split(/\s+/).filter(Boolean);
const clean = (s) => s.replace(/\s+/g, " ").trim();

function splitModelDescription(lines) {
  if (lines.length > 1 && tokensOf(lines[0]).length <= MODEL_LINE_MAX_TOKENS) {
    let i = 0;
    let model = lines[i].trim();
    while (/-$/.test(model) && i < lines.length - 2) {
      i++;
      model += lines[i].trim();
    }
    return { model: clean(model), description: clean(lines.slice(i + 1).join(" ")) };
  }
  const first = tokensOf(lines[0]);
  let n = 1;
  while (n < first.length && CODE_TOKEN.test(first[n]) && (first[n].length > 1 || /\d/.test(first[n]))) n++;
  const model = first.slice(0, n).join(" ");
  const description = [first.slice(n).join(" "), ...lines.slice(1)].join(" ");
  return { model: clean(model), description: clean(description) };
}

function parseLineItems(text) {
  const allLines = text.split("\n");
  let stop = allLines.findIndex(
    (l) => /^\s*\$[\d,]+\.\d{2}/.test(l) || /Weekly Sub Total/.test(l)
  );
  if (stop === -1) stop = allLines.length;
  const lines = allLines.slice(0, stop);

  const items = [];
  let cur = null;

  const feed = (chunk) => {
    const end = chunk.match(ROW_END);
    if (end) {
      const prefix = chunk.slice(0, end.index).trim();
      if (prefix) cur.lines.push(prefix);
      cur.qty = parseInt(end[1], 10);
      [cur.rate12Month, cur.rate24Month, cur.rate36Month] = [end[2], end[3], end[4]];
      const { model, description } = splitModelDescription(cur.lines);
      items.push({
        itemNum: cur.itemNum,
        model,
        description,
        qty: cur.qty,
        rate12Month: cur.rate12Month,
        rate24Month: cur.rate24Month,
        rate36Month: cur.rate36Month,
      });
      cur = null;
    } else if (chunk.trim()) {
      cur.lines.push(chunk.trim());
    }
  };

  for (const line of lines) {
    if (!cur) {
      const s = line.match(ROW_START);
      if (!s) continue;
      cur = { itemNum: String(parseFloat(s[1])), lines: [] };
      if (s[2]) feed(s[2]);
    } else {
      feed(line);
    }
  }

  if (cur) {
    throw new Error(`Failed to parse quote: line item ${cur.itemNum} never reached its qty / rate figures. PDF format may have changed.`);
  }
  return items;
}

function parseQuote(rawText) {
  const text = rawText.replace(/\r\n?/g, "\n");

  const deliveryMatch = text.match(/Delivery Address:\s*([^\n]+)\n([^\n]+)\n([^\n]+)\n/);
  const deliveryEntityName = deliveryMatch ? deliveryMatch[1].trim() : null;
  const deliveryStreet = deliveryMatch ? deliveryMatch[2].trim() : null;
  const deliveryRest = deliveryMatch ? splitAddress(deliveryMatch[3].trim()) : {};

  let quoteDate = null, account = null, proposalNumber = null;
  if (deliveryMatch) {
    const afterDelivery = deliveryMatch.index + deliveryMatch[0].length;
    const contactIdx = text.indexOf("Contact:", afterDelivery);
    // The proposal number can land on the "Contact:" line itself (e.g. "Contact: 474684"),
    // so extend the cluster to the end of that line.
    let clusterEnd = text.length;
    if (contactIdx !== -1) {
      const eol = text.indexOf("\n", contactIdx);
      clusterEnd = eol === -1 ? text.length : eol;
    }
    const cluster = text.slice(afterDelivery, clusterEnd);
    quoteDate = (cluster.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/) || [])[0] || null;
    account = (cluster.match(/\b[A-Za-z]{2,}\d+\b/) || [])[0] || null;
    proposalNumber = (cluster.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, "").match(/\b\d{5,7}\b/) || [])[0] || null;
  }

  const contactAddrMatch = text.match(/(?<!Delivery )Address:\s*([^\n]+)\n([^\n]+)\n([^\n]+)\n/);
  const contactEntityName = contactAddrMatch ? contactAddrMatch[1].trim() : null;
  const contactStreet = contactAddrMatch ? contactAddrMatch[2].trim() : null;
  const contactRest = contactAddrMatch ? splitAddress(contactAddrMatch[3].trim()) : {};

  let contactName = null, phone = null, email = null;
  if (contactAddrMatch) {
    const afterContactAddr = contactAddrMatch.index + contactAddrMatch[0].length;
    const boundaryIdx = text.indexOf("Thank you for choosing", afterContactAddr);
    let cluster = text.slice(afterContactAddr, boundaryIdx === -1 ? text.length : boundaryIdx);

    phone = (cluster.match(/0\d{3}\s?\d{3}\s?\d{3}/) || [])[0] || null;
    email = (cluster.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || null;
    if (phone) cluster = cluster.replace(phone, "");
    if (email) cluster = cluster.replace(email, "");

    const leftover = cluster.split("\n").map((l) => l.trim()).filter(Boolean);
    contactName = leftover[0] || null;
    if (!email) {
      const candidate = leftover[1] || null;
      email = candidate && /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(candidate) ? candidate : null;
    }
  }

  const subTotalIdx = text.indexOf("Weekly Sub Total (Excl. GST):");
  let weeklyTotal12 = null, weeklyTotal24 = null, weeklyTotal36 = null;
  if (subTotalIdx !== -1) {
    const grab = (str) => [...str.matchAll(/\$([\d,]+\.\d{2})/g)].map((m) => m[1].replace(/,/g, ""));
    const labelEnd = subTotalIdx + "Weekly Sub Total (Excl. GST):".length;
    // amounts on the same line after the label, else the three just before it
    const sameLine = grab(text.slice(labelEnd, text.indexOf("\n", labelEnd) === -1 ? text.length : text.indexOf("\n", labelEnd)));
    const amounts = sameLine.length >= 3 ? sameLine : grab(text.slice(Math.max(0, subTotalIdx - 60), subTotalIdx));
    [weeklyTotal12, weeklyTotal24, weeklyTotal36] = amounts.length >= 3 && sameLine.length >= 3 ? amounts.slice(0, 3) : amounts.slice(-3);
  }

  const lineItems = parseLineItems(text);

  if (!proposalNumber || lineItems.length === 0) {
    throw new Error(
      `Failed to parse quote: proposalNumber=${proposalNumber}, lineItems found=${lineItems.length}. PDF format may have changed.`
    );
  }

  return {
    contact: { ...splitName(contactName), phone, email, street: contactStreet, ...contactRest },
    company: { name: contactEntityName, account },
    deal: {
      proposalNumber,
      account,
      quoteDate,
      deliveryStreet,
      ...deliveryRest,
      weeklyTotal12Month: weeklyTotal12,
      weeklyTotal24Month: weeklyTotal24,
      weeklyTotal36Month: weeklyTotal36,
    },
    lineItems,
  };
}

const text = $input.first().json.text;
return [{ json: parseQuote(text) }];
