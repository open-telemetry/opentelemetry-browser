// browser.ts — the MSW worker for the mock OTLP intake.
//
// This module (and `msw` itself) is only ever pulled in via the dynamic import
// in main.tsx, so it stays out of the main bundle when the mock is disabled.

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.ts';

export const worker = setupWorker(...handlers);
