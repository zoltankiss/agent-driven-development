# Skill: Web Bot Auth (Ed25519) for ADD-Native Services

> How to authenticate as an agent to any ADD 1.0–native service using HTTP Message Signatures (RFC 9421) under the Web Bot Auth profile.

## Overview

ADD 1.0 uses **per-request signing** — there is no separate login endpoint and no session token (servers MAY offer one as an opt-in optimization). Every authenticated request carries three headers:

```
Signature-Agent: "https://<your-fqdn>"
Signature-Input: sig1=(...);created=...;expires=...;keyid="...";alg="ed25519";nonce="...";tag="web-bot-auth"
Signature: sig1=:<base64 Ed25519 signature>:
```

The server identifies you on every request by the `(signature-agent FQDN, keyid)` pair.

## Prerequisites

- An Ed25519 keypair (private + public)
- Your public key published as a JWK Set at `https://<your-fqdn>/.well-known/http-message-signatures-directory` (or registered directly via signup `publicKey` if you cannot host a directory)
- The target service's `/.well-known/add.json` manifest

## Identity Setup (One-Time)

### 1. Generate a keypair

```bash
openssl genpkey -algorithm Ed25519 -out agent.ed25519.pem
chmod 600 agent.ed25519.pem
openssl pkey -in agent.ed25519.pem -pubout -out agent.ed25519.pub
```

### 2. Compute the JWK and `keyid`

The `keyid` is the base64url **JWK Thumbprint** (RFC 7638) of your public key, computed per RFC 8037 §A.3 for OKP keys. Canonical JSON form: `{"crv":"Ed25519","kty":"OKP","x":"<base64url-x>"}` (members lexically sorted), SHA-256, base64url.

See `examples/agent-signup-flow.mjs` for a working implementation in Node.

### 3. Publish the JWK Set

Serve at `https://<your-fqdn>/.well-known/http-message-signatures-directory`:

```json
{
  "keys": [
    { "kty": "OKP", "crv": "Ed25519", "x": "<base64url-x>", "kid": "<thumbprint>" }
  ]
}
```

`Cache-Control: max-age=300` or shorter is RECOMMENDED.

## Signing a Request

Required signature parameters:

| Parameter | Value |
|-----------|-------|
| `created` | Unix seconds, now |
| `expires` | `created + N` where `N ≤ 300` (ADD-specific tightening of the WBA draft's 24h default) |
| `keyid`   | Your JWK thumbprint |
| `alg`     | `"ed25519"` |
| `tag`     | `"web-bot-auth"` |
| `nonce`   | 64 random bytes, base64url (SHOULD) |

Minimum covered components: `@authority` (or `@target-uri`) + `signature-agent` + `@signature-params`. ADD recommends also covering `@method`, and `content-digest` for requests with a body.

The signature base (RFC 9421 §2.5) is one line per covered component:

```
"@method": POST
"@authority": example.com
"@target-uri": https://example.com/api/auth/signup
"signature-agent": "https://my-agent.example"
"content-digest": sha-256=:<base64 digest>:
"@signature-params": ("@method" "@authority" "@target-uri" "signature-agent" "content-digest");created=...;expires=...;keyid="...";alg="ed25519";nonce="...";tag="web-bot-auth"
```

Sign with Ed25519, base64-encode, wrap as `sig1=:<base64>:` in the `Signature` header.

> **OpenSSL gotcha:** Ed25519 signing via `openssl pkeyutl` with stdin produces an empty signature on OpenSSL 3.x. Always write the signature base to a file and use `-in`. For non-trivial requests, prefer a language with a real crypto library (Node `crypto.sign(null, ...)`, Python `cryptography.hazmat.primitives.asymmetric.ed25519`, Go `crypto/ed25519`).

## Signup

```
POST {manifest.auth.agent_signup}
Signature-Agent: "https://my-agent.example"
Signature-Input: ...
Signature: ...
Content-Digest: ...
Content-Type: application/json

{ "username": "my-agent", "entityType": "agent" }
```

The signed request itself is the proof-of-possession. There is **no separate `keyProof` field** as in ADD 0.x.

If you cannot host an HTTPS directory at your FQDN, include `"publicKey": {"kty":"OKP","crv":"Ed25519","x":"..."}` in the body; the server will register that key directly and skip the directory fetch.

## Subsequent Requests

Send the same three headers on every authenticated call. The server identifies you on every request — no session token required.

### Optional Bearer Tokens

Some servers expose `auth.session_url` in the manifest. POST a signed empty body there to mint a short-lived (TTL ≤ 1h) Bearer token, then send `Authorization: Bearer <token>` instead of the signature headers. This is opportunistic — the signed path remains canonical.

## Common Errors

| Error code | Cause | Fix |
|------------|-------|-----|
| `INVALID_SIGNATURE_HEADERS` | Missing or malformed `Signature-Agent`/`Signature-Input`/`Signature` | Check header formatting; values must be RFC 9421 structured-field-encoded |
| `INVALID_SIGNATURE` | Signature did not verify | Recompute the signature base exactly per RFC 9421 §2.5 — most often the issue is whitespace, the @signature-params line ordering, or wrong covered-component values |
| `SIGNATURE_EXPIRED` | `expires` has passed (or `expires - created > 300`) | Use a fresh timestamp, set `expires` ≤ 5 minutes in the future |
| `DIRECTORY_FETCH_FAILED` | Server could not reach `<signature-agent>/.well-known/http-message-signatures-directory` | Confirm the directory is reachable over HTTPS; or include `publicKey` in the signup body |
| `KEY_NOT_IN_DIRECTORY` | `keyid` is not in the agent's published directory | Confirm `kid` in the JWK matches the signing `keyid`; check thumbprint computation |
| `AUTH_UNREGISTERED_AGENT` | Signed request authenticates a `(signature-agent, keyid)` pair not yet registered | Sign up first |

## Reference Implementation

See [`examples/agent-signup-flow.mjs`](../examples/agent-signup-flow.mjs) for a complete working signup flow including JWK thumbprint computation, signature base construction, and signed POST submission.

## Security Notes

- **NEVER** expose your private key in logs, commands, or tool outputs
- **NEVER** inline key material — always reference the file path
- The `expires` parameter (≤ 300s) and optional `nonce` together provide replay protection
- Each service independently registers your `(signature-agent, keyid)` — registering with one does not grant access to another
- To rotate keys: add a new JWK to your directory, sign new requests with the new key, the server picks it up on first encounter. Remove the old JWK after the freshness window expires

## References

- [RFC 9421 — HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421)
- [draft-meunier-web-bot-auth-architecture-05](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)
- [RFC 7638 — JSON Web Key (JWK) Thumbprint](https://www.rfc-editor.org/rfc/rfc7638)
- [RFC 8037 — Ed25519 in JWK](https://www.rfc-editor.org/rfc/rfc8037)
- [`spec/auth.md`](../spec/auth.md) — ADD 1.0 auth specification
