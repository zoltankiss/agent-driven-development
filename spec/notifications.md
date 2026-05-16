# Notifications

**Status:** Recommended | **Version:** 1.0.0

ADD-native apps SHOULD support webhook notifications so agents can be notified of events without polling.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Defaults

| Entity Type | Default Channel | Can Change? |
|-------------|----------------|-------------|
| Agent | Webhook | Yes |
| Human | Email | Yes |

Both agents and humans MAY change their notification preference at any time via `PATCH {manifest.auth.profile_url}`.

## Webhook Registration

Agents register their webhook URL by updating their profile. The PATCH itself is authenticated per ADD 1.0 (Web Bot Auth signed request or optional Bearer token):

```
PATCH {manifest.auth.profile_url}
Signature-Agent: "https://my-agent.example"
Signature-Input: ...
Signature: ...
Content-Type: application/json

{ "inboxUrl": "https://my-agent.example.com/inbox" }
```

## Webhook Delivery

When an event occurs, the platform sends the webhook **signed using Web Bot Auth** ([RFC 9421](https://www.rfc-editor.org/rfc/rfc9421) + [draft-meunier-web-bot-auth-architecture](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)). The headers and signing rules are identical to those agents use for their own requests (see [auth: Webhook Authentication](./auth.md#webhook-authentication)):

```
POST <agent's inboxUrl>
Signature-Agent: "https://<platform-fqdn>"
Signature-Input: sig1=("@method" "@authority" "@target-uri" "signature-agent" "content-digest");\
  created=<unix>;expires=<unix+≤300>;keyid="<platform JWK thumbprint>";\
  alg="ed25519";tag="web-bot-auth"
Signature: sig1=:<base64 Ed25519 signature>:
Content-Digest: sha-256=:<base64 SHA-256 digest of body>:
Content-Type: application/json
```

### Payload

```json
{
  "event": "draft_submitted",
  "resourceId": "uuid",
  "resourceType": "gig",
  "message": "A new draft has been submitted for your review.",
  "timestamp": "2026-03-14T14:30:00.000Z",
  "data": {},
  "platform": {
    "name": "My ADD App",
    "url": "https://example.com"
  }
}
```

The platform's public key is no longer embedded in the payload — it is published at the platform's RFC 9421 key directory (see [Discovery: Platform Key Publication](./discovery.md#platform-key-publication)).

See [`../schemas/notification-payload.schema.json`](../schemas/notification-payload.schema.json) for the full schema.

### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | Yes | Event type identifier (app-defined, e.g., `"draft_submitted"`, `"payment_received"`) |
| `resourceId` | string | Yes | ID of the resource this event relates to |
| `resourceType` | string | Yes | Type of the resource (e.g., `"gig"`, `"draft"`, `"payment"`) |
| `message` | string | Yes | Human/agent-readable description of what happened |
| `timestamp` | string | Yes | ISO 8601 UTC timestamp of when the event occurred |
| `data` | object | No | Additional event-specific data |
| `platform.name` | string | Yes | Name of the sending platform |
| `platform.url` | string | Yes | Base URL of the sending platform |

## Signature Verification

To verify an incoming webhook, the agent:

1. Reads `Signature-Agent` to identify the sender's FQDN.
2. Reads the `keyid` from `Signature-Input`.
3. Looks up the key:
   - Preferred: fetch `<signature-agent>/.well-known/http-message-signatures-directory` and find the JWK with `kid == keyid`.
   - Shortcut: use `platform_directory_url` from the ADD manifest (and/or `platform_public_key` for TOFU pinning).
4. Verifies `tag == "web-bot-auth"`, `alg == "ed25519"`, and `expires` has not passed.
5. Verifies `Content-Digest` matches the SHA-256 of the raw body.
6. Reconstructs the signature base per RFC 9421 §2.5 and verifies the Ed25519 signature.

### Trust Model

ADD 1.0 supports two trust models:

- **Directory-based (RECOMMENDED).** Fetch the platform's directory at the URL named in `Signature-Agent` (or in `platform_directory_url` from the manifest). Cache JWKs short-term per `Cache-Control`. Supports rotation natively.
- **TOFU (Trust On First Use).** Pin `platform_public_key` (JWK) from the manifest on first contact. Reject webhooks whose `keyid` does not match the pinned key.

## Delivery Guarantees

| Property | Value |
|----------|-------|
| **Timeout** | 5 seconds |
| **Retry policy** | Fire-and-forget; failures are logged but MUST NOT block the caller |
| **Ordering** | Not guaranteed |
| **Delivery** | At-least-once is RECOMMENDED but not required |

Apps MAY implement retry logic with exponential backoff, but this is not required by the spec.

## Key Rotation

The platform rotates its signing key by adding a new JWK to its directory. Agents discover the new `keyid` on the first webhook signed with the new key and fetch the updated directory. Old keys remain valid until removed from the directory.
