import './style.css';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';
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

// --- Sessions ---
// The session processors must run BEFORE the export processors so the
// session.id attribute is set on each span / log record before it is exported.
const sessionManager = createSessionManager({
  sessionIdGenerator: createDefaultSessionIdGenerator(),
  sessionStore: createLocalStorageSessionStore(),
  // 4h ceiling, 30min of inactivity rotates the session.
  maxDuration: 4 * 60 * 60,
  inactivityTimeout: 30 * 60,
});
await sessionManager.start();

// --- Event-based instrumentations (this repository) ---
const logProvider = new LoggerProvider({
  resource,
  processors: [
    createSessionLogRecordProcessor(sessionManager),
    new SimpleLogRecordProcessor({ exporter: new ConsoleLogRecordExporter() }),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

// --- Span-based instrumentations (opentelemetry-js / opentelemetry-js-contrib) ---
const provider = new WebTracerProvider({
  resource,
  spanProcessors: [
    createSessionSpanProcessor(sessionManager),
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
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
document.getElementById('fetch-button')?.addEventListener('click', () => {
  fetch('https://httpbin.org/get');
});

document.getElementById('xhr-button')?.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://httpbin.org/get');
  xhr.send();
});
