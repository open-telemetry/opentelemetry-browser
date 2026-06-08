import './style.css';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

// Simulates a misbehaving exporter that throws on every exception log.
// With ErrorsInstrumentation's safeExecuteInTheMiddle guard the throw is
// contained (one diag.error, no loop). Without the guard, the listener
// exception escapes dispatchEvent; the HTML spec's report-the-exception
// algorithm then runs, and its "in error reporting mode" flag normally
// suppresses an immediate refire. The "unguarded" button below illustrates
// the unbounded case synthetically, since that spec guard means you cannot
// reproduce the loop by relying on the browser to refire.
class ThrowingExceptionProcessor implements LogRecordProcessor {
  attempts = 0;
  onEmit(logRecord: SdkLogRecord): void {
    if (logRecord.eventName === 'exception') {
      this.attempts++;
      throw new Error('simulated exporter failure');
    }
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const throwingProcessor = new ThrowingExceptionProcessor();

const loggerProvider = new LoggerProvider({
  processors: [
    throwingProcessor,
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});

logs.setGlobalLoggerProvider(loggerProvider);

registerInstrumentations({
  instrumentations: [
    new ErrorsInstrumentation(),
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation({
      initiatorTypes: ['xmlhttprequest', 'fetch'],
    }),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation({ includeRawAttribution: true }),
  ],
});

document.getElementById('xhr-button')?.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://httpbin.org/get');
  xhr.send();
});

document.getElementById('fetch-button')?.addEventListener('click', () => {
  fetch('https://httpbin.org/get');
});

// --- ErrorsInstrumentation feedback-loop demo ---------------------------

const fireError = (message: string) =>
  window.dispatchEvent(
    new ErrorEvent('error', {
      error: new Error(message),
      message,
      cancelable: true,
    }),
  );

const buildDemo = () => {
  const container = document.querySelector('open-telemetry');
  if (!container) {
    return;
  }

  const section = document.createElement('section');
  section.style.marginTop = '2rem';
  section.style.borderTop = '1px solid #444';
  section.style.paddingTop = '1rem';

  const heading = document.createElement('h2');
  heading.textContent = 'ErrorsInstrumentation feedback-loop demo';
  section.appendChild(heading);

  const explanation = document.createElement('p');
  explanation.style.opacity = '0.8';
  explanation.style.fontSize = '0.95em';
  explanation.textContent =
    'A LogRecordProcessor is wired up to throw on every exception emit. ' +
    'The "guarded" button fires an error through the real ' +
    'ErrorsInstrumentation: safeExecuteInTheMiddle catches the throw, so ' +
    'the listener finishes cleanly and only one emit is attempted. ' +
    'The "unguarded" button installs a manual error listener that ' +
    're-dispatches the error event on every invocation, synthetically ' +
    'reproducing the feedback loop an unguarded handler would risk (the ' +
    'spec normally suppresses a real refire); the safety cap stops it ' +
    'after 50 iterations.';
  section.appendChild(explanation);

  // Builds a `<p>` row with a trigger button and a live count readout, and
  // returns both so the caller can wire up the click handler.
  const makeRow = (
    buttonId: string,
    buttonText: string,
    countId: string,
    label: string,
  ) => {
    const row = document.createElement('p');

    const button = document.createElement('button');
    button.id = buttonId;
    button.type = 'button';
    button.textContent = buttonText;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    const count = document.createElement('span');
    count.id = countId;
    count.textContent = '0';

    row.append(button, labelSpan, count);
    section.appendChild(row);
    return { button, count };
  };

  const { button: guardedButton, count: guardedCount } = makeRow(
    'trigger-guarded',
    'Trigger guarded (library)',
    'guarded-count',
    '  emit attempts: ',
  );
  const { button: unguardedButton, count: unguardedCount } = makeRow(
    'trigger-unguarded',
    'Trigger unguarded (simulated)',
    'unguarded-count',
    '  listener invocations (cap 50): ',
  );

  container.appendChild(section);

  guardedButton.addEventListener('click', () => {
    const before = throwingProcessor.attempts;
    fireError('guarded trigger');
    guardedCount.textContent = String(throwingProcessor.attempts - before);
  });

  // This is a synthetic illustration, not a faithful unguarded
  // ErrorsInstrumentation. The HTML spec's "in error reporting mode" flag
  // suppresses the browser from refiring 'error' while a listener throw is
  // being reported, so you cannot reproduce an unbounded loop by relying on
  // the browser. To visualize what an unchecked feedback loop would look
  // like, this listener re-dispatches the error event on every invocation;
  // the safety cap stops it after 50 iterations.
  const UNGUARDED_CAP = 50;
  let unguardedInvocations = 0;
  const unguardedListener = () => {
    unguardedInvocations++;
    unguardedCount.textContent = String(unguardedInvocations);
    if (unguardedInvocations >= UNGUARDED_CAP) {
      return;
    }
    fireError('simulated refire');
  };

  unguardedButton.addEventListener('click', () => {
    unguardedInvocations = 0;
    unguardedCount.textContent = '0';
    window.addEventListener('error', unguardedListener);
    try {
      fireError('unguarded trigger');
    } finally {
      window.removeEventListener('error', unguardedListener);
    }
  });
};

buildDemo();
