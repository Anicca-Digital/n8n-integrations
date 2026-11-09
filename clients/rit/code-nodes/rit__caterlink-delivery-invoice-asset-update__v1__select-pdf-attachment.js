/**
 * Filter Outlook/Gmail attachments down to a single PDF file.
 *
 * Input: item with binary keys attachment_0, attachment_1, ... (n8n binary object).
 * Output: single item, binary property "data" = the matched file. No match = no output item.
 */
const item = $input.first();
const binary = item.binary || {};

const candidates = Object.entries(binary).filter(([key, file]) => {
  const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.fileName || '');
  return isPdf;
});

if (candidates.length === 0) {
  return []; // nothing matched, no output
}

const [, file] = candidates[0];

return [
  {
    json: {
      fileName: file.fileName,
      mimeType: file.mimeType,
    },
    binary: {
      data: file,
    },
  },
];
