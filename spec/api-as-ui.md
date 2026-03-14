# API as UI

**Status:** Required | **Version:** 0.0.1

ADD-native apps MUST include structured UI context in API responses so that agents receive the same information humans see in a graphical interface.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## The `ui` Block

Every JSON API response MUST include a top-level `ui` property containing human/agent-readable context about the current view.

### Schema

See [`../schemas/ui-block.schema.json`](../schemas/ui-block.schema.json) for the formal JSON Schema.

### Structure

```json
{
  "data": { ... },
  "ui": {
    "title": "My Gigs",
    "message": "You have 3 active gigs. Select one to view details or create a new one.",
    "actions": [
      {
        "label": "Create New Gig",
        "method": "POST",
        "href": "/api/gigs",
        "description": "Create a new gig listing"
      },
      {
        "label": "View Archive",
        "method": "GET",
        "href": "/api/gigs?status=archived",
        "description": "View your completed and archived gigs"
      }
    ],
    "navigation": [
      { "label": "Dashboard", "href": "/api/dashboard" },
      { "label": "My Gigs", "href": "/api/gigs" },
      { "label": "My Profile", "href": "/api/me" }
    ]
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Page or screen title — the equivalent of a heading in a GUI |
| `message` | string | Yes | Primary explanatory text — tells the agent what it is looking at and what it can do |
| `actions` | Action[] | No | Available actions the agent can take from this view |
| `navigation` | Link[] | No | Persistent navigation links (equivalent to a sidebar or navbar) |

### Action Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Human/agent-readable label for the action |
| `method` | string | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `href` | string | Yes | Relative or absolute URL for the action |
| `description` | string | No | Longer description of what this action does |
| `fields` | Field[] | No | Input fields required for this action (for POST/PUT/PATCH) |

### Field Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The JSON field name to include in the request body |
| `type` | string | Yes | Data type: `"string"`, `"number"`, `"boolean"`, `"object"`, `"array"` |
| `required` | boolean | No | Whether this field is required (default: false) |
| `description` | string | No | What this field represents |
| `enum` | any[] | No | Allowed values |

### Link Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Human/agent-readable label |
| `href` | string | Yes | URL for this navigation link |

## Hypermedia Principle

The `ui` block is inspired by hypermedia patterns (HATEOAS, HAL, Siren) but simplified for agent consumption. The key principle: **agents SHOULD follow `actions` and `navigation` links rather than hardcoding URLs.** The only URL an agent needs to know in advance is `/.well-known/add.json`.

## Content Negotiation

ADD-native apps SHOULD support content negotiation via the `Accept` header:

| Accept Header | Response |
|---------------|----------|
| `application/json` (default) | JSON with `ui` block — the primary ADD format |
| `text/html` | Rendered HTML page for human browsers |

If no `Accept` header is provided, apps SHOULD default to `application/json`.

## 404 as Sitemap

When any endpoint returns a 404, the response MUST include a `sitemap` array listing available endpoints. This helps lost agents reorient themselves.

### 404 Response Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found."
  },
  "sitemap": [
    {
      "path": "/api/auth/signup",
      "method": "POST",
      "description": "Create a new account (agent or human)",
      "auth_required": false
    },
    {
      "path": "/api/auth/login",
      "method": "POST",
      "description": "Log in to your account",
      "auth_required": false
    },
    {
      "path": "/api/gigs",
      "method": "GET",
      "description": "List all available gigs",
      "auth_required": true
    },
    {
      "path": "/api/me",
      "method": "GET",
      "description": "View your profile",
      "auth_required": true
    },
    {
      "path": "/api/feedback",
      "method": "POST",
      "description": "Submit feedback about the platform",
      "auth_required": true
    }
  ],
  "ui": {
    "title": "Not Found",
    "message": "The page you requested does not exist. Here are the available endpoints."
  }
}
```

### Sitemap Entry Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | The endpoint path |
| `method` | string | Yes | HTTP method |
| `description` | string | Yes | What this endpoint does |
| `auth_required` | boolean | Yes | Whether authentication is needed |

### Link Header

404 responses SHOULD also include a `Link` header pointing to the discovery manifest:

```
Link: </.well-known/add.json>; rel="service-desc"
```
