# Sandbox

Interactive playground for testing OpenTelemetry browser instrumentations. Configure the SDK, trigger actions (fetch, XHR, errors, navigation…), and inspect exported spans and logs in real time.

## Run locally

From the **repo root**:

```bash
npm install
npm run dev
```

This starts the sandbox with hot-reload via Vite at `http://localhost:5173`.

## GitHub Pages

The sandbox is automatically deployed to GitHub Pages on every push to `main` via the `deploy-sandbox.yml` workflow. The live site is available at:

```
https://open-telemetry.github.io/opentelemetry-browser/
```
