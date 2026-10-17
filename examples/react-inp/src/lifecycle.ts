/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export function createStop(
  sdk: { shutdown(): Promise<void> },
  runtime: { dispose(): void } | undefined,
  unmount: () => void,
): () => Promise<void> {
  let stopping: Promise<void> | undefined;
  return () => {
    stopping ??= (async () => {
      try {
        await sdk.shutdown();
      } finally {
        runtime?.dispose();
        unmount();
      }
    })();
    return stopping;
  };
}
