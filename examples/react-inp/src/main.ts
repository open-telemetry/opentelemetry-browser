/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { install } from 'react-inp-blame';
import { runtimeSettings } from './settings.ts';

const { enabled, ...options } = runtimeSettings(
  import.meta.env.PROD,
  import.meta.env['VITE_INP_PRODUCTION'],
);
// Install before react-dom and before web-vitals registers its hide listener.
const runtime = enabled ? install(options) : undefined;
const { startTelemetry } = await import('./telemetry.ts');
const sdk = startTelemetry();
const { mount } = await import('./app.tsx');
const unmount = mount();
const { createStop } = await import('./lifecycle.ts');
const stop = createStop(sdk, runtime, unmount);

document.getElementById('stop')?.addEventListener('click', () => {
  void stop().then(
    () => {
      const status = document.getElementById('status');
      if (status) {
        status.textContent = 'Telemetry stopped. Reload to start again.';
      }
    },
    (error: unknown) => console.error('Telemetry shutdown failed', error),
  );
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => void stop());
}
