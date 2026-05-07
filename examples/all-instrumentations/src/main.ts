import './style.css';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { initializeSdk } from '@opentelemetry/browser-sdk/experimental/entities';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

const sdk = initializeSdk({
  serviceName: 'examples-all-instrumentations',
  serviceVersion: '0.0.0',
  logRecordProcessors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
    new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: 'http://localhost:4318/v1/logs' }),
    ),
  ],
});

registerInstrumentations({
  instrumentations: [
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation({
      initiatorTypes: ['xmlhttprequest', 'fetch'],
    }),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation({ includeRawAttribution: true }),
  ],
});

// ── UI wiring ───────────────────────────────────────────────────────────────
const status = document.getElementById('status');
const updateStatus = () => {
  if (!status) {
    return;
  }
  status.textContent = `session.id=${sdk.getSessionId() ?? '<none>'} · browser.document.url.full=${sdk.documentTracker.getHref()}`;
};
sdk.documentTracker.addObserver(() => updateStatus());
updateStatus();

document.getElementById('xhr-button')?.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://httpbin.org/get');
  xhr.send();
});

document.getElementById('fetch-button')?.addEventListener('click', () => {
  void fetch('https://httpbin.org/get');
});

document
  .getElementById('push-history-button')
  ?.addEventListener('click', () => {
    const next = `${window.location.pathname}?n=${Math.floor(Math.random() * 1000)}`;
    history.pushState({}, '', next);
  });

document
  .getElementById('rotate-session-button')
  ?.addEventListener('click', () => {
    sdk.rotateSession();
    updateStatus();
  });
