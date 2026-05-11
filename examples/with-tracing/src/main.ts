import './style.css';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { browserDetector } from '@opentelemetry/opentelemetry-browser-detector';
import {
  detectResources,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// --- Resource detection ---
let resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'my-app',
});
const detectedResources = detectResources({
  detectors: [browserDetector],
});
resource = resource.merge(detectedResources);

// --- Event-based instrumentations (this repository) ---
const logProvider = new LoggerProvider({
  resource,
  processors: [new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())],
});
logs.setGlobalLoggerProvider(logProvider);

// --- Span-based instrumentations (opentelemetry-js / opentelemetry-js-contrib) ---
const provider = new WebTracerProvider({
  resource,
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
provider.register();

// --- Register all instrumentations ---
registerInstrumentations({
  instrumentations: [
    // Event-based
    new NavigationTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation(),
    // Span-based
    new FetchInstrumentation(),
    new XMLHttpRequestInstrumentation(),
  ],
});

// --- Button handlers ---
document.getElementById('fetch-button')!.addEventListener('click', () => {
  fetch('https://httpbin.org/get');
});

document.getElementById('xhr-button')!.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://httpbin.org/get');
  xhr.send();
});
