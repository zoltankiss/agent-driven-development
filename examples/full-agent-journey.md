# Full Agent Journey

This walkthrough shows a complete interaction between an agent and an ADD-native app, from discovery to feedback. Every request and response is shown.

## 1. Discover the App

```
GET https://example.com/.well-known/add.json
```

```json
{
  "add_version": "1.0.0",
  "app_name": "Ghostwriter Hub",
  "app_description": "A marketplace connecting writers with clients who need ghostwritten content.",
  "spec_url": "https://github.com/zoltankiss/agent-driven-development",
  "openapi_url": "/api/openapi.json",
  "auth": {
    "protocol": "web-bot-auth",
    "agent_signup": "/api/auth/signup",
    "profile_url": "/api/me",
    "human_oauth_providers": ["github"]
  },
  "platform_directory_url": "https://example.com/.well-known/http-message-signatures-directory",
  "notifications": {
    "webhook_config": "/api/me"
  },
  "feedback_url": "/api/feedback",
  "sitemap_url": "/api/sitemap"
}
```

The agent now knows everything it needs: where to sign up, how to authenticate, and what the app does. The agent has already published its public Ed25519 JWK at `https://writer-bot-7.example.com/.well-known/http-message-signatures-directory`.

## 2. Sign Up

The signup request is signed per RFC 9421 / Web Bot Auth. The request signature serves as the proof-of-possession.

```
POST https://example.com/api/auth/signup
Signature-Agent: "https://writer-bot-7.example.com"
Signature-Input: sig1=("@method" "@authority" "@target-uri" "signature-agent" "content-digest");\
  created=1742000000;expires=1742000060;\
  keyid="RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c";\
  alg="ed25519";nonce="<64-byte base64url>";tag="web-bot-auth"
Signature: sig1=:<base64 Ed25519 signature>:
Content-Digest: sha-256=:abc123...:
Content-Type: application/json

{
  "username": "writer-bot-7",
  "entityType": "agent",
  "inboxUrl": "https://writer-bot-7.example.com/inbox"
}
```

```
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "username": "writer-bot-7",
      "entityType": "agent",
      "displayName": "writer-bot-7",
      "signatureAgent": "https://writer-bot-7.example.com",
      "keyid": "RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c"
    }
  },
  "ui": {
    "title": "Welcome to Ghostwriter Hub",
    "message": "Your account has been created. You can now browse available gigs or update your profile.",
    "actions": [
      { "label": "Browse Gigs", "method": "GET", "href": "/api/gigs", "description": "See available writing gigs" },
      { "label": "Update Profile", "method": "PATCH", "href": "/api/me", "description": "Set your display name and preferences" }
    ],
    "navigation": [
      { "label": "Dashboard", "href": "/api/dashboard" },
      { "label": "Gigs", "href": "/api/gigs" },
      { "label": "My Profile", "href": "/api/me" }
    ]
  }
}
```

The agent follows the `ui.actions` — no need to guess URLs.

## 3. Browse the App

Every authenticated request carries the same three signature headers. No login step — the server identifies the agent by `(signature-agent, keyid)` on every request.

```
GET https://example.com/api/gigs
Signature-Agent: "https://writer-bot-7.example.com"
Signature-Input: sig1=("@method" "@authority" "@target-uri" "signature-agent");\
  created=1742000100;expires=1742000160;\
  keyid="RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c";\
  alg="ed25519";nonce="<64-byte base64url>";tag="web-bot-auth"
Signature: sig1=:<base64 Ed25519 signature>:
```

```json
{
  "data": [
    {
      "id": "gig-001",
      "title": "My Startup Journey",
      "description": "Need a 5,000 word blog post about founding a tech startup.",
      "budget": 500,
      "status": "open"
    }
  ],
  "ui": {
    "title": "Available Gigs",
    "message": "There is 1 open gig. Select one to view details and place a bid.",
    "actions": [
      { "label": "View Gig Details", "method": "GET", "href": "/api/gigs/gig-001", "description": "See full details for 'My Startup Journey'" }
    ],
    "navigation": [
      { "label": "Dashboard", "href": "/api/dashboard" },
      { "label": "Gigs", "href": "/api/gigs" },
      { "label": "My Profile", "href": "/api/me" }
    ]
  }
}
```

## 4. Take an Action (Place a Bid)

The agent follows the link to view gig details (signature headers omitted below for brevity — they appear on every authenticated request):

```
GET https://example.com/api/gigs/gig-001
Signature-Agent: "https://writer-bot-7.example.com"
Signature-Input: ...
Signature: ...
```

```json
{
  "data": {
    "id": "gig-001",
    "title": "My Startup Journey",
    "description": "Need a 5,000 word blog post about founding a tech startup.",
    "budget": 500,
    "status": "open",
    "createdBy": "human-client-42"
  },
  "ui": {
    "title": "My Startup Journey",
    "message": "This gig is open for bids. Budget: $500. Submit a bid with your proposed amount and a message to the client.",
    "actions": [
      {
        "label": "Place Bid",
        "method": "POST",
        "href": "/api/gigs/gig-001/bids",
        "description": "Submit a bid for this gig",
        "fields": [
          { "name": "amount", "type": "number", "required": true, "description": "Your bid amount in USD" },
          { "name": "message", "type": "string", "required": true, "description": "A message to the client explaining your approach" }
        ]
      }
    ]
  }
}
```

The `fields` array tells the agent exactly what to submit:

```
POST https://example.com/api/gigs/gig-001/bids
Signature-Agent: "https://writer-bot-7.example.com"
Signature-Input: ...
Signature: ...
Content-Digest: sha-256=:abc123...:
Content-Type: application/json

{
  "amount": 450,
  "message": "I can write this in 3 days. I have experience with startup narratives."
}
```

## 5. Receive a Notification

Later, the client accepts the bid. The platform sends a webhook, also signed using Web Bot Auth (same headers, with the platform as the signer):

```
POST https://writer-bot-7.example.com/inbox
Signature-Agent: "https://example.com"
Signature-Input: sig1=("@method" "@authority" "@target-uri" "signature-agent" "content-digest");\
  created=1742003600;expires=1742003660;\
  keyid="<platform JWK thumbprint>";\
  alg="ed25519";tag="web-bot-auth"
Signature: sig1=:<base64 Ed25519 signature>:
Content-Digest: sha-256=:def456...:
Content-Type: application/json

{
  "event": "bid_accepted",
  "resourceId": "gig-001",
  "resourceType": "gig",
  "message": "Your bid on 'My Startup Journey' has been accepted! You can now start writing.",
  "timestamp": "2026-03-14T15:00:00.000Z",
  "data": {
    "bidAmount": 450,
    "deadline": "2026-03-17T15:00:00.000Z"
  },
  "platform": {
    "name": "Ghostwriter Hub",
    "url": "https://example.com"
  }
}
```

The agent fetches `https://example.com/.well-known/http-message-signatures-directory` (or uses `platform_directory_url` / `platform_public_key` from the discovery manifest), locates the JWK with `kid == keyid`, verifies `Content-Digest`, then verifies the signature.

## 6. Handle a 404

The agent makes a typo:

```
GET https://example.com/api/giggs
Signature-Agent: "https://writer-bot-7.example.com"
Signature-Input: ...
Signature: ...
```

```
HTTP/1.1 404 Not Found
Content-Type: application/json
Link: </.well-known/add.json>; rel="service-desc"

{
  "error": { "code": "NOT_FOUND", "message": "The requested resource was not found." },
  "sitemap": [
    { "path": "/api/gigs", "method": "GET", "description": "List all available gigs", "auth_required": true },
    { "path": "/api/me", "method": "GET", "description": "View your profile", "auth_required": true },
    { "path": "/api/feedback", "method": "POST", "description": "Submit platform feedback", "auth_required": true },
    { "path": "/api/auth/signup", "method": "POST", "description": "Create a new account (Web Bot Auth signed request)", "auth_required": false }
  ],
  "ui": {
    "title": "Not Found",
    "message": "The page '/api/giggs' does not exist. Did you mean '/api/gigs'? Here are all available endpoints."
  }
}
```

The agent sees `/api/gigs` in the sitemap and corrects itself.

## 7. Submit Feedback

```
POST https://example.com/api/feedback
Signature-Agent: "https://writer-bot-7.example.com"
Signature-Input: ...
Signature: ...
Content-Digest: sha-256=:ghi789...:
Content-Type: application/json

{
  "type": "feature",
  "message": "It would be helpful if the gig listing included word count requirements in the summary, not just in the full details.",
  "rating": 4,
  "sessionContext": {
    "agentRuntime": "claude-code",
    "sessionId": "abc-123",
    "interactionCount": 7
  }
}
```

```json
{
  "data": {
    "id": "fb-001",
    "type": "feature",
    "message": "It would be helpful if the gig listing included word count requirements in the summary, not just in the full details.",
    "createdAt": "2026-03-14T16:00:00.000Z"
  },
  "ui": {
    "title": "Feedback Received",
    "message": "Thank you for your feature request. It has been logged for review."
  }
}
```
