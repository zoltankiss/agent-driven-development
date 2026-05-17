# Authentication

**Status:** Required | **Version:** 1.0.0

ADD-native apps MUST authenticate agents using **HTTP Message Signatures** ([RFC 9421](https://www.rfc-editor.org/rfc/rfc9421)) with the **Web Bot Auth** profile ([draft-meunier-web-bot-auth-architecture-05](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)). For humans, apps SHOULD support WebAuthn/passkeys as the RECOMMENDED mechanism.

> **Breaking change in 1.0.0.** ADD 0.x defined a custom Ed25519 envelope (signup `keyProof`, login `"username:timestamp"` signature, Bearer tokens). 1.0.0 replaces this with a standards-based per-request signing model. See [Migration from 0.x](#migration-from-add-0x) at the bottom of this document.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Why Web Bot Auth

ADD's value-add is the agent-native *interaction shape* — discovery, `ui` blocks, 404-as-sitemap, feedback channels. Authentication is not a place ADD needs an opinion of its own. Web Bot Auth is the emerging mainstream standard for AI agents authenticating to web services, built directly on RFC 9421 (a published IETF standard). Aligning with it gives ADD agents interop with the broader bot/agent ecosystem (Cloudflare-fronted services, future agent-native apps) for free, and replaces ADD-specific cryptographic surface area with reviewed, profiled cryptographic primitives.

## Algorithm

ADD pins **Ed25519** exclusively (`alg="ed25519"` per the Web Bot Auth draft, §A.2). Web Bot Auth permits `rsa-pss-sha512` as well; ADD does not. No algorithm negotiation — keep the protocol simple.

## Agent Identity

An ADD agent is identified by the pair `(signature-agent FQDN, keyid)`:

- **`signature-agent`** is the FQDN the agent presents in the `Signature-Agent` HTTP header (e.g. `https://my-agent.example`).
- **`keyid`** is the base64url-encoded JWK Thumbprint ([RFC 7638](https://www.rfc-editor.org/rfc/rfc7638)) of the agent's Ed25519 public key, computed per Appendix A.3 of [RFC 8037](https://www.rfc-editor.org/rfc/rfc8037).

An agent MAY rotate keys at any time by publishing additional JWKs to its directory (see below); the `(signature-agent, keyid)` pair remains the durable identity used by the server.

## Key Directory

Each agent MUST publish its public key(s) at a well-known endpoint on its `signature-agent` FQDN:

```
GET https://<signature-agent>/.well-known/http-message-signatures-directory
```

The endpoint MUST return a [JWK Set](https://www.rfc-editor.org/rfc/rfc7517#section-5) containing one or more Ed25519 keys:

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
      "kid": "RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c"
    }
  ]
}
```

`kid` MUST equal the JWK thumbprint of the key (so `kid` == `keyid` in `Signature-Input`). The endpoint MUST be served over HTTPS and SHOULD set `Cache-Control: max-age=300` or shorter to allow timely key rotation.

Agents that cannot host an HTTPS endpoint (e.g. local-only agents) MAY register a public key directly via signup (see below); in that case the server uses the registered key by `keyid` and does not fetch a directory.

## Signing a Request

Every authenticated request MUST include three headers per RFC 9421 and the Web Bot Auth draft (§3):

```
Signature-Agent: "https://my-agent.example"
Signature-Input: sig1=("@authority" "@method" "@target-uri" "signature-agent");\
  created=1735689600;\
  expires=1735689900;\
  keyid="RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c";\
  alg="ed25519";\
  nonce="<64-byte base64url>";\
  tag="web-bot-auth"
Signature: sig1=:<base64url-encoded Ed25519 signature>:
```

### Covered Components

A signature base MUST cover at minimum:

- `@authority` **or** `@target-uri` (per Web Bot Auth §3)
- `@signature-params`
- `signature-agent`

ADD additionally RECOMMENDS covering:

- `@method`
- `content-digest` for requests with bodies (per [RFC 9530](https://www.rfc-editor.org/rfc/rfc9530))

### Signature Parameters

| Parameter | Requirement | Value |
|-----------|-------------|-------|
| `created` | MUST | Unix timestamp (seconds) when the signature was generated |
| `expires` | MUST | Unix timestamp at which the signature ceases to be valid. MUST NOT be more than **300 seconds** after `created` |
| `keyid` | MUST | JWK Thumbprint of the signing key |
| `alg` | MUST | `"ed25519"` |
| `tag` | MUST | `"web-bot-auth"` |
| `nonce` | SHOULD | base64url-encoded random byte array, 64 bytes RECOMMENDED |

> ADD tightens the Web Bot Auth recommendation of "expires within 24 hours" to **300 seconds** to preserve the freshness guarantee that ADD 0.x's 5-minute timestamp window provided.

### Server Verification

A server receiving a signed request MUST:

1. Parse the `Signature-Agent`, `Signature-Input`, and `Signature` headers.
2. Reject the request if `tag != "web-bot-auth"`, `alg != "ed25519"`, or `expires` has passed (or `expires - created > 300`).
3. Look up the key by `keyid`:
   - If the agent registered a public key at signup, use the stored key.
   - Otherwise, fetch `<signature-agent>/.well-known/http-message-signatures-directory` and locate the JWK with `kid == keyid`.
4. Reconstruct the signature base per RFC 9421 §2 using the components listed in `Signature-Input`.
5. Verify the signature with Ed25519.
6. If a `nonce` is present, ensure it has not been seen within the validity window of the signature. Servers MAY use a global or per-route nonce cache.
7. Map the `(signature-agent, keyid)` pair to a registered user, or return `401` (`AUTH_UNREGISTERED_AGENT`) if not registered.

## Agent Signup

```
POST {manifest.auth.agent_signup}
Content-Type: application/json
```

The signup request itself MUST be signed per the previous section. The request signature serves as proof-of-possession of the private key — there is no separate `keyProof` field as in 0.x.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Unique username for the agent |
| `entityType` | string | Yes | MUST be `"agent"` |
| `displayName` | string | No | Human-readable display name |
| `inboxUrl` | string | No | Webhook URL for notifications |
| `publicKey` | string | No | JWK (Ed25519, `kty: "OKP"`) for agents that cannot host a directory. If omitted, the server fetches the agent's directory at `<Signature-Agent>/.well-known/http-message-signatures-directory` |

### Server Behavior

On receiving a signed signup request, the server:

1. Verifies the signature (per [Server Verification](#server-verification)).
2. If `publicKey` is provided in the body, verifies that its JWK thumbprint matches the `keyid` in `Signature-Input`.
3. If `publicKey` is omitted, fetches the agent's key directory and confirms a matching JWK is present.
4. Registers the username, binding it to the `(signature-agent, keyid)` pair (and the explicit `publicKey` if provided).

### Success Response (201)

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "my-agent",
      "entityType": "agent",
      "displayName": "My Agent",
      "signatureAgent": "https://my-agent.example",
      "keyid": "RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c"
    }
  },
  "ui": {
    "title": "Welcome",
    "message": "Account created successfully. Your future signed requests will be authenticated as this agent."
  }
}
```

### Error Responses

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `INVALID_SIGNATURE_HEADERS` | Missing or malformed `Signature-Agent`, `Signature-Input`, or `Signature` |
| 401 | `INVALID_SIGNATURE` | Signature did not verify under the discovered key |
| 401 | `SIGNATURE_EXPIRED` | `expires` has passed |
| 401 | `DIRECTORY_FETCH_FAILED` | Could not fetch or parse the agent's key directory |
| 401 | `KEY_NOT_IN_DIRECTORY` | `keyid` not present in the agent's directory and no `publicKey` was provided in the body |
| 409 | `USERNAME_TAKEN` | The username is already registered |

## Authenticated Requests (No Login Endpoint)

**ADD 1.0 removes the agent login endpoint.** Per-request signing replaces session-based auth. Every authenticated request carries `Signature-Agent`, `Signature-Input`, and `Signature` headers; servers identify the agent on every request by `(signature-agent, keyid)`.

### Optional Bearer Tokens (Performance)

Servers MAY support session-based auth as a cheaper alternative for high-frequency clients. If supported:

- The server MUST return a `token` field in the signup response (or accept a signed `POST {manifest.auth.session_url}` request to mint one).
- Tokens MUST be short-lived (RECOMMENDED TTL: 1 hour) and bound to the `(signature-agent, keyid)` pair.
- Clients send the token as `Authorization: Bearer <token>` and OMIT the signature headers.
- If a request includes BOTH a Bearer token and signature headers, the server MUST verify the signature and ignore the token.

Servers that support tokens MUST publish `auth.session_url` in their discovery manifest. Clients SHOULD treat per-request signing as the canonical path and tokens as opportunistic.

## Webhook Authentication

Platform-issued webhooks (notifications) MUST also be signed using Web Bot Auth, with the platform acting as the signer:

- The platform's `Signature-Agent` is its own FQDN.
- The platform's key directory is published at `https://<platform-FQDN>/.well-known/http-message-signatures-directory`.
- The webhook's `keyid` is the platform's Ed25519 JWK thumbprint.
- The platform's directory URL SHOULD be discoverable via `platform_directory_url` in the ADD manifest (see [Discovery](./discovery.md)).
- For agents that prefer to pin a key on first contact, `platform_public_key` (raw Ed25519 in JWK form) MAY also be exposed in the manifest, retaining the 0.x TOFU bootstrap option.

Agents verify webhook signatures using the same procedure as servers verify agent signatures.

## Replay Protection

The `expires` parameter (≤ 300 seconds after `created`) provides a hard freshness window. Servers SHOULD additionally maintain a nonce cache covering the validity window when `nonce` is present, scoped at the level the server cares about (global, per-route, or per-(user, route) at the server's discretion, per Web Bot Auth §3.6).

## Human Authentication (WebAuthn / Passkeys)

ADD recognizes a fundamental symmetry between agent and human authentication: both can use public-key cryptography where the server never stores secrets.

| Entity | Mechanism | Key type | Flow |
|--------|-----------|----------|------|
| Agent | Ed25519 via RFC 9421 / Web Bot Auth | Software keypair, served from JWK directory | Sign every request |
| Human | WebAuthn / Passkey | Hardware/platform authenticator | Sign challenge with authenticator, get session token |

### WebAuthn/Passkeys (RECOMMENDED)

Apps SHOULD support WebAuthn/passkeys for human authentication. This gives humans the same public-key security model as agents — register a public key, prove private key ownership by signing a challenge — while leveraging platform authenticators (Face ID, Windows Hello, security keys).

#### Manifest Fields

Apps that support passkey auth SHOULD include these fields in the discovery manifest:

| Field | Type | Description |
|-------|------|-------------|
| `auth.human_passkey_register` | string | Path to the passkey registration options endpoint |
| `auth.human_passkey_login` | string | Path to the passkey authentication options endpoint |

#### Registration Flow

1. Client sends `POST {manifest.auth.human_passkey_register}` with `{ "username": "..." }` (new signup) or an `Authorization` header (adding passkey to existing account)
2. Server returns `PublicKeyCredentialCreationOptionsJSON` per the [WebAuthn spec](https://www.w3.org/TR/webauthn-3/)
3. Client calls `navigator.credentials.create()` with the options
4. Client sends the attestation response back to the server for verification
5. Server stores the credential and returns a session token

#### Authentication Flow

1. Client sends `POST {manifest.auth.human_passkey_login}` (no username needed for discoverable credentials)
2. Server returns `PublicKeyCredentialRequestOptionsJSON`
3. Client calls `navigator.credentials.get()` with the options
4. Client sends the assertion response back to the server for verification
5. Server verifies against stored credentials and returns a session token

#### Server Requirements

- The server MUST store a challenge with a short TTL (RECOMMENDED: 5 minutes) and verify it is consumed exactly once
- The server MUST store the credential public key, counter, and transport hints
- The server MUST verify the authenticator counter on each login to detect cloned authenticators
- The server SHOULD allow users to register multiple passkeys

### Fallback Methods

Apps MAY also support passwords, OAuth, or other human auth mechanisms as fallbacks. ADD does not prescribe these flows, but:

- If an entity selects `entityType: "human"` during signup, the app SHOULD require a CAPTCHA or equivalent challenge (for password-based signup)
- Humans MAY add an Ed25519 keypair later and use Web Bot Auth signing for API requests, indistinguishable from an agent
- The `entityType` field is metadata about the account, not a selector for authentication method

## Key Rotation

Agents rotate keys by updating their JWK directory:

1. Add a new JWK to the directory (keep the old one published in parallel).
2. Begin signing new requests with the new key.
3. The server fetches the directory on first encounter with the new `keyid` and accepts the new key for the registered agent.
4. Once all in-flight signatures using the old key have expired (worst case: 5 minutes after the last signed request), remove the old JWK from the directory.

For agents that registered an explicit `publicKey` at signup, key rotation requires a signed `PATCH` to `{manifest.auth.profile_url}` with the new `publicKey`. The PATCH request MUST be signed with the **new** key; servers verify the new key's signature and, if the new key's `keyid` matches the JWK thumbprint of the new public key, accept the rotation.

## Migration from ADD 0.x

| ADD 0.x | ADD 1.0 |
|---------|---------|
| Signup with `publicKey` + `keyProof` (signature of username) | Signup with a Web Bot Auth-signed request body; the request signature *is* the key proof |
| Login endpoint with `"username:timestamp"` signature | **Removed.** Per-request signing replaces login |
| Bearer token returned from login | Optional. Per-request signing is canonical; tokens MAY be issued as a perf optimization |
| `auth.ssh_namespace` manifest field | **Removed.** SSH signatures are no longer part of the core auth model |
| Raw Ed25519 signature, base64 | base64url signature inside RFC 9421 `Signature` header |
| Timestamp window: 5 minutes | `expires` parameter, MUST be ≤ 300 seconds after `created` |
| Webhook `X-Signature: <base64 sig>` | Webhook signed per Web Bot Auth (same headers as agent requests) |
| `platform_public_key` (PEM) in manifest | `platform_directory_url` (preferred) and/or `platform_public_key` (JWK) in manifest |

Servers MAY support 0.x and 1.0 in parallel during a transition period at their discretion, but new ADD-native apps MUST implement 1.0 and SHOULD NOT implement 0.x.

## References

- [RFC 9421 — HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421)
- [draft-meunier-web-bot-auth-architecture-05](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)
- [RFC 7638 — JSON Web Key (JWK) Thumbprint](https://www.rfc-editor.org/rfc/rfc7638)
- [RFC 8037 — CFRG ECDH and Signatures in JOSE (Ed25519 JWK)](https://www.rfc-editor.org/rfc/rfc8037)
- [RFC 9530 — Digest Fields](https://www.rfc-editor.org/rfc/rfc9530)
- [RFC 8615 — Well-Known URIs](https://www.rfc-editor.org/rfc/rfc8615)
