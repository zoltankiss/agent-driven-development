#!/usr/bin/env node
// Agent Signup Flow (ADD 1.0 / Web Bot Auth)
//
// Demonstrates signing an HTTP request per RFC 9421 + Web Bot Auth and
// using it to sign up with an ADD-native app.
//
// Usage:
//   APP_URL=https://example.com AGENT_FQDN=https://my-agent.example \
//   AGENT_USERNAME=my-agent node agent-signup-flow.mjs
//
// Environment:
//   APP_URL         - The ADD-native app's root URL (default https://example.com)
//   AGENT_FQDN      - The agent's own HTTPS FQDN, used as Signature-Agent
//                     (default https://agent.example)
//   AGENT_USERNAME  - Username to register (default my-agent)

import crypto from "node:crypto";

const APP_URL = process.env.APP_URL ?? "https://example.com";
const AGENT_FQDN = process.env.AGENT_FQDN ?? "https://agent.example";
const AGENT_USERNAME = process.env.AGENT_USERNAME ?? "my-agent";

// ----- Keypair (in production, persist & publish public key as JWK at
// `${AGENT_FQDN}/.well-known/http-message-signatures-directory`) -----
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

// Ed25519 raw public key bytes -> JWK
function ed25519ToJwk(pubKey) {
  const der = pubKey.export({ format: "der", type: "spki" });
  // SPKI Ed25519: last 32 bytes are the raw public key
  const raw = der.subarray(der.length - 32);
  return { kty: "OKP", crv: "Ed25519", x: raw.toString("base64url") };
}

// RFC 7638 JWK Thumbprint (per RFC 8037 §A.3 for OKP)
function jwkThumbprint(jwk) {
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x });
  return crypto.createHash("sha256").update(canonical).digest("base64url");
}

const jwk = ed25519ToJwk(publicKey);
const keyid = jwkThumbprint(jwk);
console.log(`[setup] keyid = ${keyid}`);
console.log(`[setup] JWK   = ${JSON.stringify({ ...jwk, kid: keyid })}`);
console.log(`[setup] Publish this JWK Set at:`);
console.log(`        ${AGENT_FQDN}/.well-known/http-message-signatures-directory\n`);

// ----- 1. Discover -----
const manifestRes = await fetch(`${APP_URL}/.well-known/add.json`);
if (!manifestRes.ok) {
  console.error(`Discovery failed: ${manifestRes.status}`);
  process.exit(1);
}
const manifest = await manifestRes.json();
const signupPath = manifest.auth.agent_signup;
const signupUrl = new URL(signupPath, APP_URL).toString();
console.log(`[discover] signup -> ${signupUrl}\n`);

// ----- 2. Build signed signup request -----
const body = JSON.stringify({ username: AGENT_USERNAME, entityType: "agent" });
const contentDigest = `sha-256=:${crypto.createHash("sha256").update(body).digest("base64")}:`;

const url = new URL(signupUrl);
const created = Math.floor(Date.now() / 1000);
const expires = created + 60; // 60s freshness window
const nonce = crypto.randomBytes(64).toString("base64url");
const covered = ["@method", "@authority", "@target-uri", "signature-agent", "content-digest"];

// Component values (RFC 9421 §2)
const componentValues = {
  "@method": "POST",
  "@authority": url.host,
  "@target-uri": url.toString(),
  "signature-agent": `"${AGENT_FQDN}"`,
  "content-digest": contentDigest,
};

// signature-params line (RFC 9421 §2.3)
const paramsList = covered.map((c) => `"${c}"`).join(" ");
const sigParams =
  `(${paramsList});created=${created};expires=${expires};` +
  `keyid="${keyid}";alg="ed25519";nonce="${nonce}";tag="web-bot-auth"`;

// Signature base (RFC 9421 §2.5)
const base =
  covered.map((c) => `"${c}": ${componentValues[c]}`).join("\n") +
  `\n"@signature-params": ${sigParams}`;

// Sign with Ed25519
const sigBytes = crypto.sign(null, Buffer.from(base), privateKey);
const signatureHeader = `sig1=:${sigBytes.toString("base64")}:`;
const signatureInputHeader = `sig1=${sigParams}`;

// ----- 3. Send -----
console.log(`[signup] POST ${signupUrl}`);
console.log(`         Signature-Agent: "${AGENT_FQDN}"`);
console.log(`         Signature-Input: ${signatureInputHeader.slice(0, 90)}...`);
console.log(`         Signature: ${signatureHeader.slice(0, 40)}...`);
console.log(`         Content-Digest: ${contentDigest}\n`);

const res = await fetch(signupUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Signature-Agent": `"${AGENT_FQDN}"`,
    "Signature-Input": signatureInputHeader,
    Signature: signatureHeader,
    "Content-Digest": contentDigest,
  },
  body,
});

const payload = await res.text();
console.log(`[response] ${res.status}\n${payload}`);
