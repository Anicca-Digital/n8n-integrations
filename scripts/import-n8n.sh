#!/usr/bin/env bash
# Import workflow JSON files into an n8n instance via the public REST API.
# Creates a new workflow per file (always inactive). Does not overwrite existing
# workflows. Credentials must be re-linked in the n8n editor afterwards, and
# sub-workflow references must be re-selected.
#
# Usage:   N8N_BASE_URL=https://n8n.example.com N8N_API_KEY=... \
#          scripts/import-n8n.sh <file-or-dir> [...]
# Example: scripts/import-n8n.sh clients/spl-simpro/workflows/sub
#
# Requires: curl, jq.
set -euo pipefail

: "${N8N_BASE_URL:?Set N8N_BASE_URL (e.g. https://n8n.example.com)}"
: "${N8N_API_KEY:?Set N8N_API_KEY (n8n Settings > n8n API)}"
[[ $# -ge 1 ]] || { echo "Usage: $0 <file-or-dir> [...]" >&2; exit 1; }
BASE="${N8N_BASE_URL%/}/api/v1"

import_file() {
  local f="$1" body resp
  body=$(jq '{name, nodes, connections, settings: (.settings // {})}' "$f")
  resp=$(curl -fsS -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
    -d "$body" "$BASE/workflows")
  echo "imported: $f -> id $(jq -r '.id' <<<"$resp") (inactive)"
}

for target in "$@"; do
  if [[ -d "$target" ]]; then
    while IFS= read -r f; do import_file "$f"; done < <(find "$target" -type f -name '*.json' | sort)
  else
    import_file "$target"
  fi
done
