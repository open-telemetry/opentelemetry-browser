/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export function runtimeSettings(production: boolean, optIn?: string) {
  return {
    enabled: !production || optIn === 'true',
    sampleRate: production ? 0.1 : 1,
    devtoolsTrack: false as const,
    labels: 'attributes' as const,
    overlay: false as const,
    debugGlobal: false as const,
  };
}
