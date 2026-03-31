// ui.js — DOM utilities: logging, status pill, form, URL sync, custom attrs

// ── Logging ───────────────────────────────────────────────────────────────────

const LOG_ICONS = {
  info: 'i', success: '✓', error: '✗', warn: '!', span: '◈', nav: '→', muted: '·',
}

let logCount = 0

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function log(type, msg) {
  const body = document.getElementById('log-body')
  const placeholder = body.querySelector('[data-placeholder]')
  if (placeholder) body.innerHTML = ''

  const t = new Date().toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const entry = document.createElement('div')
  entry.className = 'le'
  entry.innerHTML =
    `<span class="le-time">${t}</span>` +
    `<span>${LOG_ICONS[type]}</span>` +
    `<span class="le-msg ${type}">${escHtml(msg)}</span>`

  body.appendChild(entry)
  body.scrollTop = body.scrollHeight
  document.getElementById('log-count').textContent = `(${++logCount})`
}

export function clearLog() {
  logCount = 0
  document.getElementById('log-body').innerHTML = `
    <div class="le" data-placeholder>
      <span class="le-time">—</span>
      <span>·</span>
      <span class="le-msg muted">Log cleared.</span>
    </div>`
  document.getElementById('log-count').textContent = '(0)'
}

// ── SDK status pill ───────────────────────────────────────────────────────────

export function setStatus(state, msg) {
  document.getElementById('dot').className = `dot ${state}`
  const lbl = document.getElementById('sdk-label')
  lbl.textContent = msg
  lbl.style.color =
    state === 'ok'    ? 'var(--green)' :
    state === 'error' ? 'var(--red)'   : 'var(--muted)'
}

// ── Action buttons ────────────────────────────────────────────────────────────

export function enableButtons() {
  document.querySelectorAll('#btn-grid .btn, #btn-grid-logs .btn')
    .forEach(b => { b.disabled = false })
}

// ── Code snippet ──────────────────────────────────────────────────────────────

export function updateSnippet(config, customAttrs) {
  const attrsEntries = Object.entries(customAttrs)
  const attrsStr = attrsEntries.length === 0
    ? ''
    : `,\n  <span class="prop">attributes</span>: {\n${
        attrsEntries.map(([k, v]) =>
          `    <span class="prop">${escHtml(k)}</span>: <span class="str">'${escHtml(v)}'</span>`
        ).join(',\n')
      }\n  }`

  document.getElementById('code-snippet').innerHTML =
    `<span class="kw">import</span> { <span class="fn">BrowserSDK</span> } <span class="kw">from</span> <span class="str">'@opentelemetry/browser-instrumentation'</span>;

<span class="kw">const</span> sdk = <span class="kw">new</span> <span class="fn">BrowserSDK</span>({
  <span class="prop">serviceName</span>:    <span class="str">'${escHtml(config.serviceName)}'</span>,
  <span class="prop">serviceVersion</span>: <span class="str">'${escHtml(config.serviceVersion)}'</span>,
  <span class="prop">otlpExporterConfig</span>: {
    <span class="prop">tracesUrl</span>: <span class="str">'${escHtml(config.tracesUrl)}'</span>,
    <span class="prop">logsUrl</span>:   <span class="str">'${escHtml(config.logsUrl)}'</span>,
  }${attrsStr},
});

sdk.<span class="fn">start</span>();`
}

// ── URL sync ──────────────────────────────────────────────────────────────────

function buildUrl() {
  const sn        = document.getElementById('ub-sn').value.trim()
  const sv        = document.getElementById('ub-sv').value.trim()
  const tracesUrl = document.getElementById('ub-traces-url').value.trim()
  const logsUrl   = document.getElementById('ub-logs-url').value.trim()
  const attrs     = readCustomAttributes()

  const p = new URLSearchParams()
  if (sn)        p.set('serviceName',    sn)
  if (sv)        p.set('serviceVersion', sv)
  if (tracesUrl) p.set('tracesUrl',      tracesUrl)
  if (logsUrl)   p.set('logsUrl',        logsUrl)
  const attrsEntries = Object.entries(attrs)
  if (attrsEntries.length > 0) {
    p.set('attrs', encodeURIComponent(JSON.stringify(attrs)))
  }

  const qs = p.toString()
  return location.origin + location.pathname + (qs ? '?' + qs : '')
}

export function syncUrl() {
  const url = buildUrl()
  history.replaceState(null, '', url)
  const out = document.getElementById('ub-out')
  if (out) out.textContent = url
}

function copyUrl() {
  const url = buildUrl()
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copy-btn')
    btn.textContent = '✓ Copied!'
    setTimeout(() => { btn.textContent = 'Copy' }, 1400)
  }).catch(() => { /* clipboard unavailable */ })
}

// ── Config form ───────────────────────────────────────────────────────────────

export function initConfigForm(initialConfig, onChange) {
  document.getElementById('ub-sn').value         = initialConfig.serviceName
  document.getElementById('ub-sv').value         = initialConfig.serviceVersion
  document.getElementById('ub-traces-url').value = initialConfig.tracesUrl
  document.getElementById('ub-logs-url').value   = initialConfig.logsUrl

  const handleChange = () => { syncUrl(); onChange() }
  ;['ub-sn', 'ub-sv', 'ub-traces-url', 'ub-logs-url'].forEach(id =>
    document.getElementById(id).addEventListener('input', handleChange)
  )

  // Copy button
  const ubResult = document.getElementById('ub-result')
  const copyBtn  = document.getElementById('copy-btn')
  const doCopy   = (e) => { e.stopPropagation(); copyUrl() }
  ubResult?.addEventListener('click', doCopy)
  copyBtn?.addEventListener('click',  doCopy)

  syncUrl()
}

// ── Custom attributes ─────────────────────────────────────────────────────────

export function readCustomAttributes() {
  const attrs = {}
  document.querySelectorAll('.attr-row').forEach(row => {
    const key = row.querySelector('.attr-key').value.trim()
    const val = row.querySelector('.attr-val').value.trim()
    if (key) attrs[key] = val
  })
  return attrs
}

function addAttrRow(key, val, onChange) {
  const list = document.getElementById('custom-attrs-list')
  const row  = document.createElement('div')
  row.className = 'attr-row'
  row.innerHTML = `
    <input type="text" class="ub-input attr-key" placeholder="attribute-key" value="${escHtml(key)}" />
    <span class="attr-sep">:</span>
    <input type="text" class="ub-input attr-val" placeholder="value" value="${escHtml(val)}" />
    <button class="attr-remove" title="Remove">×</button>`

  row.querySelector('.attr-remove').addEventListener('click', () => {
    row.remove()
    onChange()
  })
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', onChange))
  list.appendChild(row)
}

export function initCustomAttributes(initialAttrs, onChange) {
  const handleChange = () => { syncUrl(); onChange() }

  for (const [k, v] of Object.entries(initialAttrs)) {
    addAttrRow(k, v, handleChange)
  }

  document.getElementById('btn-add-attr').addEventListener('click', () => {
    addAttrRow('', '', handleChange)
    handleChange()
  })
}
