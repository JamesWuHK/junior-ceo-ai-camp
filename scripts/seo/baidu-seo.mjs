#!/usr/bin/env node

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '../..');
loadDotEnv();
const SITE_URL = stripTrailingSlash(process.env.SITE_URL || 'https://camps.wanli.wiki');
const OUTPUT_DIRS = ['.', 'camp-website'];
const SITEMAP_ENTRIES = [
  {
    path: '/',
    source: 'index.html',
    changefreq: 'weekly',
    priority: '1.0'
  }
];

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function siteUrl(pathname = '/') {
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function dateFromFile(relativePath) {
  const file = join(ROOT, relativePath);
  if (!existsSync(file)) return new Date().toISOString().slice(0, 10);
  return statSync(file).mtime.toISOString().slice(0, 10);
}

function buildRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /teacher.html',
    'Disallow: /student.html',
    'Disallow: /cards.html',
    'Disallow: /slides/',
    '',
    `Sitemap: ${siteUrl('/sitemap.xml')}`,
    ''
  ].join('\n');
}

function buildSitemap() {
  const urls = SITEMAP_ENTRIES.map((entry) => {
    const loc = siteUrl(entry.path);
    const lastmod = dateFromFile(entry.source);
    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>'
    ].join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    ''
  ].join('\n');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeStaticFile(filename, content) {
  for (const dir of OUTPUT_DIRS) {
    writeFileSync(join(ROOT, dir, filename), content, 'utf8');
    console.log(`wrote ${dir === '.' ? filename : `${dir}/${filename}`}`);
  }
}

function generateRobots() {
  writeStaticFile('robots.txt', buildRobots());
}

function generateSitemap() {
  writeStaticFile('sitemap.xml', buildSitemap());
}

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function getTitle(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
}

function getMeta(html, name) {
  const tag = html.match(new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escapeRegExp(name)}["'][^>]*>`, 'i'))?.[0];
  return tag?.match(/\scontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
}

function getCanonical(html) {
  const tag = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/\shref=["']([^"']*)["']/i)?.[1]?.trim() || '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function check() {
  const checks = [];
  const warnings = [];

  const indexPath = join(ROOT, 'index.html');
  const mirrorPath = join(ROOT, 'camp-website/index.html');
  if (!existsSync(indexPath)) checks.push(fail('missing root index.html'));
  if (!existsSync(mirrorPath)) checks.push(fail('missing camp-website/index.html'));

  const html = existsSync(indexPath) ? read('index.html') : '';
  const mirror = existsSync(mirrorPath) ? read('camp-website/index.html') : '';
  if (html && mirror && html !== mirror) checks.push(fail('index.html and camp-website/index.html differ'));

  const requiredMeta = [
    ['title', getTitle(html)],
    ['description', getMeta(html, 'description')],
    ['keywords', getMeta(html, 'keywords')],
    ['robots meta', getMeta(html, 'robots')],
    ['canonical', getCanonical(html)],
    ['og:title', getMeta(html, 'og:title')],
    ['og:description', getMeta(html, 'og:description')],
    ['og:url', getMeta(html, 'og:url')],
    ['og:image', getMeta(html, 'og:image')]
  ];
  for (const [label, value] of requiredMeta) {
    if (!value) checks.push(fail(`missing ${label}`));
  }

  const canonical = getCanonical(html);
  if (canonical && canonical !== siteUrl('/')) warnings.push(`canonical is ${canonical}, expected ${siteUrl('/')}`);

  for (const dir of OUTPUT_DIRS) {
    const prefix = dir === '.' ? '' : `${dir}/`;
    const robotsPath = join(ROOT, dir, 'robots.txt');
    const sitemapPath = join(ROOT, dir, 'sitemap.xml');
    if (!existsSync(robotsPath)) {
      checks.push(fail(`missing ${prefix}robots.txt`));
    } else {
      const robots = readFileSync(robotsPath, 'utf8');
      if (!robots.includes(`Sitemap: ${siteUrl('/sitemap.xml')}`)) checks.push(fail(`${prefix}robots.txt missing sitemap URL`));
    }
    if (!existsSync(sitemapPath)) {
      checks.push(fail(`missing ${prefix}sitemap.xml`));
    } else {
      const sitemap = readFileSync(sitemapPath, 'utf8');
      for (const entry of SITEMAP_ENTRIES) {
        if (!sitemap.includes(`<loc>${siteUrl(entry.path)}</loc>`)) checks.push(fail(`${prefix}sitemap.xml missing ${siteUrl(entry.path)}`));
      }
    }
  }

  const baiduTokenLeakFiles = ['package.json', 'scripts/seo/baidu-seo.mjs', 'index.html', 'camp-website/index.html']
    .filter((file) => existsSync(join(ROOT, file)))
    .filter((file) => /BAIDU_TOKEN\s*=\s*(?!replace_with_)/.test(read(file)));
  if (baiduTokenLeakFiles.length > 0) checks.push(fail(`possible BAIDU_TOKEN committed in ${baiduTokenLeakFiles.join(', ')}`));

  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
    console.log('');
  }

  const failed = checks.filter((item) => item.status === 'fail');
  if (failed.length > 0) {
    console.log('SEO check failed:');
    for (const item of failed) console.log(`- ${item.message}`);
    process.exitCode = 1;
    return;
  }

  console.log('SEO check passed.');
}

function fail(message) {
  return { status: 'fail', message };
}

function loadDotEnv() {
  const envFile = join(ROOT, '.env');
  if (!existsSync(envFile)) return;
  const lines = readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function urlsFromSitemap() {
  const sitemapPath = join(ROOT, 'sitemap.xml');
  const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, 'utf8') : buildSitemap();
  return Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1].trim());
}

async function submitToBaidu(args) {
  loadDotEnv();
  const dryRun = args.includes('--dry-run');
  const site = process.env.BAIDU_SITE || SITE_URL;
  const token = process.env.BAIDU_TOKEN;
  const urls = urlsFromSitemap();

  if (urls.length === 0) {
    console.error('No URLs found in sitemap.xml.');
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(`Dry run: ${urls.length} URL(s) would be submitted to Baidu for site ${site}.`);
    for (const url of urls) console.log(`- ${url}`);
    return;
  }

  if (!token) {
    console.error('Missing BAIDU_TOKEN. Put it in .env or export it in your shell.');
    process.exitCode = 1;
    return;
  }

  const endpoint = process.env.BAIDU_ENDPOINT || baiduEndpoint(site, token);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: urls.join('\n')
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Baidu usually returns JSON; keep text for unexpected responses.
  }

  console.log(`Submitted ${urls.length} URL(s) to Baidu for site ${site}.`);
  console.log(`HTTP ${response.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (!response.ok || body?.error) process.exitCode = 1;
}

function baiduEndpoint(site, token) {
  const url = new URL('http://data.zz.baidu.com/urls');
  url.searchParams.set('site', site);
  url.searchParams.set('token', token);
  return url.toString();
}

function usage() {
  console.log([
    'Usage: node scripts/seo/baidu-seo.mjs <command>',
    '',
    'Commands:',
    '  generate          Write robots.txt and sitemap.xml',
    '  robots            Write robots.txt',
    '  sitemap           Write sitemap.xml',
    '  check             Validate homepage SEO files and tags',
    '  submit [--dry-run] Submit sitemap URLs to Baidu Search Resource Platform'
  ].join('\n'));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'generate':
      generateRobots();
      generateSitemap();
      break;
    case 'robots':
      generateRobots();
      break;
    case 'sitemap':
      generateSitemap();
      break;
    case 'check':
      check();
      break;
    case 'submit':
      await submitToBaidu(args);
      break;
    default:
      usage();
      process.exitCode = command ? 1 : 0;
  }
}

await main();
