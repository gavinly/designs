import SafeAppsSDK from '@safe-global/safe-apps-sdk'
import { SafeAppProvider } from '@safe-global/safe-apps-provider'
import './style.css'

const app = document.querySelector('#app')

const state = {
  sdk: null,
  provider: null,
  safe: null,
  challenge: null,
  signature: null,
  receipt: null,
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function shortAddress(address) {
  return address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '—'
}

function randomNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function utf8ToHex(text) {
  const bytes = new TextEncoder().encode(text)
  return `0x${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}

function networkName(chainId) {
  return Number(chainId) === 1 ? 'Ethereum Mainnet' : `Chain ${chainId}`
}

function buildChallenge() {
  const safe = state.safe
  const issuedAt = new Date().toISOString()
  const nonce = randomNonce()
  const origin = window.location.origin
  const message = [
    'Armada Safe control verification',
    '',
    `Safe: ${safe.safeAddress}`,
    `Chain: ${networkName(safe.chainId)} (${safe.chainId})`,
    'Purpose: Verify control of this Safe for an Armada revenue-locked ARM allocation.',
    `Challenge: ${nonce}`,
    `Issued at: ${issuedAt}`,
    `App origin: ${origin}`,
    '',
    'By approving this message, the Safe owners confirm that this Safe is under their control and may be used as an Armada allocation recipient.',
    '',
    'This message does NOT authorize any transaction, token transfer, approval, delegation, or change to the Safe.'
  ].join('\n')

  return { nonce, issuedAt, origin, message, messageHex: utf8ToHex(message) }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text)
  const old = button.textContent
  button.textContent = 'Copied'
  setTimeout(() => { button.textContent = old }, 1200)
}

function renderOutsideSafe() {
  app.innerHTML = `
    <main class="shell">
      <header class="brand"><img src="/armada-logo.svg" alt="Armada" /></header>
      <section class="hero card">
        <div class="eyebrow">SAFE VERIFICATION</div>
        <h1>Open this app inside Safe.</h1>
        <p class="lead">This page verifies the Safe currently selected in Safe{Wallet}. It does not connect to MetaMask directly and cannot create transactions.</p>
        <div class="notice">
          <strong>In Safe{Wallet}</strong>
          <span>Apps → My custom apps → Add custom Safe App → paste this URL.</span>
        </div>
        <button class="secondary" id="copy-url">Copy app URL</button>
      </section>
    </main>`
  document.querySelector('#copy-url').onclick = e => copyText(window.location.origin, e.currentTarget)
}

function renderConnected() {
  const safe = state.safe
  const isMainnet = Number(safe.chainId) === 1
  const owners = Array.isArray(safe.owners) ? safe.owners : []
  const threshold = safe.threshold ?? '—'

  app.innerHTML = `
    <main class="shell">
      <header class="brand"><img src="/armada-logo.svg" alt="Armada" /></header>

      <section class="hero card">
        <div class="eyebrow">SAFE VERIFICATION</div>
        <h1>Verify this Safe for Armada.</h1>
        <p class="lead">Confirm that the Safe currently open in Safe{Wallet} is controlled by its configured owners and may be used as an Armada revenue-locked ARM recipient.</p>

        <div class="safe-box">
          <div>
            <span class="label">SAFE</span>
            <strong class="mono">${escapeHtml(safe.safeAddress)}</strong>
          </div>
          <div class="safe-meta">
            <span>${escapeHtml(networkName(safe.chainId))}</span>
            <span>${escapeHtml(String(threshold))}-of-${escapeHtml(String(owners.length || '?'))}</span>
          </div>
        </div>

        ${isMainnet ? '' : `<div class="warning"><strong>Wrong network.</strong> Armada allocations are on Ethereum mainnet. Switch this Safe to Ethereum before verifying.</div>`}

        <div class="assurance">
          <span class="check">✓</span>
          <div><strong>No transaction will be created.</strong><br /><span>This only requests a Safe message signature. It cannot transfer ARM, approve tokens, delegate votes, or change Safe settings.</span></div>
        </div>

        <button class="primary" id="sign" ${isMainnet ? '' : 'disabled'}>Sign verification message</button>
        <p class="hint">Safe will collect the number of owner approvals required by this Safe. Keep the signing window open until the threshold is reached.</p>
      </section>

      <section class="card detail">
        <button class="disclosure" id="challenge-toggle" aria-expanded="false">Preview the exact message <span>+</span></button>
        <pre id="challenge" class="challenge hidden"></pre>
      </section>
    </main>`

  state.challenge = buildChallenge()
  document.querySelector('#challenge').textContent = state.challenge.message
  document.querySelector('#challenge-toggle').onclick = e => {
    const pre = document.querySelector('#challenge')
    const open = pre.classList.toggle('hidden') === false
    e.currentTarget.setAttribute('aria-expanded', String(open))
    e.currentTarget.querySelector('span').textContent = open ? '−' : '+'
  }
  document.querySelector('#sign').onclick = signChallenge
}

function renderVerified() {
  const safe = state.safe
  app.innerHTML = `
    <main class="shell">
      <header class="brand"><img src="/armada-logo.svg" alt="Armada" /></header>
      <section class="hero card verified-card">
        <div class="verified-mark">✓</div>
        <div class="eyebrow">VERIFICATION COMPLETE</div>
        <h1>Safe control verified.</h1>
        <p class="lead">Safe{Wallet} returned a threshold-valid off-chain signature for the Armada verification message.</p>

        <div class="receipt-summary">
          <div><span>Safe</span><strong class="mono">${escapeHtml(shortAddress(safe.safeAddress))}</strong></div>
          <div><span>Network</span><strong>Ethereum Mainnet</strong></div>
          <div><span>Threshold</span><strong>${escapeHtml(String(safe.threshold ?? '—'))}-of-${escapeHtml(String((safe.owners || []).length || '?'))}</strong></div>
          <div><span>Verified</span><strong>${escapeHtml(new Date(state.receipt.verifiedAt).toLocaleString())}</strong></div>
        </div>

        <button class="primary" id="download">Download verification receipt</button>
        <button class="secondary" id="copy-receipt">Copy receipt JSON</button>
        <p class="hint">Send the JSON receipt to Armada. It contains the exact message and Safe signature, not any private key material.</p>
      </section>

      <section class="card detail">
        <button class="disclosure" id="receipt-toggle" aria-expanded="false">Inspect verification receipt <span>+</span></button>
        <pre id="receipt" class="challenge hidden">${escapeHtml(JSON.stringify(state.receipt, null, 2))}</pre>
      </section>
    </main>`

  document.querySelector('#download').onclick = () => {
    downloadJson(`armada-safe-verification-${safe.safeAddress}.json`, state.receipt)
  }
  document.querySelector('#copy-receipt').onclick = e => copyText(JSON.stringify(state.receipt, null, 2), e.currentTarget)
  document.querySelector('#receipt-toggle').onclick = e => {
    const pre = document.querySelector('#receipt')
    const open = pre.classList.toggle('hidden') === false
    e.currentTarget.setAttribute('aria-expanded', String(open))
    e.currentTarget.querySelector('span').textContent = open ? '−' : '+'
  }
}

function renderError(message, detail = '') {
  app.innerHTML = `
    <main class="shell">
      <header class="brand"><img src="/armada-logo.svg" alt="Armada" /></header>
      <section class="hero card">
        <div class="eyebrow">VERIFICATION INCOMPLETE</div>
        <h1>${escapeHtml(message)}</h1>
        ${detail ? `<p class="lead">${escapeHtml(detail)}</p>` : ''}
        <button class="primary" id="retry">Try again</button>
      </section>
    </main>`
  document.querySelector('#retry').onclick = () => window.location.reload()
}

async function signChallenge() {
  const button = document.querySelector('#sign')
  button.disabled = true
  button.textContent = 'Waiting for Safe approvals…'

  try {
    // personal_sign is intentionally requested FROM the Safe address. Safe{Wallet}
    // handles collection of the Safe's configured threshold and returns the
    // aggregated EIP-1271-compatible signature when off-chain signing completes.
    const signature = await state.provider.request({
      method: 'personal_sign',
      params: [state.challenge.messageHex, state.safe.safeAddress],
    })

    if (!signature || signature === '0x') {
      throw new Error('Safe did not return a portable off-chain signature. In Safe Settings → Safe Apps, make sure on-chain message signing is disabled, then retry.')
    }

    state.signature = signature
    state.receipt = {
      schema: 'armada.safe-control-verification.v1',
      app: 'Armada Safe Verification',
      safeAddress: state.safe.safeAddress,
      chainId: Number(state.safe.chainId),
      network: networkName(state.safe.chainId),
      safeThreshold: state.safe.threshold ?? null,
      safeOwners: Array.isArray(state.safe.owners) ? state.safe.owners : [],
      issuedAt: state.challenge.issuedAt,
      verifiedAt: new Date().toISOString(),
      challengeNonce: state.challenge.nonce,
      appOrigin: state.challenge.origin,
      signingMethod: 'personal_sign via Safe Apps Provider',
      message: state.challenge.message,
      messageHex: state.challenge.messageHex,
      signature,
      statement: 'Receipt records a message signature returned by Safe{Wallet}; it does not authorize a transaction.'
    }
    renderVerified()
  } catch (error) {
    console.error(error)
    renderError('The Safe was not verified.', error?.message || String(error))
  }
}

async function init() {
  if (window.parent === window) {
    renderOutsideSafe()
    return
  }

  app.innerHTML = `<main class="shell"><section class="hero card loading"><div class="spinner"></div><h1>Connecting to Safe…</h1><p class="lead">Reading the Safe selected in Safe{Wallet}.</p></section></main>`

  try {
    const sdk = new SafeAppsSDK()
    const safe = await sdk.safe.getInfo()
    const provider = new SafeAppProvider(safe, sdk)
    state.sdk = sdk
    state.safe = safe
    state.provider = provider
    renderConnected()
  } catch (error) {
    console.error(error)
    renderError('Could not connect to Safe{Wallet}.', 'Open this URL from Apps → My custom apps inside Safe{Wallet}, rather than in a normal browser tab.')
  }
}

init()
