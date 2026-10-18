/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundleSizeReport } from './bundle-size-report.js';

test('reports positive, negative and unchanged sizes without budgets', () => {
  const base = [
    { name: 'grow', size: 100 },
    { name: 'shrink', size: 200 },
    { name: 'same', size: 50 },
  ];
  const head = [
    { name: 'same', size: 50 },
    { name: 'grow', size: 10000 },
    { name: 'shrink', size: 100 },
  ];
  const report = bundleSizeReport(base, head);
  assert.ok(report.includes('| grow | 100 | 10000 | +9900 B (+9900.00%) |'));
  assert.ok(report.includes('| shrink | 200 | 100 | -100 B (-50.00%) |'));
  assert.ok(report.includes('| same | 50 | 50 | 0 B (0.00%) |'));
});

test('matches rows by name, handles added and removed exports and zero baselines', () => {
  const report = bundleSizeReport(
    [
      { name: 'removed', size: 100 },
      { name: 'empty', size: 0 },
    ],
    [
      { name: 'added', size: 10 },
      { name: 'empty', size: 5 },
    ],
  );
  assert.ok(report.includes('| added | — | 10 | added |'));
  assert.ok(report.includes('| removed | 100 | — | removed |'));
  assert.ok(report.includes('| empty | 0 | 5 | +5 B |'));
});

test('escapes table cells from package metadata', () => {
  const results = [{ name: '<entry>|\nnext', size: 1 }];
  assert.ok(
    bundleSizeReport(results, results).includes('&lt;entry&gt;&#124; next'),
  );
});

test('fails on missing or invalid measurements instead of producing an empty report', () => {
  const good = [{ name: 'entry', size: 1 }];
  for (const invalid of [
    [],
    {},
    [{ name: 'entry' }],
    [{ name: 'entry', size: -1 }],
    [{ name: 'entry', size: Number.NaN }],
    [...good, ...good],
  ]) {
    assert.throws(() => bundleSizeReport(invalid, good));
    assert.throws(() => bundleSizeReport(good, invalid));
  }
});
