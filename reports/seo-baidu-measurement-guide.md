# Baidu / GEO Measurement Guide

Generated: 2026-06-10T00:16:56+08:00
Site URL: https://camps.wanli.wiki
Host: camps.wanli.wiki

## Scope

- URL targets from sitemap: 14
- Keyword clusters: 13
- Primary keyword checks: 13
- Total keyword rank checks: 137
- GEO answer checks: 52
- Checklist CSV: reports/seo-baidu-measurement-checklist.csv
- Private measured evidence file: seo/baidu-measurements.json
- Evidence report: reports/seo-baidu-evidence.md

## Current Local State

Item | Status | Meaning
--- | --- | ---
BAIDU_TOKEN | MISSING | Run manual submit package or configure token outside git.
seo/baidu-submit-history.json | MISSING_PRIVATE_FILE | No private push history found yet.
seo/baidu-measurements.json | MISSING_PRIVATE_FILE | No private measured evidence file found yet.

## Evidence Rules

- Label every metric as measured from a tool/export/manual check, or leave it blank/null. Never turn estimates into evidence.
- Keep Baidu URL push history separate from measured index, ranking, traffic, and GEO evidence.
- Treat successful Baidu URL push as discovery support only. It does not prove indexation, ranking, impressions, clicks, or AI citation.
- Commit public templates and reports only. Do not commit private platform exports, screenshots, notes with account details, or `seo/baidu-measurements.json`.

Type | Accepted evidence source | Required CSV fields | Guardrail
--- | --- | --- | ---
URL_INDEX | Baidu Search Resource Platform index data or a reproducible `site:` result | `targetPage`, `indexed`, `evidenceDate`, `source`, `notes` | A URL push response, sitemap presence, or local file check is not index evidence.
URL_METRIC | Baidu Search Resource Platform query/crawl exports | `targetPage`, `impressions`, `clicks`, `ctr`, `avgRank`, `crawlCount`, `evidenceDate`, `source`, `notes` | Keep blank when the platform has no data yet; do not estimate traffic.
KEYWORD_RANK | Baidu Search Resource Platform query data, compliant rank monitor, or reproducible manual SERP check | `cluster`, `queryType`, `query`, `targetPage`, `rank`, `impressions`, `clicks`, `evidenceDate`, `source`, `notes` | Record location/device/browser state for manual checks.
GEO_ANSWER | Manual AI answer check from the target answer engine | `cluster`, `query`, `targetPage`, `mentionsProject`, `usesTargetPage`, `positioning`, `evidenceDate`, `source`, `notes` | Useful only when engine, date, query, answer behavior, and source behavior are recorded.

## Weekly Measurement Workflow

1. Refresh the task files:

```bash
npm run seo:measurements:checklist
npm run seo:geo:prompts
npm run seo:baidu:submit-list
```

2. Submit or confirm the sitemap/URL set in Baidu Search Resource Platform. If `BAIDU_TOKEN` is configured privately, run `npm run seo:submit:baidu`; otherwise use the URL list in the manual submit package.

3. Record URL index evidence for each `URL_INDEX` row. Preferred source is Baidu Search Resource Platform. Manual fallback is a reproducible `site:` result such as `site:camps.wanli.wiki https://camps.wanli.wiki/ai-pbl-camp.html` with date and notes.

4. Record URL metric evidence for each `URL_METRIC` row when Baidu has data: impressions, clicks, CTR, average rank, crawl count, evidence date, and source export name.

5. Record keyword rank evidence for each `KEYWORD_RANK` row. If using manual SERP checks, record date, city or VPN state, device, browser state, rank, and whether the target page appeared.

6. Record GEO answer evidence with the prompt pack. For each AI answer check, capture engine, date, exact query, whether 少年CEO AI 创业营 is mentioned, whether the target page or Markdown context is used, and whether the positioning stays as an 8-16 岁 AI PBL 创业营.

7. Import and summarize the measured data:

```bash
npm run seo:measurements:import
npm run seo:evidence
npm run seo:monitor
```

## Field Values

- Boolean fields accept `true/false`, `yes/no`, `1/0`, `是/否`, `已收录/未收录`, `提到/未提到`, and `使用/未使用`.
- Numeric fields accept plain numbers. Percent values in `ctr` may be entered as `12.5%`; the importer stores them as decimals.
- Unknown values should stay blank, `N/A`, `null`, `unknown`, `未测`, or `待测`; the evidence report will keep them as missing evidence.
- `positioning` should be `accurate`, `partial`, `wrong`, or a short note. Use `unknown` when not measured.

## Repair Decisions

- If a URL is not indexed, first verify HTTP status, robots, canonical, sitemap presence, and internal links; then resubmit the URL.
- If a keyword has impressions but weak clicks, tune the target page title, meta description, H1, and first visible answer block for that exact query.
- If a keyword is measured with no rank, strengthen internal links and exact-match answer coverage before adding more pages.
- If a GEO answer misses the project, strengthen the visible HTML answer, matching FAQ schema, Markdown context, and `llms.txt` canonical answer.
- If a GEO answer mentions the project but confuses it with adult business training or coding-only classes, repair entity wording and disambiguation blocks.

## Related Outputs

- Manual Baidu URL submit list: reports/seo-baidu-submit-urls.txt
- Manual Baidu submit report: reports/seo-baidu-manual-submit.md
- Rank tracking plan: reports/seo-baidu-rank-plan.md
- GEO prompt pack: reports/seo-geo-answer-prompts.md
- Measurement checklist CSV: reports/seo-baidu-measurement-checklist.csv
- Measurement template JSON: seo/baidu-measurements.example.json
- Measured evidence report: reports/seo-baidu-evidence.md
