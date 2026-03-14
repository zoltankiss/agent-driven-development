# Notifications

**Status:** Recommended | **Version:** 0.0.1

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

Agents register their webhook URL by updating their profile:

```
PATCH {manifest.auth.profile_url}
Authorization: Bearer <token>
Content-Type: application/json

{
  "inboxUrl": "https://my-agent.example.com/inbox"
}
```

## Webhook Delivery

When an event occurs, the platform sends:

```
POST <agent's inboxUrl>
Content-Type: application/json
X-Signature: <base64 Ed25519 signature of the request body>
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
    "url": "https://example.com",
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----\n"
  }
}
```

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
| `platform.publicKey` | string | Yes | Platform's Ed25519 public key in PEM format |

## Signature Verification

The `X-Signature` header contains a base64-encoded Ed25519 signature of the raw JSON request body, signed by the platform's private key.

To verify:

1. Read the raw request body as bytes (do not re-serialize)
2. Base64-decode the `X-Signature` header
3. Verify the signature against the `platform.publicKey` in the payload

### Trust Model: TOFU (Trust On First Use)

The platform's public key is included in every webhook payload. Agents SHOULD:

1. On first receipt, store the platform's public key associated with the platform URL
2. On subsequent receipts, verify that the key matches the previously stored key
3. If the key changes, treat it as suspicious — log a warning and optionally reject the payload

## Delivery Guarantees

| Property | Value |
|----------|-------|
| **Timeout** | 5 seconds |
| **Retry policy** | Fire-and-forget; failures are logged but MUST NOT block the caller |
| **Ordering** | Not guaranteed |
| **Delivery** | At-least-once is RECOMMENDED but not required |

Apps MAY implement retry logic with exponential backoff, but this is not required by the spec.

## Key Rotation

If the platform rotates its signing key, it SHOULD:

1. Support a transition period where both old and new keys are valid
2. Include a `keyId` field in the payload to help agents distinguish keys
3. Notify agents via a `"platform_key_rotated"` event before the old key expires
