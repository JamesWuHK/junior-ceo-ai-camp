# SEO / GEO CDN Refresh Checklist

Generated: 2026-06-13T09:12:31+08:00
Site URL: https://camps.wanli.wiki
Overall status: EDGE_CACHE_STALE

## Why This Matters

- These files are small but important crawl and GEO context assets. Baidu and AI-style crawlers usually request the canonical URL, not a diagnostic query URL.
- A source-bypass PASS proves the COS object is updated; a canonical WARN with source-bypass PASS means an edge cache still serves an older object.
- Purging these URLs in the CDN/DNSPod account that controls `camps.wanli.wiki.cdn.dnsv1.com` is the fastest way to make Baidu and AI crawlers see the newest rules and context.

## Refresh Targets

Status | Asset | Canonical URL | Canonical status | Source-bypass URL | Source status | Missing required | Missing warning | SEO/GEO impact
--- | --- | --- | --- | --- | --- | --- | --- | ---
EDGE_CACHE_STALE | robots.txt | https://camps.wanli.wiki/robots.txt | WARN | https://camps.wanli.wiki/robots.txt?seo-monitor=source-1781282967458 | PASS | none | User-agent: Baiduspider | Baidu crawl rules and explicit Baiduspider discovery signal
CANONICAL_PASS | sitemap-context.xml | https://camps.wanli.wiki/sitemap-context.xml | PASS | https://camps.wanli.wiki/sitemap-context.xml?seo-monitor=source-1781024645897 | PASS | none | none | AI/GEO context discovery for Markdown and structured facts
EDGE_CACHE_STALE | llms.txt | https://camps.wanli.wiki/llms.txt | WARN | https://camps.wanli.wiki/llms.txt?seo-monitor=source-1781024645848 | PASS | none | Structured Facts, site-facts.json | AI agent context, canonical answers, and entity disambiguation
CANONICAL_PASS | site-facts.json | https://camps.wanli.wiki/site-facts.json | PASS | https://camps.wanli.wiki/site-facts.json?seo-monitor=source-1781026502626 | PASS | none | none | Machine-readable GEO facts, keyword clusters, and entity aliases
EDGE_CACHE_STALE | course-navigation.md | https://camps.wanli.wiki/course-navigation.md | WARN | https://camps.wanli.wiki/course-navigation.md?seo-monitor=source-1780988646531 | PASS | none | canonical CDN edge stale: content-type=application/octet-stream expected text/markdown or text/plain; source-bypass https://camps.wanli.wiki/course-navigation.md?seo-monitor=source-1780988646531 content-type=text/markdown | Markdown GEO context content-type for Baidu and AI-compatible retrieval

## URLs To Purge

- https://camps.wanli.wiki/robots.txt
- https://camps.wanli.wiki/llms.txt
- https://camps.wanli.wiki/course-navigation.md

## Source Object Proof

Asset | Canonical cache evidence | Source-bypass cache evidence
--- | --- | ---
robots.txt | etag="446770a1d8dd644a7dec36209fca76b7"; last-modified=Tue, 09 Jun 2026 11:01:10 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="ef2b512035a3e18a44959dfbecfdd636"; last-modified=Fri, 12 Jun 2026 16:52:38 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
sitemap-context.xml | cache-control=no-cache, max-age=0; etag="c7a87e1343b5716bf35d204911f07624"; last-modified=Tue, 09 Jun 2026 17:35:26 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | cache-control=no-cache, max-age=0; etag="c7a87e1343b5716bf35d204911f07624"; last-modified=Tue, 09 Jun 2026 17:35:26 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
llms.txt | etag="e2de09ea323d1d885a2e440866232fdd"; last-modified=Tue, 09 Jun 2026 11:01:05 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="b596163f1cbd694adcf2f33e67eae542"; last-modified=Tue, 09 Jun 2026 17:35:23 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
site-facts.json | cache-control=no-cache, max-age=0; etag="deddb6a397cbd70fc79674255da833f8"; last-modified=Tue, 09 Jun 2026 17:35:27 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos | cache-control=no-cache, max-age=0; etag="deddb6a397cbd70fc79674255da833f8"; last-modified=Tue, 09 Jun 2026 17:35:27 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
course-navigation.md | etag="bb740aea2eb71e9cd4b1fbf4c647b503"; last-modified=Tue, 09 Jun 2026 07:16:31 GMT; x-cache-lookup=Cache Hit, Cache Miss; server=tencent-cos | cache-control=no-cache, max-age=0; etag="bb740aea2eb71e9cd4b1fbf4c647b503"; last-modified=Tue, 09 Jun 2026 17:35:43 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos

## Current Account Check

- `tccli cdn DescribeDomains` currently returns that CDN service is not enabled for this account.
- `tccli ecdn DescribeDomains` currently returns that ECDN is not enabled for this account.
- `tccli teo DescribeZones` currently returns no EdgeOne zones.
- `tccli dnspod DescribeRecordList --Domain wanli.wiki` currently returns no permission for this domain.
- Use the Tencent Cloud account that owns `camps.wanli.wiki.cdn.dnsv1.com`, or wait for the edge cache TTL to expire.
