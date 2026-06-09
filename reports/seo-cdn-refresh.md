# SEO / GEO CDN Refresh Checklist

Generated: 2026-06-10T01:40:13+08:00
Site URL: https://camps.wanli.wiki
Overall status: EDGE_CACHE_STALE

## Why This Matters

- These files are small but important crawl and GEO context assets. Baidu and AI-style crawlers usually request the canonical URL, not a diagnostic query URL.
- A source-bypass PASS proves the COS object is updated; a canonical WARN with source-bypass PASS means an edge cache still serves an older object.
- Purging these URLs in the CDN/DNSPod account that controls `camps.wanli.wiki.cdn.dnsv1.com` is the fastest way to make Baidu and AI crawlers see the newest rules and context.

## Refresh Targets

Status | Asset | Canonical URL | Canonical status | Source-bypass URL | Source status | Missing required | Missing warning | SEO/GEO impact
--- | --- | --- | --- | --- | --- | --- | --- | ---
EDGE_CACHE_STALE | robots.txt | https://camps.wanli.wiki/robots.txt | WARN | https://camps.wanli.wiki/robots.txt?seo-monitor=source-1781024645845 | PASS | none | User-agent: Baiduspider | Baidu crawl rules and explicit Baiduspider discovery signal
EDGE_CACHE_STALE | sitemap-context.xml | https://camps.wanli.wiki/sitemap-context.xml | WARN | https://camps.wanli.wiki/sitemap-context.xml?seo-monitor=source-1781024645897 | PASS | none | <loc>https://camps.wanli.wiki/site-facts.json</loc> | AI/GEO context discovery for Markdown and structured facts
EDGE_CACHE_STALE | llms.txt | https://camps.wanli.wiki/llms.txt | WARN | https://camps.wanli.wiki/llms.txt?seo-monitor=source-1781024645848 | PASS | none | Structured Facts, site-facts.json | AI agent context, canonical answers, and entity disambiguation
EDGE_CACHE_STALE | site-facts.json | https://camps.wanli.wiki/site-facts.json | WARN | https://camps.wanli.wiki/site-facts.json?seo-monitor=source-1781026502626 | PASS | none | "alternateName" | Machine-readable GEO facts, keyword clusters, and entity aliases

## URLs To Purge

- https://camps.wanli.wiki/robots.txt
- https://camps.wanli.wiki/sitemap-context.xml
- https://camps.wanli.wiki/llms.txt
- https://camps.wanli.wiki/site-facts.json

## Source Object Proof

Asset | Canonical cache evidence | Source-bypass cache evidence
--- | --- | ---
robots.txt | etag="446770a1d8dd644a7dec36209fca76b7"; last-modified=Tue, 09 Jun 2026 11:01:10 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="b54636c9d73e6a7066828a82fc838851"; last-modified=Tue, 09 Jun 2026 17:35:21 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
sitemap-context.xml | etag="b76eb12f87ce1f8f7b887c34502a65dc"; last-modified=Tue, 09 Jun 2026 16:10:30 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="c7a87e1343b5716bf35d204911f07624"; last-modified=Tue, 09 Jun 2026 17:35:26 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
llms.txt | etag="e2de09ea323d1d885a2e440866232fdd"; last-modified=Tue, 09 Jun 2026 11:01:05 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="b596163f1cbd694adcf2f33e67eae542"; last-modified=Tue, 09 Jun 2026 17:35:23 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
site-facts.json | etag="b6e17ff6beec4666e2ce43acdb046aca"; last-modified=Tue, 09 Jun 2026 17:04:48 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="deddb6a397cbd70fc79674255da833f8"; last-modified=Tue, 09 Jun 2026 17:35:27 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos

## Current Account Check

- `tccli cdn DescribeDomains` currently returns that CDN service is not enabled for this account.
- `tccli ecdn DescribeDomains` currently returns that ECDN is not enabled for this account.
- `tccli teo DescribeZones` currently returns no EdgeOne zones.
- `tccli dnspod DescribeRecordList --Domain wanli.wiki` currently returns no permission for this domain.
- Use the Tencent Cloud account that owns `camps.wanli.wiki.cdn.dnsv1.com`, or wait for the edge cache TTL to expire.
