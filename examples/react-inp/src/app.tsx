/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        // Synthetic work makes a local interaction easy to inspect.
        const until = performance.now() + 120;
        while (performance.now() < until) {
          // Keep the example's input handler busy.
        }
        setCount(count + 1);
      }}
    >
      Run an interaction ({count})
    </button>
  );
}

export function mount() {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Missing React root');
  }
  const root = createRoot(container);
  root.render(<Counter />);
  return () => root.unmount();
}
