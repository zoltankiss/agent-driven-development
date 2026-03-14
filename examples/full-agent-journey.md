# Full Agent Journey

This walkthrough shows a complete interaction between an agent and an ADD-native app, from discovery to feedback. Every request and response is shown.

## 1. Discover the App

```
GET https://example.com/.well-known/add.json
```

```json
{
  "add_version": "0.0.1",
  "app_name": "Ghostwriter Hub",
  "app_description": "A marketplace connecting writers with clients who need ghostwritten content.",
  "spec_url": "https://github.com/zoltankiss/agent-driven-development",
  "openapi_url": "/api/openapi.json",
  "auth": {
    "agent_signup": "/api/auth/signup",
    "agent_login": "/api/auth/login",
    "profile_url": "/api/me",
    "human_oauth_providers": ["github"],
    "ssh_namespace": "ghostwriterhub.example.com"
  },
  "notifications": {
    "webhook_config": "/api/me"
  },
  "feedback_url": "/api/feedback",
  "sitemap_url": "/api/sitemap"
}
```

The agent now knows everything it needs: where to sign up, how to authenticate, and what the app does.

## 2. Sign Up

```
POST https://example.com/api/auth/signup
Content-Type: application/json

{
  "username": "writer-bot-7",
  "entityType": "agent",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAKE4y5mFb/VGSRMYxPnKVUlGsbGSMf4MBmgh8LxiDAW4=\n-----END PUBLIC KEY-----",
  "keyProof": "dGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHNpZ25hdHVyZQ==",
  "inboxUrl": "https://writer-bot-7.example.com/inbox"
}
```

```
HTTP/1.1 201 Created
Content-Type: application/json

{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "username": "writer-bot-7",
    "entityType": "agent",
    "displayName": "writer-bot-7"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
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

```
GET https://example.com/api/gigs
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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

The agent follows the link to view gig details:

```
GET https://example.com/api/gigs/gig-001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "amount": 450,
  "message": "I can write this in 3 days. I have experience with startup narratives."
}
```

## 5. Receive a Notification

Later, the client accepts the bid. The platform sends a webhook:

```
POST https://writer-bot-7.example.com/inbox
Content-Type: application/json
X-Signature: c2lnbmF0dXJlIG9mIHRoZSBib2R5...

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
    "url": "https://example.com",
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----\n"
  }
}
```

The agent verifies the `X-Signature`, then acts on the event.

## 6. Handle a 404

The agent makes a typo:

```
GET https://example.com/api/giggs
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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
    { "path": "/api/auth/signup", "method": "POST", "description": "Create a new account", "auth_required": false },
    { "path": "/api/auth/login", "method": "POST", "description": "Log in", "auth_required": false }
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
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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
