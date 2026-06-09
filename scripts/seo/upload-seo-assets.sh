#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-camp-website}"
COS_CONFIG="${COS_CONFIG:-$HOME/.cos.conf}"
COS_BUCKET="${COS_BUCKET:-campus-1255557636}"
COS_REGION="${COS_REGION:-ap-beijing}"
CACHE_CONTROL="${CACHE_CONTROL:-no-cache, max-age=0}"

cd "$ROOT_DIR"

upload_file() {
  local file="$1"
  local content_type="$2"
  local local_path="$SITE_DIR/$file"
  local headers

  if [[ ! -f "$local_path" ]]; then
    echo "missing $local_path" >&2
    exit 1
  fi

  headers="{\"Content-Type\":\"$content_type\",\"Cache-Control\":\"$CACHE_CONTROL\"}"
  coscmd -c "$COS_CONFIG" -b "$COS_BUCKET" -r "$COS_REGION" upload -H "$headers" "$local_path" "/$file"
}

upload_file "robots.txt" "text/plain"
upload_file "llms.txt" "text/plain"
upload_file "sitemap-index.xml" "application/xml"
upload_file "sitemap.xml" "application/xml"
upload_file "sitemap-context.xml" "application/xml"
upload_file "site-facts.json" "application/json"

markdown_files=(
  "ai-pbl-camp.md"
  "ai-product-prototype-course.md"
  "beijing-shunyi-ai-course.md"
  "beijing-shunyi-youth-ai-course.md"
  "shunyi-children-ai-course.md"
  "shunyi-ai-summer-camp.md"
  "ai-era-skills-for-kids.md"
  "ai-judgement-for-kids.md"
  "youth-ai-course-guide.md"
  "ai-course-vs-coding.md"
  "shunyi-ai-parent-class.md"
  "partner-ai-pbl-camp.md"
  "course-navigation.md"
  "entity-shaonian-ceo-ai-camp.md"
)

for file in "${markdown_files[@]}"; do
  upload_file "$file" "text/markdown"
done
