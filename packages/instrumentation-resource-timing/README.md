# @opentelemetry/instrumentation-resource-timing

OpenTelemetry instrumentation for resource timing for browser applications.

## Installation

```bash
npm install @opentelemetry/instrumentation-resource-timing
```

## Usage

```typescript
import { ResourceTimingInstrumentation } from '@opentelemetry/instrumentation-resource-timing';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

registerInstrumentations({
  instrumentations: [
    new ResourceTimingInstrumentation({
      // configuration options
    }),
  ],
});
```

## Configuration

TODO: Document configuration options

## License

Apache-2.0
