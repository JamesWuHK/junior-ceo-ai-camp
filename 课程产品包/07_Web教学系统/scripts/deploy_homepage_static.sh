#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SITE_DIR="${SITE_DIR:-$ROOT_DIR/camp-website}"
COS_CONFIG="${COS_CONFIG:-$HOME/.cos.conf}"
COS_BUCKET="${COS_BUCKET:-campus-1255557636}"
COS_REGION="${COS_REGION:-ap-beijing}"
HTML_CACHE_CONTROL="${HTML_CACHE_CONTROL:-no-cache, max-age=0}"
ASSET_CACHE_CONTROL="${ASSET_CACHE_CONTROL:-public, max-age=86400}"

if ! command -v coscmd >/dev/null 2>&1; then
  echo "coscmd not found" >&2
  exit 1
fi

if [[ ! -d "$SITE_DIR" ]]; then
  echo "missing site dir: $SITE_DIR" >&2
  exit 1
fi

upload_file() {
  local local_path="$1"
  local remote_path="$2"
  local content_type="$3"
  local cache_control="$4"
  local headers

  headers="{\"Content-Type\":\"$content_type\",\"Cache-Control\":\"$cache_control\"}"
  coscmd -c "$COS_CONFIG" -b "$COS_BUCKET" -r "$COS_REGION" upload -f -H "$headers" "$local_path" "$remote_path"
}

guess_content_type() {
  local file="$1"
  case "$file" in
    *.html) echo "text/html; charset=utf-8" ;;
    *.md) echo "text/markdown; charset=utf-8" ;;
    *.xml) echo "application/xml; charset=utf-8" ;;
    *.txt) echo "text/plain; charset=utf-8" ;;
    *.json) echo "application/json; charset=utf-8" ;;
    *.css) echo "text/css; charset=utf-8" ;;
    *.js) echo "text/javascript; charset=utf-8" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.png) echo "image/png" ;;
    *.webp) echo "image/webp" ;;
    *) echo "application/octet-stream" ;;
  esac
}

while IFS= read -r -d '' file; do
  rel="${file#$SITE_DIR/}"
  content_type="$(guess_content_type "$rel")"
  cache_control="$ASSET_CACHE_CONTROL"
  if [[ "$rel" == *.html || "$rel" == *.md || "$rel" == *.xml || "$rel" == *.txt || "$rel" == *.json ]]; then
    cache_control="$HTML_CACHE_CONTROL"
  fi
  upload_file "$file" "/$rel" "$content_type" "$cache_control"
done < <(find "$SITE_DIR" -type f ! -path '*/.DS_Store' -print0)

echo "Homepage static deployed from $SITE_DIR"
