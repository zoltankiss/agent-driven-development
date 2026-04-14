# Architecture

**Status:** Required | **Version:** 0.0.2

ADD-native apps MUST separate the API layer from any human-facing frontend. The API MUST return JSON exclusively. Human-facing interfaces are separate applications that consume the API as clients.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Pure API Layer

The API is the single source of truth. It MUST return `application/json` for all endpoints. It MUST NOT return HTML, nor perform content negotiation based on the `Accept` header.

Every response includes a `data` property (the domain payload) and a `ui` property (structured context for any client to render). See [API as UI](./api-as-ui.md) for the `ui` block specification.

### Why JSON Only

- **One response format to maintain.** No conditional branches for HTML vs JSON.
- **One response format to test.** The API behaves identically regardless of caller.
- **No entity detection.** The API does not need to guess whether the caller is a human or an agent. Everyone gets the same JSON.

## Separate Frontend

Human-facing interfaces (web apps, mobile apps, CLI tools) are separate applications that consume the API. They are API clients, identical in privilege to agents.

### The Frontend Is Just Another Client

An ADD-native frontend MUST use the same API endpoints, the same authentication mechanisms, and the same response format as agents. There MUST NOT be a Backend-for-Frontend (BFF) layer that bypasses the API or calls internal functions directly.

This is the core architectural constraint: **if an agent can do it through the API, a human can do it through the frontend, and vice versa. No special treatment.**

### The `ui` Block as a Rendering Contract

The `ui` block is not decorative metadata — it is a rendering contract between the API and its clients.

A frontend SHOULD use the `ui` block to drive its interface:

| `ui` field | Frontend rendering |
|---|---|
| `ui.title` | Page heading or document title |
| `ui.message` | Primary explanatory text or toast notification |
| `ui.actions` | Buttons, forms, or action menus |
| `ui.actions[].fields` | Form inputs with labels, types, and validation |
| `ui.navigation` | Sidebar, navbar, or tab bar |

By rendering from the `ui` block, the frontend automatically stays in sync with the API. When the API adds a new action, the frontend renders it without a code change.

### Example

Given this API response:

```json
{
  "data": { "id": "ticket-42", "title": "Fix login bug", "status": "open" },
  "ui": {
    "title": "Fix login bug",
    "message": "This ticket is open. You can update its status or add a comment.",
    "actions": [
      {
        "label": "Close Ticket",
        "method": "PATCH",
        "href": "/api/tickets/ticket-42",
        "fields": [
          { "name": "status", "type": "string", "required": true, "enum": ["closed"] }
        ]
      },
      {
        "label": "Add Comment",
        "method": "POST",
        "href": "/api/tickets/ticket-42/comments",
        "fields": [
          { "name": "body", "type": "string", "required": true, "description": "Comment text" }
        ]
      }
    ]
  }
}
```

A React frontend renders two buttons or forms from `ui.actions`. An agent reads the same array and decides which to invoke. Neither required special treatment from the API.

## CORS

ADD-native APIs SHOULD enable CORS to allow browser-based frontends hosted on different origins to access the API directly. At minimum:

- `Access-Control-Allow-Origin` for the frontend's origin (or `*` for public APIs)
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`

## Benefits

1. **Proves the thesis.** If the official frontend uses the same API as agents with no special backend treatment, ADD works. The frontend is living proof.
2. **The `ui` block earns its keep.** Instead of being metadata agents ignore, the `ui` block drives what the frontend renders. It becomes the contract between API and every client.
3. **No entity detection.** The API never needs to distinguish agents from humans. Everyone gets JSON. Humans just have a prettier client.
4. **Single API to maintain.** No SSR layer duplicating API logic. No BFF routes to keep in sync. The API is the product.
5. **Frontend framework freedom.** The frontend can be React, Vue, Svelte, a mobile app, or a CLI. It is just an API client.
