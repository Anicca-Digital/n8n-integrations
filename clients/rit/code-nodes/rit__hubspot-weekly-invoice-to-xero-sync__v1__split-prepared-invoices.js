// One item per prepared Xero invoice, in the shape the batch loop below expects.
return $input.first().json.prepared.map(p => ({ json: p }));
