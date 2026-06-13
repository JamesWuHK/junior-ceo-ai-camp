# Baidu / GEO Measurement Validation Report

Generated: 2026-06-13T09:09:08+08:00
Source CSV: seo/baidu-weekly-measurements.csv
Overall status: WAITING_FOR_MEASURED_ROWS

## Summary

- Total rows: 66
- Measured rows: 0
- Pending rows: 66
- Errors: 0
- Warnings: 0

Type | Total | Measured | Pending | Errors | Warnings
--- | --- | --- | --- | --- | ---
URL_INDEX | 14 | 0 | 14 | 0 | 0
URL_METRIC | 0 | 0 | 0 | 0 | 0
KEYWORD_RANK | 39 | 0 | 39 | 0 | 0
GEO_ANSWER | 13 | 0 | 13 | 0 | 0

## Validation Boundary

- This report checks whether filled rows are importable measured evidence. It does not prove Baidu inclusion, ranking, traffic, or AI citation by itself.
- Empty rows are allowed and counted as pending, because unknown values should stay blank until measured.
- A row becomes measured when it contains a measured field such as indexed status, rank, traffic metric, GEO booleans, evidence date, or notes.
- The report avoids printing private notes or platform details; keep source CSV files under `seo/` out of git.

## Errors

Level | Type | CSV line | Item | Problem | Action
--- | --- | --- | --- | --- | ---
PASS | - | - | No issues. | - | -

## Warnings

Level | Type | CSV line | Item | Problem | Action
--- | --- | --- | --- | --- | ---
PASS | - | - | No issues. | - | -

## Next Actions

- If status is `WAITING_FOR_MEASURED_ROWS`, collect Baidu Search Resource Platform or manual AI answer evidence before importing.
- If status is `FAIL`, fix the CSV rows above before running `npm run seo:weekly-import` or `npm run seo:measurements:import`.
- If status is `WARN`, import is allowed, but tighten source details and notes so future SEO/GEO repairs remain traceable.
- After a clean import, rerun `npm run seo:evidence`, `npm run seo:geo:readiness`, and `npm run seo:monitor`.
