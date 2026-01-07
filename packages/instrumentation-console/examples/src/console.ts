import { logs } from '@opentelemetry/api-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ConsoleInstrumentation } from '../../src/index.ts';

export function setupConsoleDemo(element: HTMLDivElement) {
  const resourceSettings = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'OpenTelemetry Browser Test',
  });

  const loggerProvider = new LoggerProvider({
    resource: resourceSettings,
    processors: [new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  registerInstrumentations({
    loggerProvider,
    instrumentations: [new ConsoleInstrumentation()],
  });

  element.innerHTML = `
    <div class="button-group">
      <button id="btn-log">console.log</button>
      <button id="btn-info">console.info</button>
      <button id="btn-warn">console.warn</button>
      <button id="btn-error">console.error</button>
      <button id="btn-debug">console.debug</button>
    </div>
    <p class="hint">Open <code>DevTools Console</code> to see the output and traces</p>
  `;

  const btnLog = element.querySelector<HTMLButtonElement>('#btn-log');
  if (btnLog) {
    btnLog.addEventListener('click', () => {
      console.log('Test log message', { foo: 'bar' });
    });
  }

  const btnInfo = element.querySelector<HTMLButtonElement>('#btn-info');
  if (btnInfo) {
    btnInfo.addEventListener('click', () => {
      console.info('Test info message');
    });
  }

  const btnWarn = element.querySelector<HTMLButtonElement>('#btn-warn');
  if (btnWarn) {
    btnWarn.addEventListener('click', () => {
      console.warn('Test warning message');
    });
  }

  const btnError = element.querySelector<HTMLButtonElement>('#btn-error');
  if (btnError) {
    btnError.addEventListener('click', () => {
      console.error('Test error message');
    });
  }

  const btnDebug = element.querySelector<HTMLButtonElement>('#btn-debug');
  if (btnDebug) {
    btnDebug.addEventListener('click', () => {
      console.debug('Test debug message');
    });
  }
}
