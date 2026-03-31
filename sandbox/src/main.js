// main.js — entry point
//
// 1. Parse config from URL query string (source of truth at boot time)
// 2. Populate the form with those values (display only)
// 3. Boot the OTel SDK directly from the parsed config — never from DOM reads
// 4. When form fields change, update the snippet + show a "Reinit SDK" banner
//    (resource attributes are immutable; a page reload applies changes via QS)
// 5. Bind all action buttons

import './app/style.css'
import { readConfigFromForm, parseConfigFromQueryString } from './config.js'
import {
  log, clearLog, setStatus, enableButtons,
  initConfigForm, initCustomAttributes,
  readCustomAttributes, updateSnippet, syncUrl,
} from './app/ui.js'
import { initOtel } from './otel.js'
import { createActions } from './app/actions.js'

// ── 1. Parse config from URL query string ────────────────────────────────────
// This is the single authoritative source for the initial config.
// The form is populated from it (step 2) but SDK init uses this directly.

const initialConfig = parseConfigFromQueryString()
const initialAttrs  = initialConfig.customAttributes

// ── 2. Populate the form ─────────────────────────────────────────────────────

// Called whenever any form field or custom attribute changes.
function onConfigChange() {
  const config = readConfigFromForm()
  const customAttrs = readCustomAttributes()
  updateSnippet(config, customAttrs)
  showReinitBanner()
}

initConfigForm(initialConfig, onConfigChange)
initCustomAttributes(initialAttrs, onConfigChange)
syncUrl() // re-sync after attr rows are in the DOM so ?attrs= is not stripped

// ── 3. Boot SDK from the parsed config ───────────────────────────────────────
// Use initialConfig / initialAttrs directly — no DOM round-trip needed.

updateSnippet(initialConfig, initialAttrs)
setStatus('loading', 'Initialising SDK…')

let handle = null

try {
  handle = initOtel(initialConfig, initialAttrs)

  setStatus('ok', `SDK ready · ${initialConfig.tracesUrl}`)
  log('info',  `SDK initialised — service="${initialConfig.serviceName}" v${initialConfig.serviceVersion}`)
  log('info',  `Traces → ${initialConfig.tracesUrl}`)
  log('info',  `Logs   → ${initialConfig.logsUrl}`)
  if (Object.keys(initialAttrs).length) {
    log('info', `Resource attrs → ${JSON.stringify(initialAttrs)}`)
  }
  log('muted', 'Open DevTools → Console to see full span/log objects')
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  setStatus('error', 'SDK init failed — check console')
  log('error', `SDK init error: ${msg}`)
  console.error('[OTel Sandbox] SDK init failed:', err)
}

// ── 3. Reinit banner ──────────────────────────────────────────────────────────

function showReinitBanner() {
  let banner = document.getElementById('reinit-banner')
  if (banner) return   // already visible
  banner = document.createElement('div')
  banner.id = 'reinit-banner'
  banner.className = 'reinit-banner'
  banner.innerHTML =
    'Resource attributes are set at SDK init — ' +
    '<button id="btn-reinit">Reinit SDK</button> to apply changes'
  // Insert banner after the custom-attrs section
  const attrsSection = document.querySelector('.attrs-section')
  attrsSection?.after(banner)
  document.getElementById('btn-reinit').addEventListener('click', () => {
    window.location.reload()
  })
}

// ── 4. Action buttons ─────────────────────────────────────────────────────────

const noopSpan = {
  setAttribute:    () => noopSpan,
  setAttributes:   () => noopSpan,
  addEvent:        () => noopSpan,
  addLink:         () => noopSpan,
  addLinks:        () => noopSpan,
  setStatus:       () => noopSpan,
  recordException: () => {},
  end:             () => {},
  isRecording:     () => false,
  spanContext:     () => ({ traceId: '0'.repeat(32), spanId: '', traceFlags: 0 }),
}

const noopTracer = {
  startSpan:       () => noopSpan,
  startActiveSpan: (_n, fn) => fn(noopSpan),
}

const noopLogger = {
  emit: () => {},
}

const actions = createActions(handle?.tracer ?? noopTracer, handle?.logger ?? noopLogger)

function on(id, handler) {
  document.getElementById(id)?.addEventListener('click', () => { void handler() })
}

on('btn-fetch-ok',  actions.fetchOk)
on('btn-fetch-404', actions.fetch404)
on('btn-fetch-net', actions.fetchNetErr)
on('btn-xhr',       actions.xhr)
on('btn-jserr',     actions.jsError)
on('btn-nav',       actions.navigation)
on('btn-custom',    actions.customSpan)
on('btn-nested',    actions.nestedSpans)
on('btn-log-info',  actions.logInfo)
on('btn-log-warn',  actions.logWarn)
on('btn-log-error', actions.logError)
on('btn-clear-log', clearLog)

enableButtons()
