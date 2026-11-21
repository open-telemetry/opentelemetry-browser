/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function measurements(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Expected a nonempty Size Limit result array');
  }
  const entries = new Map();
  for (const result of results) {
    if (
      typeof result.name !== 'string' ||
      !Number.isFinite(result.size) ||
      result.size < 0 ||
      entries.has(result.name)
    ) {
      throw new Error('Invalid or duplicate Size Limit measurement');
    }
    entries.set(result.name, result.size);
  }
  return entries;
}

function escapeCell(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ');
}

export function bundleSizeReport(baseResults, headResults) {
  const base = measurements(baseResults);
  const head = measurements(headResults);
  const names = [...new Set([...base.keys(), ...head.keys()])].sort();
  const lines = [
    '## Bundle size',
    '',
    'Minified browser bundles with dependencies, in bytes. Report only, no regression budgets.',
    'Each row names its import and compression. Compare the document partial import with its `*` import to inspect tree shaking.',
    '',
    '| Entry | Base | Head | Change |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const name of names) {
    const before = base.get(name);
    const after = head.get(name);
    let change;
    if (before === undefined) {
      change = 'added';
    } else if (after === undefined) {
      change = 'removed';
    } else {
      const delta = after - before;
      change = `${delta > 0 ? '+' : ''}${delta} B`;
      if (before > 0) {
        change += ` (${delta > 0 ? '+' : ''}${((delta / before) * 100).toFixed(2)}%)`;
      }
    }
    lines.push(
      `| ${escapeCell(name)} | ${before ?? '—'} | ${after ?? '—'} | ${change} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [, , basePath, headPath] = process.argv;
  if (!basePath || !headPath) {
    throw new Error(
      'Usage: node scripts/bundle-size-report.js BASE.json HEAD.json',
    );
  }
  process.stdout.write(
    bundleSizeReport(
      JSON.parse(readFileSync(basePath, 'utf8')),
      JSON.parse(readFileSync(headPath, 'utf8')),
    ),
  );
}
