#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WEB_DIR="$ROOT_DIR/课程产品包/07_Web教学系统/ceo-camp-web"
DIST_DIR="$WEB_DIR/dist"
COS_CONFIG="${COS_CONFIG:-$HOME/.cos.conf}"
COS_BUCKET="${COS_BUCKET:-campus-1255557636}"
COS_REGION="${COS_REGION:-ap-beijing}"
CLASSROOM_PREFIX="${CLASSROOM_PREFIX:-classroom}"
CLASSROOM_BASE="/${CLASSROOM_PREFIX#/}/"
STATIC_CACHE_CONTROL="${STATIC_CACHE_CONTROL:-public, max-age=31536000, immutable}"
HTML_CACHE_CONTROL="${HTML_CACHE_CONTROL:-no-cache, max-age=0}"

if ! command -v coscmd >/dev/null 2>&1; then
  echo "coscmd not found" >&2
  exit 1
fi

cd "$WEB_DIR"
npm run build

if [[ ! -d "$DIST_DIR" ]]; then
  echo "missing dist directory: $DIST_DIR" >&2
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
    *.js) echo "text/javascript; charset=utf-8" ;;
    *.css) echo "text/css; charset=utf-8" ;;
    *.json) echo "application/json; charset=utf-8" ;;
    *.svg) echo "image/svg+xml" ;;
    *.png) echo "image/png" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.webp) echo "image/webp" ;;
    *.ico) echo "image/x-icon" ;;
    *) echo "application/octet-stream" ;;
  esac
}

while IFS= read -r -d '' file; do
  rel="${file#$DIST_DIR/}"
  remote_path="${CLASSROOM_BASE}${rel}"
  content_type="$(guess_content_type "$rel")"
  cache_control="$STATIC_CACHE_CONTROL"
  if [[ "$rel" == *.html ]]; then
    cache_control="$HTML_CACHE_CONTROL"
  fi
  upload_file "$file" "$remote_path" "$content_type" "$cache_control"
done < <(find "$DIST_DIR" -type f -print0)

echo "Classroom static deployed to ${CLASSROOM_BASE}"
