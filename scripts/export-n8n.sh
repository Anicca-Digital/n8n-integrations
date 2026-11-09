#!/usr/bin/env bash
# Export workflows from an n8n instance via the public REST API into a folder,
# one JSON file per workflow.
#
# Usage:   N8N_BASE_URL=https://n8n.example.com N8N_API_KEY=... \
#          scripts/export-n8n.sh <output-dir> [name-filter]
# Example: scripts/export-n8n.sh clients/spl-simpro/workflows/sub "SPL"
#
# Requires: curl, jq. The API key is read from the environment only; never commit it.
set -euo pipefail

: "${N8N_BASE_URL:?Set N8N_BASE_URL (e.g. https://n8n.example.com)}"
: "${N8N_API_KEY:?Set N8N_API_KEY (n8n Settings > n8n API)}"
OUT="${1:?Usage: $0 <output-dir> [name-filter]}"
FILTER="${2:-}"
BASE="${N8N_BASE_URL%/}/api/v1"

mkdir -p "$OUT"
cursor=""
count=0
while :; do
  url="$BASE/workflows?limit=100${cursor:+&cursor=$cursor}"
  page=$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$url")
  while IFS= read -r wf; do
    name=$(jq -r '.name' <<<"$wf")
    [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && continue
    file=$(jq -r '.name' <<<"$wf" | sed -E 's/[^A-Za-z0-9]+/_/g; s/^_+|_+$//g')
    jq 'del(.id, .createdAt, .updatedAt, .versionId, .shared, .tags, .staticData)' <<<"$wf" > "$OUT/$file.json"
    echo "exported: $OUT/$file.json"
    count=$((count + 1))
  done < <(jq -c '.data[]' <<<"$page")
  cursor=$(jq -r '.nextCursor // empty' <<<"$page")
  [[ -z "$cursor" ]] && break
done
echo "Done: $count workflow(s). Review the diff for secrets before committing."
