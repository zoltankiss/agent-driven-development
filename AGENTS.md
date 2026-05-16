# ADD Protocol — Agent Quick Reference

**Version:** 1.0.0

This document is optimized for consumption by AI agents. It contains the complete ADD (Agent Driven Development) protocol in a concise, machine-readable format.

## Discovery

ADD-native apps MUST serve a manifest at `/.well-known/add.json`. Fetch this first.

```
GET /.well-known/add.json
```

The manifest tells you where all endpoints are. See [schemas/add-manifest.schema.json](./schemas/add-manifest.schema.json) for the full schema.

## Authentication

ADD 1.0 uses [HTTP Message Signatures (RFC 9421)](https://www.rfc-editor.org/rfc/rfc9421) under the [Web Bot Auth profile](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/). Every authenticated request is signed; there is **no separate login endpoint**.

### Identity

You are identified by `(signature-agent FQDN, keyid)`:
- `signature-agent` — your agent's HTTPS FQDN (sent in the `Signature-Agent` header)
- `keyid` — base64url JWK Thumbprint ([RFC 7638](https://www.rfc-editor.org/rfc/rfc7638)) of your Ed25519 public key

### Key Directory

Publish your Ed25519 public key(s) as a JWK Set at:

```
GET https://<your-fqdn>/.well-known/http-message-signatures-directory

{
  "keys": [
    { "kty": "OKP", "crv": "Ed25519", "x": "<base64url x>", "kid": "<JWK thumbprint>" }
  ]
}
```

### Signing a Request

Every authenticated request MUST include:

```
Signature-Agent: "https://my-agent.example"
Signature-Input: sig1=("@authority" "@method" "@target-uri" "signature-agent");\
  created=<unix>;expires=<unix+≤300>;keyid="<JWK thumbprint>";\
  alg="ed25519";nonce="<64-byte base64url>";tag="web-bot-auth"
Signature: sig1=:<base64url Ed25519 signature>:
```

**Constraints:**
- Algorithm: `ed25519` only
- `tag` MUST equal `"web-bot-auth"`
- `expires - created` MUST be ≤ 300 seconds
- Cover at minimum `@authority` (or `@target-uri`) plus `signature-agent`; ADD recommends also covering `@method`
- Add `content-digest` ([RFC 9530](https://www.rfc-editor.org/rfc/rfc9530)) when the request has a body

### Signup

```
POST {manifest.auth.agent_signup}
Signature-Agent: "https://my-agent.example"
Signature-Input: ...
Signature: ...
Content-Type: application/json

{ "username": "your-agent-name", "entityType": "agent" }
```

The request signature is the proof-of-possession — there is no `keyProof` field. If you can't host an HTTPS directory, include `"publicKey": { "kty": "OKP", "crv": "Ed25519", "x": "..." }` in the body; the server registers it directly and skips the directory fetch.

### Signup Response

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "your-agent-name",
      "entityType": "agent",
      "signatureAgent": "https://my-agent.example",
      "keyid": "<JWK thumbprint>"
    }
  },
  "ui": { "title": "Welcome", "message": "Account created." }
}
```

### Subsequent Requests

Same three headers (`Signature-Agent`, `Signature-Input`, `Signature`) on every authenticated call. The server identifies you on every request — no session state required.

### Optional Bearer Tokens

Servers MAY expose `auth.session_url`. POST a signed empty body there to mint a short-lived (`TTL ≤ 1h`) Bearer token, then send `Authorization: Bearer <token>` instead of the signature headers. Treat this as opportunistic; the signed path is canonical.

## API Interaction Pattern

The API always returns JSON. There is no HTML mode or content negotiation. You interact with the same API and get the same responses as a human using a frontend app. See [spec/architecture.md](./spec/architecture.md).

Every API response includes a `ui` block with human-readable context and available actions:

```json
{
  "data": { ... },
  "ui": {
    "title": "Page title",
    "message": "Explanation of what you're looking at",
    "actions": [
      { "label": "Do Something", "method": "POST", "href": "/api/resource", "description": "What this action does" }
    ],
    "navigation": [
      { "label": "Dashboard", "href": "/api/dashboard" },
      { "label": "My Profile", "href": "/api/me" }
    ]
  }
}
```

**Follow the `actions` and `navigation` links** — do not hardcode URLs beyond the initial discovery.

## When You Get a 404

404 responses include a sitemap of all available endpoints:

```json
{
  "error": { "code": "NOT_FOUND", "message": "Resource not found." },
  "sitemap": [
    { "path": "/api/gigs", "method": "GET", "description": "List all gigs", "auth_required": true }
  ],
  "ui": { "title": "Not Found", "message": "Here are the available endpoints." }
}
```

Use this to reorient yourself.

## Notifications

Register your webhook URL via `PATCH {manifest.auth.profile_url}`:

```json
{ "inboxUrl": "https://your-agent.example.com/inbox" }
```

The platform POSTs events to your inbox, signed using Web Bot Auth (same headers as agent requests):

```
POST <your inboxUrl>
Signature-Agent: "https://<platform-fqdn>"
Signature-Input: sig1=("@authority" "@method" "@target-uri" "signature-agent" "content-digest");\
  created=<unix>;expires=<unix+≤300>;keyid="<platform JWK thumbprint>";\
  alg="ed25519";tag="web-bot-auth"
Signature: sig1=:<base64url Ed25519 signature>:
Content-Digest: sha-256=:<base64 digest>:
Content-Type: application/json
```

Verify the signature by fetching the platform's directory at `<Signature-Agent>/.well-known/http-message-signatures-directory` (or use `platform_directory_url` from the discovery manifest). For agents that prefer pinning, `platform_public_key` (JWK) in the manifest is a TOFU bootstrap option.

## Feedback

Submit feedback via `POST {manifest.feedback_url}`:

```json
{
  "type": "bug",
  "message": "The /api/gigs endpoint returns 500 when filtering by date",
  "rating": 2,
  "sessionContext": { "endpoint": "/api/gigs", "params": {"date": "2026-01-01"}, "status": 500 }
}
```

## Error Responses

All errors follow a standard format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human/agent-readable description"
  },
  "ui": {
    "title": "Error Title",
    "message": "What went wrong and what to do next"
  }
}
```

See [spec/errors.md](./spec/errors.md) for all error codes.

## Zero-Documentation Principle

You should be able to use any ADD-compliant app given only: the root URL, your Ed25519 keypair, and (if applicable) a project/workspace identifier. Everything else — auth flows, endpoints, request formats, available actions — is discoverable from the app itself. If you need to read a README or external docs to get started, the app is not ADD-compliant. See [spec/zero-documentation.md](./spec/zero-documentation.md).

## Agent Checklist

1. Fetch `/.well-known/add.json` to discover the app
2. Publish your JWK Set at `https://<your-fqdn>/.well-known/http-message-signatures-directory`
3. Sign up by POSTing a Web Bot Auth-signed request to `auth.agent_signup`
4. Sign every subsequent authenticated request with `Signature-Agent` / `Signature-Input` / `Signature`
5. Follow `ui.actions` and `ui.navigation` links — don't hardcode URLs
6. Register your `inboxUrl` to receive notifications
7. Submit feedback when you encounter issues
8. On 404, read the sitemap to reorient
