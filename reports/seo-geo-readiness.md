# GEO Readiness Report

Generated: 2026-06-13T09:08:19+08:00
Site URL: https://camps.wanli.wiki
Overall status: READY_NEEDS_GEO_EVIDENCE

## Summary

- Local GEO readiness: PASS
- Keyword clusters checked: 13
- Local cluster failures: 0
- Entity failures: 0
- Entity warnings: 0
- Measured GEO answer evidence: 0/52 pass; missing evidence 52
- Evidence source: WAITING_FOR_PRIVATE_MEASUREMENTS

## Measurement Boundary

- Local readiness is measured from repository HTML, JSON-LD, Markdown context, `llms.txt`, and `site-facts.json`.
- AI citation evidence is not inferred from local readiness. It must come from recorded ChatGPT, Perplexity, Gemini, Claude, Kimi, Doubao, Wenxin, Baidu AI Search, or similar answer checks.
- Fill seo/baidu-measurements.json or import reports/seo-baidu-measurement-checklist.csv, then rerun `npm run seo:geo:readiness`.

## CORE-EEAT GEO Self-Check

Code | Check | Status | Evidence
--- | --- | --- | ---
C02 | Clear entity and topic definition | PASS | Primary keywords, entity profile, and visible definitions are checked from local files.
O03 | Standalone quotable answers | PASS | Every target AI query must have matching visible HTML, JSON-LD, and Markdown answer blocks.
O05 | Structured facts and schema | PASS | site-facts.json, alternateName, canonical answers, JSON-LD, and llms.txt are checked.
E01 | Measured AI citation evidence | WARN | External AI answers are not inferred; they require manual or tool evidence in seo/baidu-measurements.json.
R07 | Monitoring loop | WARN | Measurement source status: WAITING_FOR_PRIVATE_MEASUREMENTS.

## Entity Layer

Status | Check | Label | Evidence | Next action
--- | --- | --- | --- | ---
PASS | entity-profile | Entity Profile | markers present 5/5 | none
PASS | entity-aliases | site-facts alternateName | aliases 16/16 | none
PASS | canonical-answers | Canonical Answers | 17/17 canonical answers in site-facts.json | none
PASS | llms-context | llms.txt context | markers present 5/5 | none
PASS | disambiguation | Entity disambiguation | disambiguation markers present 3/3 | none

## Cluster Readiness

Status | Cluster | Page | Primary keyword | Definition | HTML answers | Schema answers | Markdown answers | JSON-LD types | Evidence status | GEO evidence | Local failures
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
NEEDS_GEO_EVIDENCE | brand-home | / | 少年CEO AI 创业营 | PASS | 4/4 | 4/4 | 4/4 | Course, FAQPage, Organization, WebSite | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | ai-pbl-camp | /ai-pbl-camp.html | AI PBL 创业营 | PASS | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | ai-product-prototype-course | /ai-product-prototype-course.html | AI产品原型课程 | PASS | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | beijing-shunyi-ai-course | /beijing-shunyi-ai-course.html | 北京顺义AI课程 | PASS | 4/4 | 4/4 | 4/4 | BreadcrumbList, CollectionPage, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | beijing-shunyi-youth-ai-course | /beijing-shunyi-youth-ai-course.html | 北京顺义青少年AI课程 | PASS | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | shunyi-children-ai-course | /shunyi-children-ai-course.html | 北京顺义儿童AI课程 | PASS | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | shunyi-ai-summer-camp | /shunyi-ai-summer-camp.html | 北京顺义AI夏令营 | PASS | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | ai-era-skills-for-kids | /ai-era-skills-for-kids.html | AI时代孩子需要什么能力 | PASS | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | ai-judgement-for-kids | /ai-judgement-for-kids.html | 孩子AI判断力 | PASS | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | youth-ai-course-guide | /youth-ai-course-guide.html | 青少年AI课程 | PASS | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | ai-course-vs-coding | /ai-course-vs-coding.html | 少儿编程和AI课程区别 | PASS | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | shunyi-parent-class | /shunyi-ai-parent-class.html | 北京顺义 AI 家长公益课 | PASS | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none
NEEDS_GEO_EVIDENCE | partner-cooperation | /partner-ai-pbl-camp.html | AI PBL 创业营机构合作 | PASS | 4/4 | 4/4 | 4/4 | BreadcrumbList, FAQPage, Service | NEEDS_GEO_EVIDENCE | 0 pass / 0 repair / 4 missing | none

## Next Evidence Actions

- Use `npm run seo:geo:prompts` to refresh the AI answer prompt pack.
- Run the 52 GEO prompts in the target answer engines and record exact engine, date, query, source behavior, and positioning.
- Import the measured rows with `npm run seo:measurements:import`, then rerun `npm run seo:geo:readiness` and `npm run seo:monitor`.
