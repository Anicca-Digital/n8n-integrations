// Caterlink delivery invoice parser.
// Finds each line item by its qty/price row, then splits the text after it into Cust Ref and
// description (title match first, line-length fallback) and reads the item's own serial number.

const MIN_DESCRIPTION_WORDS = 6;
const SERIAL_RE = /Serial\s*Number:?\s*([A-Za-z0-9\-\/]+)/i;
const PRICE_RE = /(\d+)[ \t]?EA\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})/g;
const BOUNDARY_RE = /UNIT PRICE|LINE TOTAL|MODEL\s*\/\s*DESCRIPTION|Order Num|Quote Num|Cust Ref|^ITEM$|^Serial\s*Number/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

function toDeliveryDateMs(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const [day, month, year] = ddmmyyyy.split("/");
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function titleAnchors(text, priceStart, endOfItemRe) {
  const lines = text
    .slice(0, priceStart)
    .split("\n")
    .map((l) => l.trim().replace(/^\^/, ""))
    .filter(Boolean);

  const collected = [];
  for (let i = lines.length - 1; i >= 0 && collected.length < 8; i--) {
    if (BOUNDARY_RE.test(lines[i]) || endOfItemRe.test(lines[i])) break;
    if (/^\d+$/.test(lines[i])) continue;
    collected.unshift(lines[i]);
  }

  return collected
    .map((l) => l.split(/\s+/).slice(0, 4).join(" ").toLowerCase())
    .filter((k) => k.length >= 12);
}

function findDescriptionStart(flat, blockLines, anchors) {
  const flatLower = flat.toLowerCase();

  let start = -1;
  for (const key of anchors) {
    const at = flatLower.indexOf(key);
    if (at >= 0 && (start < 0 || at < start)) start = at;
  }
  if (start > 0 && wordCount(flat.slice(0, start)) >= MIN_DESCRIPTION_WORDS) start = -1;
  if (start >= 0) return start;

  const firstLong = blockLines.findIndex((l) => wordCount(l) >= MIN_DESCRIPTION_WORDS);
  return firstLong > 0 ? blockLines.slice(0, firstLong).join(" ").length + 1 : 0;
}

function parseLineItem(text, rows, idx, endOfItemRe) {
  const m = rows[idx];
  const priceEnd = m.index + m[0].length;
  const nextStart = rows[idx + 1] ? rows[idx + 1].index : text.length;
  const region = text.slice(priceEnd, nextStart);

  const serialMatch = region.match(SERIAL_RE);
  const endMatch = region.match(endOfItemRe);
  const blockEnd = Math.min(
    region.length,
    serialMatch ? serialMatch.index : Infinity,
    endMatch ? endMatch.index : Infinity
  );

  const blockLines = region.slice(0, blockEnd).split("\n").map((l) => l.trim()).filter(Boolean);
  const flat = blockLines.join(" ");
  const start = findDescriptionStart(flat, blockLines, titleAnchors(text, m.index, endOfItemRe));
  const description = flat.slice(start).replace(/^\^/, "").replace(/\s+/g, " ").trim();

  return {
    itemNum: String(idx + 1),
    description,
    custRef: flat.slice(0, start).trim(),
    manufacturer: description.split(/\s+/)[0] || null,
    unitPrice: m[2].replace(/,/g, ""),
    serialNumber: serialMatch ? serialMatch[1] : null,
  };
}

function parseInvoice(rawText) {
  const text = rawText.replace(/\r/g, "").replace(/\u00a0/g, " ");

  const poNum = (text.match(/PO Num:?\s*([A-Za-z0-9\-]+)/i) || [])[1] || null;
  const invoiceNum = (text.match(/Tax Invoice No:?\s*(\d+)/i) || [])[1] || null;
  const invoiceDate = (text.match(/Date:?\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1] || null;

  const endOfItemRe = new RegExp(
    `^\\s*(?:${poNum ? escapeRe(poNum) + "\\b|" : ""}Note:|ELECTRONIC FUNDS)`,
    "m"
  );

  const rows = [...text.matchAll(PRICE_RE)];
  const lineItems = rows.map((_, idx) => parseLineItem(text, rows, idx, endOfItemRe));

  if (!poNum || lineItems.length === 0 || lineItems.some((li) => !li.description)) {
    throw new Error(
      `Failed to parse invoice: poNum=${poNum}, lineItems found=${lineItems.length}. PDF format may have changed.`
    );
  }

  return { poNum, invoiceNum, invoiceDate, deliveryDateMs: toDeliveryDateMs(invoiceDate), lineItems };
}

const text = $input.first().json.text;
return [{ json: parseInvoice(text) }];
