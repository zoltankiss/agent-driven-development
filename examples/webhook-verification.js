/**
 * Webhook Verification Example (ADD 1.0 / Web Bot Auth)
 *
 * Demonstrates how an agent verifies an incoming webhook from an ADD-native
 * platform that signs requests per RFC 9421 + the Web Bot Auth profile.
 *
 * Usage:
 *   node webhook-verification.js
 *
 * In production, plug verifyWebhook() into your HTTP server's POST /inbox handler.
 */

const crypto = require('crypto');
const http = require('http');

// Cache of platform JWK Sets fetched from <signature-agent>/.well-known/http-message-signatures-directory
const directoryCache = new Map(); // signatureAgent -> { keys, fetchedAt }
const DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;

// Optional: pinned platform keys from manifest (TOFU bootstrap)
const pinnedPlatformKeys = new Map(); // signatureAgent -> { kid, jwk }

async function fetchDirectory(signatureAgent) {
  const cached = directoryCache.get(signatureAgent);
  if (cached && Date.now() - cached.fetchedAt < DIRECTORY_CACHE_TTL_MS) {
    return cached.keys;
  }
  const res = await fetch(`${signatureAgent}/.well-known/http-message-signatures-directory`);
  if (!res.ok) throw new Error(`Directory fetch failed: ${res.status}`);
  const { keys } = await res.json();
  directoryCache.set(signatureAgent, { keys, fetchedAt: Date.now() });
  return keys;
}

function jwkToPem(jwk) {
  // Ed25519 JWK -> SPKI DER -> KeyObject
  // SPKI(Ed25519) = 302a300506032b6570032100 || raw_pubkey(32 bytes)
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  const raw = Buffer.from(jwk.x, 'base64url');
  if (raw.length !== 32) throw new Error('Ed25519 JWK x must be 32 bytes');
  const der = Buffer.concat([prefix, raw]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

// Parse a Signature-Input value like: sig1=("@method" "@authority");created=...;keyid="..."
function parseSignatureInput(headerValue) {
  const m = headerValue.match(/^([^=]+)=\(([^)]*)\);(.+)$/);
  if (!m) throw new Error('Malformed Signature-Input');
  const [, label, componentsRaw, paramsRaw] = m;
  const components = [...componentsRaw.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const params = {};
  for (const p of paramsRaw.split(';')) {
    const [k, v] = p.split('=');
    if (!k) continue;
    params[k] = v?.startsWith('"') ? v.slice(1, -1) : Number(v) || v;
  }
  return { label, components, params, paramsRaw };
}

function parseSignature(headerValue, label) {
  const re = new RegExp(`${label}=:([^:]+):`);
  const m = headerValue.match(re);
  if (!m) throw new Error('Malformed Signature header');
  return Buffer.from(m[1], 'base64');
}

function buildSignatureBase(req, components, paramsRaw, url) {
  const lines = components.map((c) => {
    let value;
    switch (c) {
      case '@method':       value = req.method.toUpperCase(); break;
      case '@authority':    value = url.host; break;
      case '@target-uri':   value = url.toString(); break;
      case '@path':         value = url.pathname; break;
      case 'signature-agent':
      case 'content-digest':
      case 'content-type':
        value = req.headers[c]; break;
      default:
        value = req.headers[c.toLowerCase()];
    }
    if (value === undefined) throw new Error(`Missing covered component: ${c}`);
    return `"${c}": ${value}`;
  });
  const componentList = components.map((c) => `"${c}"`).join(' ');
  lines.push(`"@signature-params": (${componentList});${paramsRaw}`);
  return lines.join('\n');
}

async function verifyWebhook(req, rawBody, fullUrl) {
  const sigAgentHeader = req.headers['signature-agent'];
  const sigInputHeader = req.headers['signature-input'];
  const sigHeader     = req.headers['signature'];
  if (!sigAgentHeader || !sigInputHeader || !sigHeader) {
    return { valid: false, reason: 'missing signature headers' };
  }

  // Signature-Agent is a structured-fields String, e.g. "https://platform.example"
  const signatureAgent = sigAgentHeader.replace(/^"/, '').replace(/"$/, '');

  const { label, components, params, paramsRaw } = parseSignatureInput(sigInputHeader);
  if (params.tag !== 'web-bot-auth') return { valid: false, reason: `bad tag: ${params.tag}` };
  if (params.alg !== 'ed25519')      return { valid: false, reason: `bad alg: ${params.alg}` };

  const now = Math.floor(Date.now() / 1000);
  if (params.expires < now)           return { valid: false, reason: 'signature expired' };
  if (params.expires - params.created > 300) return { valid: false, reason: 'expiry window > 300s' };

  // Content-Digest verification (RFC 9530)
  if (components.includes('content-digest')) {
    const expected = `sha-256=:${crypto.createHash('sha256').update(rawBody).digest('base64')}:`;
    if (req.headers['content-digest'] !== expected) {
      return { valid: false, reason: 'content-digest mismatch' };
    }
  }

  // Locate key
  let jwk;
  const pinned = pinnedPlatformKeys.get(signatureAgent);
  if (pinned && pinned.kid === params.keyid) {
    jwk = pinned.jwk;
  } else {
    const keys = await fetchDirectory(signatureAgent);
    jwk = keys.find((k) => k.kid === params.keyid);
    if (!jwk) return { valid: false, reason: 'keyid not in directory' };
    if (pinned && pinned.kid !== params.keyid) {
      console.warn(`[TOFU] keyid changed for ${signatureAgent}`);
    }
  }

  const base = buildSignatureBase(req, components, paramsRaw, fullUrl);
  const signature = parseSignature(sigHeader, label);
  const valid = crypto.verify(null, Buffer.from(base), jwkToPem(jwk), signature);
  return valid ? { valid: true } : { valid: false, reason: 'signature did not verify' };
}

// --- Demo HTTP receiver ---
const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/inbox') {
    res.writeHead(404); res.end('Not found'); return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks);
    const fullUrl = new URL(req.url, `http://${req.headers.host}`);
    try {
      const result = await verifyWebhook(req, rawBody, fullUrl);
      if (!result.valid) {
        console.error(`[WEBHOOK] Rejected: ${result.reason}`);
        res.writeHead(401); res.end(result.reason); return;
      }
      const payload = JSON.parse(rawBody.toString());
      console.log(`[WEBHOOK] Verified event: ${payload.event}`);
      console.log(`  Resource: ${payload.resourceType}/${payload.resourceId}`);
      console.log(`  Message:  ${payload.message}`);
      res.writeHead(200); res.end('OK');
    } catch (err) {
      console.error(`[WEBHOOK] Error: ${err.message}`);
      res.writeHead(400); res.end(err.message);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Agent webhook receiver listening on http://localhost:${PORT}/inbox`);
  console.log('Register this URL as your inboxUrl in the ADD-native app.');
});
