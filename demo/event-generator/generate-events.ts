import type { Page } from 'playwright';
import { chromium } from 'playwright';

const COLLECTOR_HOST = process.env.COLLECTOR_HOST ?? 'otel-collector';
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? '10000');
const RELOAD_EVERY = Number(process.env['RELOAD_EVERY'] ?? '5');

const COLLECTOR_URL = `http://${COLLECTOR_HOST}:4318`;

// The page sends OTLP to localhost:4318 — localhost is exempt from mixed-content
// blocking. Playwright intercepts those requests and proxies them to the actual
// collector inside Docker (see setupOtlpProxy).
const DEMO_URL =
  `https://mquentin.github.io/otel-browser-sdk-demo/` +
  `?serviceName=browser-demo` +
  `&serviceVersion=1.0.0` +
  `&tracesUrl=${encodeURIComponent(`http://localhost:4318/v1/traces`)}` +
  `&logsUrl=${encodeURIComponent(`http://localhost:4318/v1/logs`)}`;

// Intercept OTLP fetch calls from the browser and forward them via Node.js.
// This sidesteps the browser's mixed-content blocking (HTTPS page → HTTP collector).
async function setupOtlpProxy(page: Page): Promise<void> {
  for (const signal of ['logs', 'traces'] as const) {
    await page.route(`**/v1/${signal}`, async (route) => {
      const req = route.request();
      try {
        const resp = await fetch(`${COLLECTOR_URL}/v1/${signal}`, {
          method: req.method(),
          headers: {
            'content-type':
              req.headers()['content-type'] ?? 'application/x-protobuf',
          },
          body: req.postDataBuffer()
            ? new Uint8Array(req.postDataBuffer() ?? [])
            : null,
        });
        await route.fulfill({
          status: resp.status,
          body: Buffer.from(await resp.arrayBuffer()),
        });
        console.log(`  [proxy:${signal}] ${resp.status}`);
      } catch (err) {
        console.error(`  [proxy:error] ${signal}:`, err);
        await route.abort();
      }
    });
  }
}

async function generateEvents(): Promise<void> {
  console.log(`Starting event generator`);
  console.log(`Collector: ${COLLECTOR_URL}`);
  console.log(
    `Interval: ${INTERVAL_MS}ms, reload every ${RELOAD_EVERY} iterations`,
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`  [browser:error] ${msg.text()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes(':4318')) {
      console.log(
        `  [request:failed] ${req.url()} — ${req.failure()?.errorText}`,
      );
    }
  });

  await setupOtlpProxy(page);

  let iteration = 0;

  while (true) {
    iteration++;
    const shouldReload = iteration === 1 || iteration % RELOAD_EVERY === 0;

    console.log(
      `\n[${new Date().toISOString()}] Iteration ${iteration}${shouldReload ? ' (reload)' : ''}`,
    );

    try {
      if (shouldReload) {
        await page.goto(DEMO_URL, { waitUntil: 'networkidle', timeout: 30000 });
        console.log(`  Page loaded`);
      }

      const buttons = [
        'Fetch 200',
        'Fetch 404',
        'Network Error',
        'XHR Request',
        'JS Error',
        'Push History',
        'Custom Span',
        'Nested Spans',
        'Log Info',
        'Log Warn',
        'Log Error',
      ];

      for (const text of buttons) {
        const button = page.getByText(text, { exact: false }).first();
        if ((await button.count()) === 0) {
          continue;
        }
        const times = Math.ceil(Math.random() * 4); // 1–4 clicks
        for (let i = 0; i < times; i++) {
          await button.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(200);
        }
      }

      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        }),
      );
      await page.waitForTimeout(500);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'smooth' }),
      );

      console.log(`  Waiting ${INTERVAL_MS}ms for SDK to flush...`);
      await page.waitForTimeout(INTERVAL_MS);
      console.log(`  Done`);
    } catch (err) {
      console.error(`  Error during iteration ${iteration}:`, err);
    }
  }
}

generateEvents().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
