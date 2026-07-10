// handlers.ts — MSW handlers that intercept the SDK's OTLP/HTTP exports.
//
// The wildcard host (`*`) matches whatever endpoint the sandbox is configured
// with (localhost:4318 by default, or a custom URL from the config form), while
// still being cross-origin-safe: MSW answers the request inside the browser, so
// there is no real network call and therefore no CORS preflight.

import { HttpResponse, http } from 'msw';
import { ingest } from './intake-bus.ts';

export const handlers = [
  http.post('*/v1/traces', async ({ request }) => {
    ingest('traces', request.url, await request.text());
    // OTLP success response is an empty JSON body with a 200 status.
    return HttpResponse.json({}, { status: 200 });
  }),
  http.post('*/v1/logs', async ({ request }) => {
    ingest('logs', request.url, await request.text());
    return HttpResponse.json({}, { status: 200 });
  }),
];
