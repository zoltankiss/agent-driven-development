/**
 * Webhook Verification Example
 *
 * Demonstrates how an agent should verify incoming webhook notifications
 * from an ADD-native platform using Ed25519 signature verification.
 *
 * Usage:
 *   node webhook-verification.js
 *
 * In production, integrate the verifyWebhook() function into your
 * agent's HTTP server that receives POST requests at your inboxUrl.
 */

const crypto = require('crypto');
const http = require('http');

// Store known platform keys (TOFU - Trust On First Use)
const knownPlatformKeys = new Map();

/**
 * Verify an ADD webhook signature.
 *
 * @param {Buffer} rawBody - The raw request body bytes
 * @param {string} signature - The base64-encoded X-Signature header value
 * @param {string} publicKeyPem - The platform's public key from the payload
 * @param {string} platformUrl - The platform's URL for TOFU tracking
 * @returns {{ valid: boolean, warning?: string }}
 */
function verifyWebhook(rawBody, signature, publicKeyPem, platformUrl) {
  // TOFU: check if we've seen this platform before
  const knownKey = knownPlatformKeys.get(platformUrl);
  if (knownKey && knownKey !== publicKeyPem) {
    return {
      valid: false,
      warning: `Platform key changed for ${platformUrl}! Previously: ${knownKey.slice(0, 40)}...`,
    };
  }

  // Store the key on first use
  if (!knownKey) {
    knownPlatformKeys.set(platformUrl, publicKeyPem);
    console.log(`[TOFU] Stored public key for ${platformUrl}`);
  }

  // Verify the Ed25519 signature
  const signatureBuffer = Buffer.from(signature, 'base64');
  const isValid = crypto.verify(
    null, // Ed25519 doesn't use a separate hash algorithm
    rawBody,
    publicKeyPem,
    signatureBuffer
  );

  return { valid: isValid };
}

// --- Example: minimal webhook receiver ---

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/inbox') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);
    const signature = req.headers['x-signature'];

    if (!signature) {
      console.error('[WEBHOOK] Missing X-Signature header');
      res.writeHead(400);
      res.end('Missing X-Signature');
      return;
    }

    // Parse the payload to extract the platform's public key
    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch (e) {
      console.error('[WEBHOOK] Invalid JSON payload');
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    const { platform } = payload;
    if (!platform?.publicKey || !platform?.url) {
      console.error('[WEBHOOK] Missing platform.publicKey or platform.url');
      res.writeHead(400);
      res.end('Missing platform info');
      return;
    }

    // Verify the signature
    const result = verifyWebhook(rawBody, signature, platform.publicKey, platform.url);

    if (!result.valid) {
      console.error(`[WEBHOOK] Signature verification FAILED. ${result.warning || ''}`);
      res.writeHead(401);
      res.end('Invalid signature');
      return;
    }

    // Signature is valid — process the event
    console.log(`[WEBHOOK] Verified event: ${payload.event}`);
    console.log(`  Resource: ${payload.resourceType}/${payload.resourceId}`);
    console.log(`  Message: ${payload.message}`);
    console.log(`  Timestamp: ${payload.timestamp}`);

    res.writeHead(200);
    res.end('OK');
  });
});

server.listen(PORT, () => {
  console.log(`Agent webhook receiver listening on http://localhost:${PORT}/inbox`);
  console.log('Register this URL as your inboxUrl in the ADD-native app.');
});
