# Baidu SEO / GEO Monitor

Generated: 2026-06-13T00:50:10+08:00
Site URL: https://camps.wanli.wiki

## Status Summary

- Local SEO/GEO coverage: PASS
- Internal link graph: PASS
- Online crawl target check: WARN
- Baidu push token configured: no
- Baidu site parameter: https://camps.wanli.wiki
- Baidu submit URL count: 14
- Baidu push readiness: WAITING (BAIDU_TOKEN is not configured)
- Baidu measured evidence: NEEDS_MEASURED_DATA
- Baidu evidence file: seo/baidu-measurements.json missing
- Baidu discovery push history: NO_PUSH_RECORDED
- Baidu submission history file: seo/baidu-submit-history.json missing
- Robots cache diagnosis: CANONICAL_PASS
- Critical asset cache diagnosis: EDGE_CACHE_STALE; stale canonical assets=3

## Measurement Boundary

- Measured now: local page metadata, sitemap membership, JSON-LD presence, public copy internal-term scan, live HTTP status, HTTP content type, live marker presence, and Baidu push URL set.
- Internal link graph checks verify that public sitemap pages are reachable from the homepage and connected with descriptive links to related topic pages.
- Measured Baidu index count, search impressions, clicks, crawler frequency, keyword ranking positions, and AI citation frequency require `seo/baidu-measurements.json` populated from Baidu Search Resource Platform exports, a compliant rank monitor, reproducible manual checks, or manual AI answer checks.
- Baidu URL submission helps Baidu discover URLs faster; it does not guarantee inclusion or ranking. Treat successful push as discovery support, not as proof of indexed status.
- Baidu submission history is tracked separately from measured index/rank/GEO evidence so discovery support does not get mistaken for ranking proof.

## Robots Cache Diagnosis

- Status: CANONICAL_PASS
- Canonical URL: https://camps.wanli.wiki/robots.txt
- Canonical result: PASS; HTTP 200; bytes=432; missing required=none; missing warning=none
- Canonical cache evidence: cache-control=no-cache, max-age=0; etag="ef2b512035a3e18a44959dfbecfdd636"; last-modified=Fri, 12 Jun 2026 05:54:31 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
- Source-bypass URL: https://camps.wanli.wiki/robots.txt?seo-monitor=source-1781282967458
- Source-bypass result: PASS; HTTP 200; bytes=432; missing required=none; missing warning=none
- Source-bypass cache evidence: cache-control=no-cache, max-age=0; etag="ef2b512035a3e18a44959dfbecfdd636"; last-modified=Fri, 12 Jun 2026 05:54:31 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
- Recommended action: No robots cache repair needed.

## Critical Asset Cache Diagnosis

- Status: EDGE_CACHE_STALE
- Refresh checklist: reports/seo-cdn-refresh.md
- Stale canonical URLs: https://camps.wanli.wiki/sitemap-context.xml, https://camps.wanli.wiki/llms.txt, https://camps.wanli.wiki/site-facts.json
- Source/canonical failures: none

## Official Baidu References

- [普通收录](https://ziyuan.baidu.com/linksubmit/index): Baidu describes ordinary inclusion as active URL submission that can shorten crawler discovery time, while stating that submitted links are not guaranteed to be included.
- [快速收录](https://ziyuan.baidu.com/dailysubmit/index): Baidu describes fast inclusion as active resource push for time-sensitive URLs, while also stating that submitted links are not guaranteed to be included.

## Baidu Submission Set

Run `npm run seo:submit:baidu -- --dry-run` to print this same URL set without submitting. After privately setting `BAIDU_TOKEN`, run `npm run seo:submit:baidu` for real push submission.

- https://camps.wanli.wiki/
- https://camps.wanli.wiki/ai-pbl-camp.html
- https://camps.wanli.wiki/ai-product-prototype-course.html
- https://camps.wanli.wiki/beijing-shunyi-ai-course.html
- https://camps.wanli.wiki/beijing-shunyi-youth-ai-course.html
- https://camps.wanli.wiki/shunyi-children-ai-course.html
- https://camps.wanli.wiki/shunyi-ai-summer-camp.html
- https://camps.wanli.wiki/ai-era-skills-for-kids.html
- https://camps.wanli.wiki/ai-judgement-for-kids.html
- https://camps.wanli.wiki/youth-ai-course-guide.html
- https://camps.wanli.wiki/ai-course-vs-coding.html
- https://camps.wanli.wiki/shunyi-ai-parent-class.html
- https://camps.wanli.wiki/partner-ai-pbl-camp.html
- https://camps.wanli.wiki/course-navigation.html

## Keyword / GEO Coverage

Status | Cluster | Page | Primary keyword | Primary locations | Secondary coverage | HTML answers | Schema answers | Markdown answers | JSON-LD types
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
PASS | brand-home | / | 少年CEO AI 创业营 | title, description, keywords, h1, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | Course, FAQPage, Organization, WebSite
PASS | ai-pbl-camp | /ai-pbl-camp.html | AI PBL 创业营 | title, description, keywords, h1, h2, body, jsonLd | 7/7 | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage
PASS | ai-product-prototype-course | /ai-product-prototype-course.html | AI产品原型课程 | title, description, keywords, h1, h2, body, jsonLd | 7/7 | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage
PASS | beijing-shunyi-ai-course | /beijing-shunyi-ai-course.html | 北京顺义AI课程 | title, description, keywords, h1, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | BreadcrumbList, CollectionPage, FAQPage
PASS | beijing-shunyi-youth-ai-course | /beijing-shunyi-youth-ai-course.html | 北京顺义青少年AI课程 | title, description, keywords, h1, h2, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage
PASS | shunyi-children-ai-course | /shunyi-children-ai-course.html | 北京顺义儿童AI课程 | title, description, keywords, h1, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage
PASS | shunyi-ai-summer-camp | /shunyi-ai-summer-camp.html | 北京顺义AI夏令营 | title, description, keywords, h1, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | BreadcrumbList, Course, FAQPage
PASS | ai-era-skills-for-kids | /ai-era-skills-for-kids.html | AI时代孩子需要什么能力 | title, description, keywords, h1, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage
PASS | ai-judgement-for-kids | /ai-judgement-for-kids.html | 孩子AI判断力 | title, description, keywords, h1, body, jsonLd | 7/7 | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage
PASS | youth-ai-course-guide | /youth-ai-course-guide.html | 青少年AI课程 | title, description, keywords, h1, h2, body, jsonLd | 7/7 | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage
PASS | ai-course-vs-coding | /ai-course-vs-coding.html | 少儿编程和AI课程区别 | title, description, keywords, h1, h2, body, jsonLd | 7/7 | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage
PASS | shunyi-parent-class | /shunyi-ai-parent-class.html | 北京顺义 AI 家长公益课 | title, description, keywords, h1, h2, body, jsonLd | 7/7 | 4/4 | 4/4 | 4/4 | Article, BreadcrumbList, FAQPage
PASS | partner-cooperation | /partner-ai-pbl-camp.html | AI PBL 创业营机构合作 | title, description, keywords, h1, body, jsonLd | 8/8 | 4/4 | 4/4 | 4/4 | BreadcrumbList, FAQPage, Service

## Internal Link Graph

- Status: PASS
- Report: reports/seo-internal-links.md
- Public sitemap pages checked: 14
- Failures: none
- Warnings: none

## Online Targets

Status | Target | URL | HTTP | Bytes | Content-Type | Cache / headers | Content-Type error | Missing required | Missing warning | Error
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
PASS | home | https://camps.wanli.wiki/ | 200 | 51895 | text/html; charset=utf-8 | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-pbl-camp.html | 200 | 11592 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-product-prototype-course.html | 200 | 12711 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/beijing-shunyi-ai-course.html | 200 | 12980 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/beijing-shunyi-youth-ai-course.html | 200 | 13812 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/shunyi-children-ai-course.html | 200 | 14047 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/shunyi-ai-summer-camp.html | 200 | 12561 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-era-skills-for-kids.html | 200 | 13464 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-judgement-for-kids.html | 200 | 12125 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/youth-ai-course-guide.html | 200 | 14250 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-course-vs-coding.html | 200 | 11725 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/shunyi-ai-parent-class.html | 200 | 10460 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/partner-ai-pbl-camp.html | 200 | 10862 | text/html | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/course-navigation.html | 200 | 10329 | text/html | - | none | none | none | -
PASS | robots canonical | https://camps.wanli.wiki/robots.txt | 200 | 432 | text/plain; charset=utf-8 | cache-control=no-cache, max-age=0; etag="ef2b512035a3e18a44959dfbecfdd636"; last-modified=Fri, 12 Jun 2026 05:54:31 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | none | none | none | -
PASS | robots source-bypass | https://camps.wanli.wiki/robots.txt?seo-monitor=source-1781282967458 | 200 | 432 | text/plain; charset=utf-8 | cache-control=no-cache, max-age=0; etag="ef2b512035a3e18a44959dfbecfdd636"; last-modified=Fri, 12 Jun 2026 05:54:31 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | none | none | none | -
PASS | - | https://camps.wanli.wiki/sitemap-index.xml | 200 | 352 | application/xml | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/sitemap.xml | 200 | 2675 | application/xml | - | none | none | none | -
WARN | sitemap-context canonical | https://camps.wanli.wiki/sitemap-context.xml | 200 | 2836 | application/xml | etag="b76eb12f87ce1f8f7b887c34502a65dc"; last-modified=Tue, 09 Jun 2026 16:10:30 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | none | none | <loc>https://camps.wanli.wiki/site-facts.json</loc> | -
PASS | sitemap-context source-bypass | https://camps.wanli.wiki/sitemap-context.xml?seo-monitor=source-1781024645897 | 200 | 3009 | application/xml | cache-control=no-cache, max-age=0; etag="c7a87e1343b5716bf35d204911f07624"; last-modified=Tue, 09 Jun 2026 17:35:26 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | none | none | none | -
WARN | llms canonical | https://camps.wanli.wiki/llms.txt | 200 | 6108 | text/plain | etag="e2de09ea323d1d885a2e440866232fdd"; last-modified=Tue, 09 Jun 2026 11:01:05 GMT; x-cache-lookup=Cache Hit, Cache Miss; server=tencent-cos | none | none | Structured Facts, site-facts.json | -
PASS | llms source-bypass | https://camps.wanli.wiki/llms.txt?seo-monitor=source-1781024645848 | 200 | 6326 | text/plain | cache-control=no-cache, max-age=0; etag="b596163f1cbd694adcf2f33e67eae542"; last-modified=Tue, 09 Jun 2026 17:35:23 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | none | none | none | -
WARN | site-facts canonical | https://camps.wanli.wiki/site-facts.json | 200 | 18967 | application/json | etag="b6e17ff6beec4666e2ce43acdb046aca"; last-modified=Tue, 09 Jun 2026 17:04:48 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | none | none | "alternateName" | -
PASS | site-facts source-bypass | https://camps.wanli.wiki/site-facts.json?seo-monitor=source-1781026502626 | 200 | 19247 | application/json | cache-control=no-cache, max-age=0; etag="deddb6a397cbd70fc79674255da833f8"; last-modified=Tue, 09 Jun 2026 17:35:27 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-pbl-camp.md | 200 | 841 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-product-prototype-course.md | 200 | 887 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/beijing-shunyi-ai-course.md | 200 | 1299 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/beijing-shunyi-youth-ai-course.md | 200 | 995 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/shunyi-children-ai-course.md | 200 | 1397 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/shunyi-ai-summer-camp.md | 200 | 847 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-era-skills-for-kids.md | 200 | 1549 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-judgement-for-kids.md | 200 | 1508 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/youth-ai-course-guide.md | 200 | 827 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/ai-course-vs-coding.md | 200 | 879 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/shunyi-ai-parent-class.md | 200 | 751 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/partner-ai-pbl-camp.md | 200 | 710 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/course-navigation.md | 200 | 891 | text/markdown | - | none | none | none | -
PASS | - | https://camps.wanli.wiki/entity-shaonian-ceo-ai-camp.md | 200 | 3462 | text/markdown | - | none | none | none | -

## AI Query Targets

### brand-home

- Page: https://camps.wanli.wiki/
- Primary keyword: 少年CEO AI 创业营
- Target answer queries: 少年CEO AI 创业营是什么 | 适合8-16岁孩子的AI创业营 | 北京顺义青少年AI课程推荐 | 少年CEO AI 创业营怎么报名咨询
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### ai-pbl-camp

- Page: https://camps.wanli.wiki/ai-pbl-camp.html
- Primary keyword: AI PBL 创业营
- Target answer queries: AI PBL 创业营适合什么孩子 | AI PBL创业营3天学什么 | 孩子不懂编程能参加AI创业营吗 | 青少年AI产品原型课程怎么上
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### ai-product-prototype-course

- Page: https://camps.wanli.wiki/ai-product-prototype-course.html
- Primary keyword: AI产品原型课程
- Target answer queries: AI产品原型课程是什么 | AI产品原型课程能做出什么作品 | 孩子做AI产品需要会编程吗 | AI产品原型课程和AI工具课有什么不同
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### beijing-shunyi-ai-course

- Page: https://camps.wanli.wiki/beijing-shunyi-ai-course.html
- Primary keyword: 北京顺义AI课程
- Target answer queries: 北京顺义AI课程怎么选 | 顺义AI课程一般学几天 | 顺义AI课程适合什么孩子 | 北京顺义AI课程有哪些形式
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### beijing-shunyi-youth-ai-course

- Page: https://camps.wanli.wiki/beijing-shunyi-youth-ai-course.html
- Primary keyword: 北京顺义青少年AI课程
- Target answer queries: 北京顺义青少年AI课程适合什么孩子 | 北京顺义青少年AI课程费用怎么判断 | 顺义AI课程和普通工具体验课有什么不同 | 顺义家长如何判断一门青少年AI课程
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### shunyi-children-ai-course

- Page: https://camps.wanli.wiki/shunyi-children-ai-course.html
- Primary keyword: 北京顺义儿童AI课程
- Target answer queries: 北京顺义儿童AI课程怎么选 | 小学生AI课程应该学什么 | 顺义少儿AI课需要先学编程吗 | 顺义儿童AI课程和少儿编程有什么不同
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### shunyi-ai-summer-camp

- Page: https://camps.wanli.wiki/shunyi-ai-summer-camp.html
- Primary keyword: 北京顺义AI夏令营
- Target answer queries: 北京顺义AI夏令营适合什么孩子 | 顺义AI夏令营适合几年级孩子 | 顺义AI夏令营和普通科技营有什么不同 | AI夏令营3天能做出什么作品
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### ai-era-skills-for-kids

- Page: https://camps.wanli.wiki/ai-era-skills-for-kids.html
- Primary keyword: AI时代孩子需要什么能力
- Target answer queries: AI时代孩子需要什么能力 | 孩子学AI有什么用 | 家长如何培养孩子AI判断力 | AI时代儿童能力包括什么
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### ai-judgement-for-kids

- Page: https://camps.wanli.wiki/ai-judgement-for-kids.html
- Primary keyword: 孩子AI判断力
- Target answer queries: 孩子AI判断力怎么培养 | 孩子如何判断AI答案是否可靠 | AI答案可靠吗 | 家长如何陪孩子使用AI
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### youth-ai-course-guide

- Page: https://camps.wanli.wiki/youth-ai-course-guide.html
- Primary keyword: 青少年AI课程
- Target answer queries: 青少年AI课程怎么选 | AI课程怎么选 | 儿童AI课程只学工具够吗 | AI PBL课程适合什么孩子
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### ai-course-vs-coding

- Page: https://camps.wanli.wiki/ai-course-vs-coding.html
- Primary keyword: 少儿编程和AI课程区别
- Target answer queries: 少儿编程和AI课程区别是什么 | AI课程和编程课区别 | 孩子该学AI还是编程 | 不会编程能学AI课程吗
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### shunyi-parent-class

- Page: https://camps.wanli.wiki/shunyi-ai-parent-class.html
- Primary keyword: 北京顺义 AI 家长公益课
- Target answer queries: 北京顺义AI家长公益课讲什么 | 北京顺义AI家长公益课适合哪些家长 | AI时代孩子需要什么能力 | 顺义家长怎么理解孩子学AI
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

### partner-cooperation

- Page: https://camps.wanli.wiki/partner-ai-pbl-camp.html
- Primary keyword: AI PBL 创业营机构合作
- Target answer queries: 培训机构如何合作开展AI PBL创业营 | 培训机构AI课程合作怎么落地 | 青少年AI营地合作课程方案 | AI创业营机构合作支持什么
- Visible HTML answer coverage: 4/4
- JSON-LD answer coverage: 4/4
- Markdown answer coverage: 4/4
- Status: PASS
- Failures: none
- Warnings: none

## Next Actions

- Add `BAIDU_TOKEN` privately in `.env` or the shell, then run `npm run seo:submit:baidu`.
- If token access is unavailable, run `npm run seo:baidu:submit-list` and use reports/seo-baidu-submit-urls.txt for manual URL submission in Baidu Search Resource Platform.
- Run `npm run seo:baidu:submission` after real push submission to refresh discovery push history.
- Copy seo/baidu-measurements.example.json to seo/baidu-measurements.json, fill measured data, then run `npm run seo:baidu:evidence`.
- Or fill reports/seo-baidu-measurement-checklist.csv, run `npm run seo:measurements:import`, then run `npm run seo:baidu:evidence`.
- Confirm `https://camps.wanli.wiki/sitemap.xml` in Baidu Search Resource Platform ordinary inclusion/sitemap tools.
- Record measured Baidu platform data weekly: indexed URLs, crawl frequency, search impressions, clicks, and keyword positions for each cluster.
- Use `npm run seo:rank-plan` to generate the Baidu keyword and GEO query tracking sheet before weekly checks.
- Use `npm run seo:measurements:checklist` when a CSV checklist is easier to fill or share; it writes reports/seo-baidu-measurement-checklist.csv.
- Use `npm run seo:geo:prompts` to generate reports/seo-geo-answer-prompts.md for manual AI answer citation checks.
- For GEO, run this monitor after each content change and keep every target query backed by a visible HTML answer, FAQ/schema match, Markdown context, and `llms.txt` link.
