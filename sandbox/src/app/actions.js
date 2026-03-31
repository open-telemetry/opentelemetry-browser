// actions.js — handlers for each demo button

import { SpanStatusCode } from '@opentelemetry/api'
import { SeverityNumber } from '@opentelemetry/api-logs'
import { log } from './ui.js'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createActions(tracer, logger) {

  // ── Trace actions ───────────────────────────────────────────────────────────

  /** GET a real JSON endpoint → 200 OK */
  const fetchOk = async () => {
    const url = 'https://jsonplaceholder.typicode.com/posts/1'
    log('info', `GET ${url} …`)
    try {
      const r = await fetch(url)
      const d = await r.json()
      log('success', `200 OK — post #${d.id}: "${d.title.slice(0, 60)}"`)
    } catch (e) {
      log('error', `Fetch failed: ${e.message}`)
    }
  }

  /** GET a valid host with non-existent resource → 404 */
  const fetch404 = async () => {
    const url = 'https://jsonplaceholder.typicode.com/posts/999999'
    log('info', `GET ${url} (expect 404) …`)
    try {
      const r = await fetch(url)
      log('warn', `Response: HTTP ${r.status} ${r.statusText}`)
    } catch (e) {
      log('error', `Fetch error: ${e.message}`)
    }
  }

  /** GET an invalid hostname → network-level error */
  const fetchNetErr = async () => {
    const url = 'https://this-host-definitely-does-not-exist.invalid/api/data'
    log('info', `GET ${url} (expect network error) …`)
    try {
      await fetch(url)
    } catch (e) {
      log('error', `Network error (expected): ${e.message}`)
    }
  }

  /** XHR request */
  const xhr = () => {
    const url = 'https://jsonplaceholder.typicode.com/users/1'
    log('info', `XHR GET ${url} …`)
    const req = new XMLHttpRequest()
    req.open('GET', url)
    req.onload = () => {
      try {
        const d = JSON.parse(req.responseText)
        log('success', `XHR 200 — user: ${d.name} <${d.email}>`)
      } catch {
        log('warn', `XHR ${req.status} — non-JSON response`)
      }
    }
    req.onerror = () => log('error', 'XHR network error')
    req.send()
  }

  /** Deliberate TypeError, recorded on a manual span */
  const jsError = () => {
    log('warn', 'Triggering a JS TypeError…')
    const errorSpan = tracer.startSpan('js-error-event')
    try {
      void null.undefinedProperty
    } catch (e) {
      log('error', `${e.name}: ${e.message}`)
      errorSpan.recordException(e)
      errorSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
    } finally {
      errorSpan.end()
    }
  }

  /** history.pushState – simulates SPA navigation */
  const navigation = () => {
    const routes = ['/home', '/about', '/dashboard', '/settings', '/profile', '/search']
    const to = routes[Math.floor(Math.random() * routes.length)]
    history.pushState({ page: to }, '', to + '?otelDemo=1')
    log('nav', `history.pushState → ${to}`)

    const span = tracer.startSpan('navigation')
    span.setAttribute('navigation.to',   to)
    span.setAttribute('navigation.type', 'pushState')
    span.setAttribute('navigation.from', document.referrer || '/')
    span.end()
  }

  /** Manual span with custom attributes */
  const customSpan = async () => {
    const span = tracer.startSpan('user-interaction')
    span.setAttribute('interaction.type',      'button-click')
    span.setAttribute('interaction.component', 'custom-span-button')
    span.setAttribute('interaction.timestamp', Date.now())
    log('span', 'Started span: user-interaction')
    await sleep(80 + Math.random() * 120)
    span.end()
    log('success', 'Ended span: user-interaction')
  }

  /** Sequence of spans simulating a multi-step workflow */
  const nestedSpans = async () => {
    const root = tracer.startSpan('workflow.execute')
    root.setAttribute('workflow.name',  'demo-pipeline')
    root.setAttribute('workflow.steps', 3)
    log('span', 'Started root span: workflow.execute')

    await sleep(40)

    const stepNames = ['validate', 'process', 'commit']
    for (let i = 0; i < stepNames.length; i++) {
      const step = tracer.startSpan(`workflow.step-${i + 1}`)
      step.setAttribute('step.index', i + 1)
      step.setAttribute('step.name',  stepNames[i])
      log('span', `  step span: workflow.step-${i + 1}`)
      await sleep(50 + (i + 1) * 30)
      step.end()
    }

    root.end()
    log('success', 'Workflow complete — 4 spans created')
  }

  // ── Log actions ─────────────────────────────────────────────────────────────

  const logInfo = () => {
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText:   'INFO',
      body:           'User triggered an info log event',
      attributes:     { 'log.source': 'manual', 'event.name': 'demo.log_info' },
    })
    log('info', 'Emitted INFO log record')
  }

  const logWarn = () => {
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText:   'WARN',
      body:           'User triggered a warning log event',
      attributes:     { 'log.source': 'manual', 'event.name': 'demo.log_warn' },
    })
    log('warn', 'Emitted WARN log record')
  }

  const logError = () => {
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText:   'ERROR',
      body:           'User triggered an error log event',
      attributes:     { 'log.source': 'manual', 'event.name': 'demo.log_error', 'error.type': 'DemoError' },
    })
    log('error', 'Emitted ERROR log record')
  }

  return {
    fetchOk, fetch404, fetchNetErr, xhr, jsError, navigation, customSpan, nestedSpans,
    logInfo, logWarn, logError,
  }
}
