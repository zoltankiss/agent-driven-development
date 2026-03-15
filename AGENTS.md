# ADD Protocol — Agent Quick Reference

**Version:** 0.0.1

This document is optimized for consumption by AI agents. It contains the complete ADD (Agent Driven Development) protocol in a concise, machine-readable format.

## Discovery

ADD-native apps MUST serve a manifest at `/.well-known/add.json`. Fetch this first.

```
GET /.well-known/add.json
```

The manifest tells you where all endpoints are. See [schemas/add-manifest.schema.json](./schemas/add-manifest.schema.json) for the full schema.

## Authentication

### Signup (Agent)

```
POST {manifest.auth.agent_signup}
Content-Type: application/json

{
  "username": "your-agent-name",
  "entityType": "agent",
  "publicKey": "<Ed25519 public key in PEM (SPKI) or OpenSSH format>",
  "keyProof": "<base64 Ed25519 signature of your username, proving key ownership>"
}
```

### Login (Agent)

```
POST {manifest.auth.agent_login}
Content-Type: application/json

{
  "username": "your-agent-name",
  "timestamp": "<ISO 8601 UTC, e.g. 2026-03-14T12:00:00.000Z>",
  "signature": "<base64 Ed25519 signature of 'username:timestamp'>"
}
```

**Constraints:**
- Timestamp MUST be UTC (Z suffix)
- Timestamp MUST be within 5 minutes of server time
- Algorithm: Ed25519 only
- Key formats: PEM (SPKI) or OpenSSH (`ssh-ed25519 AAAA...`)
- SSH signature namespace: MUST match the app's domain (from manifest)

### Login Response

```json
{
  "token": "<JWT or session token>",
  "user": { "id": "uuid", "username": "your-agent-name", "entityType": "agent" },
  "ui": { "title": "Welcome", "message": "You are now logged in." }
}
```

Use the token as `Authorization: Bearer <token>` on subsequent requests.

## API Interaction Pattern

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

The platform will POST events to your inbox:

```
POST <your inboxUrl>
Content-Type: application/json
X-Signature: <base64 Ed25519 signature of the JSON body>
```

Verify `X-Signature` against `platform.publicKey` in the payload. If the discovery manifest includes `platform_public_key`, agents SHOULD compare the payload key to that discovery key before trusting it. Trust model is TOFU (Trust On First Use) unless a stronger trust model is available.

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

## Agent Checklist

1. Fetch `/.well-known/add.json` to discover the app
2. Sign up with your Ed25519 public key
3. Log in by signing `"username:timestamp"`
4. Follow `ui.actions` and `ui.navigation` links — don't hardcode URLs
5. Register your `inboxUrl` to receive notifications
6. Submit feedback when you encounter issues
7. On 404, read the sitemap to reorient
