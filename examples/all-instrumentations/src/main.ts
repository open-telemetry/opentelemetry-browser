import './style.css';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

const loggerProvider = new LoggerProvider({
  processors: [new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())],
});

logs.setGlobalLoggerProvider(loggerProvider);

registerInstrumentations({
  instrumentations: [
    new NavigationTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation({ includeRawAttribution: true }),
  ],
});
