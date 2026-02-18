# @opentelemetry/instrumentation-web-vitals

OpenTelemetry instrumentation for Core Web Vitals for browser applications.

## Installation

```bash
npm install @opentelemetry/instrumentation-web-vitals
```

## Usage

```typescript
import { WebVitalsInstrumentation } from '@opentelemetry/instrumentation-web-vitals';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

registerInstrumentations({
  instrumentations: [
    new WebVitalsInstrumentation({
      // configuration options
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trackingLevel` | `'core'` \| `'all'` | `'core'` | Which metrics to track. `'core'` tracks CLS, INP, and LCP (the Core Web Vitals). `'all'` additionally tracks FCP and TTFB. |

## License

Apache-2.0
