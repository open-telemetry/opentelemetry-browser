/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared between old.entry.ts and new.entry.ts so both fixture pages issue
// byte-identical requests for a given scenario -- only the instrumentation
// wrapping `fetch` differs between the two pages.

export type ScenarioKey =
  | 'success'
  | 'serverError'
  | 'networkError'
  | 'abort'
  | 'timeout'
  | 'noBody';

export interface FetchMigrationHarness {
  runScenario: typeof runScenario;
}

// Set on every span via `applyCustomAttributesOnSpan` (see old.entry.ts /
// new.entry.ts) so the test can tell old and new spans apart without relying
// on the request URL -- which lets both fixtures hit the exact same URL per
// scenario, so `url.full` is also directly comparable between the two.
export const TEST_IMPL_ATTR = 'test.fetch_migration.impl';
export type FetchMigrationImpl = 'old' | 'new';

const BASE_URL = '/e2e/fetch-migration';

const SCENARIO_PATHS: Record<ScenarioKey, string> = {
  success: 'get',
  serverError: 'error',
  networkError: 'network-error',
  abort: 'abort',
  timeout: 'timeout',
  noBody: 'no-body',
};

export function urlForScenario(key: ScenarioKey): string {
  return new URL(`${BASE_URL}/${SCENARIO_PATHS[key]}`, location.href).href;
}

export async function runScenario(key: ScenarioKey): Promise<void> {
  const url = urlForScenario(key);

  switch (key) {
    case 'success':
    case 'serverError':
    case 'networkError':
    case 'noBody':
      await fetch(url).catch(() => {});
      return;
    case 'abort': {
      const controller = new AbortController();
      const promise = fetch(url, { signal: controller.signal });
      controller.abort();
      await promise.catch(() => {});
      return;
    }
    case 'timeout':
      await fetch(url, { signal: AbortSignal.timeout(50) }).catch(() => {});
      return;
  }
}
