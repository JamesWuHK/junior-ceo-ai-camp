# SEO / GEO CDN Refresh Checklist

Generated: 2026-06-13T09:55:36+08:00
Site URL: https://camps.wanli.wiki
Overall status: EDGE_CACHE_STALE

## Why This Matters

- These files are small but important crawl and GEO context assets. Baidu and AI-style crawlers usually request the canonical URL, not a diagnostic query URL.
- A source-bypass PASS proves the COS object is updated; a canonical WARN with source-bypass PASS means an edge cache still serves an older object.
- Purging these URLs in the CDN/DNSPod account that controls `camps.wanli.wiki.cdn.dnsv1.com` is the fastest way to make Baidu and AI crawlers see the newest rules and context.

## Refresh Targets

Status | Asset | Canonical URL | Canonical status | Source-bypass URL | Source status | Missing required | Missing warning | SEO/GEO impact
--- | --- | --- | --- | --- | --- | --- | --- | ---
EDGE_CACHE_STALE | robots.txt | https://camps.wanli.wiki/robots.txt | WARN | https://camps.wanli.wiki/robots.txt?seo-monitor=source-1781315377907 | PASS | none | canonical CDN edge stale: missing markers Disallow: /classroom/, User-agent: Baiduspider; source-bypass https://camps.wanli.wiki/robots.txt?seo-monitor=source-1781315377907 has expected markers | Baidu crawl rules and explicit Baiduspider discovery signal
EDGE_CACHE_STALE | sitemap-context.xml | https://camps.wanli.wiki/sitemap-context.xml | WARN | https://camps.wanli.wiki/sitemap-context.xml?seo-monitor=source-1781315377953 | PASS | none | canonical CDN edge stale: missing markers <loc>https://camps.wanli.wiki/course-navigation-context.md</loc>, <loc>https://camps.wanli.wiki/site-facts.json</loc>; source-bypass https://camps.wanli.wiki/sitemap-context.xml?seo-monitor=source-1781315377953 has expected markers | AI/GEO context discovery for Markdown and structured facts
EDGE_CACHE_STALE | llms.txt | https://camps.wanli.wiki/llms.txt | WARN | https://camps.wanli.wiki/llms.txt?seo-monitor=source-1781315377909 | PASS | none | canonical CDN edge stale: missing markers Structured Facts, site-facts.json; source-bypass https://camps.wanli.wiki/llms.txt?seo-monitor=source-1781315377909 has expected markers | AI agent context, canonical answers, and entity disambiguation
EDGE_CACHE_STALE | site-facts.json | https://camps.wanli.wiki/site-facts.json | WARN | https://camps.wanli.wiki/site-facts.json?seo-monitor=source-1781315377916 | PASS | none | canonical CDN edge stale: missing markers "alternateName"; source-bypass https://camps.wanli.wiki/site-facts.json?seo-monitor=source-1781315377916 has expected markers | Machine-readable GEO facts, keyword clusters, and entity aliases
EDGE_CACHE_STALE | course-navigation.html | https://camps.wanli.wiki/course-navigation.html | WARN | https://camps.wanli.wiki/course-navigation.html?seo-monitor=source-1781315158664 | PASS | none | canonical CDN edge stale: missing markers href="https://camps.wanli.wiki/course-navigation-context.md"; source-bypass https://camps.wanli.wiki/course-navigation.html?seo-monitor=source-1781315158664 has expected markers | HTML GEO alternate/schema marker freshness for crawler retrieval

## URLs To Purge

List file: reports/seo-cdn-purge-urls.txt
Command file: reports/seo-cdn-purge-command.txt

- https://camps.wanli.wiki/robots.txt
- https://camps.wanli.wiki/sitemap-context.xml
- https://camps.wanli.wiki/llms.txt
- https://camps.wanli.wiki/site-facts.json
- https://camps.wanli.wiki/course-navigation.html

## Purge Command

Copy the command from `reports/seo-cdn-purge-command.txt` and run it in the Tencent Cloud account that owns the CDN host.

## Source Object Proof

Asset | Canonical cache evidence | Source-bypass cache evidence
--- | --- | ---
robots.txt | etag="446770a1d8dd644a7dec36209fca76b7"; last-modified=Tue, 09 Jun 2026 11:01:10 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="ef2b512035a3e18a44959dfbecfdd636"; last-modified=Sat, 13 Jun 2026 01:49:53 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
sitemap-context.xml | etag="b76eb12f87ce1f8f7b887c34502a65dc"; last-modified=Tue, 09 Jun 2026 16:10:30 GMT; x-cache-lookup=Cache Hit, Cache Miss; server=tencent-cos | cache-control=no-cache, max-age=0; etag="d5a52dfde84234605bbfc289a821174b"; last-modified=Sat, 13 Jun 2026 01:49:57 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
llms.txt | etag="e2de09ea323d1d885a2e440866232fdd"; last-modified=Tue, 09 Jun 2026 11:01:05 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="1092a9620679058b15f80f08e1feabf9"; last-modified=Sat, 13 Jun 2026 01:49:54 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
site-facts.json | etag="b6e17ff6beec4666e2ce43acdb046aca"; last-modified=Tue, 09 Jun 2026 17:04:48 GMT; x-cache-lookup=Cache Hit, Cache Miss; server=tencent-cos | cache-control=no-cache, max-age=0; etag="0a27d047a9f60ed5a36892ede1ab2b7e"; last-modified=Sat, 13 Jun 2026 01:49:59 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos
course-navigation.html | etag="77052409ac76e929a45e014ff21906bb"; last-modified=Tue, 09 Jun 2026 07:16:30 GMT; x-cache-lookup=Cache Hit; server=tencent-cos | cache-control=no-cache, max-age=0; etag="44aa097058abe17829bae50c5b511b50"; last-modified=Sat, 13 Jun 2026 01:47:13 GMT; age=0; x-cache-lookup=Cache Miss, Cache Miss; server=tencent-cos

## Current Account Check

- `tccli cdn DescribeDomains` currently returns that CDN service is not enabled for this account.
- `tccli ecdn DescribeDomains` currently returns that ECDN is not enabled for this account.
- `tccli teo DescribeZones` currently returns no EdgeOne zones.
- `tccli dnspod DescribeRecordList --Domain wanli.wiki` currently returns no permission for this domain.
- If `tccli cdn PurgeUrlsCache` returns `ResourceNotFound.CdnHostNotExists`, the current account does not own `camps.wanli.wiki` as a CDN host.
- Use the Tencent Cloud account that owns `camps.wanli.wiki.cdn.dnsv1.com`, or wait for the edge cache TTL to expire.
