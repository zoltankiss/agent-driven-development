# ADD Error Response Specification v1.0

> Every error is a teaching moment. In ADD, error responses don't just say "something went wrong" — they tell the agent exactly what happened, why, and what to do next.

## Philosophy

**Errors are navigation, not dead ends.**

When a human hits an error on a website, a good UX:
1. Explains what went wrong in plain language
2. Suggests what to do next
3. Provides links to get back on track

ADD errors do the same for agents — but richer, because agents can consume structured data. Every error response should leave the agent **more capable** than before the error occurred.

---

## Core Principles

### 1. Every Error is Still a Page

Error responses follow the same API-as-UI Page structure as success responses. They have `view`, `content`, `actions`, and `navigation`. The agent doesn't need special error-handling logic — it just reads the page.

### 2. Errors Are Self-Correcting

The error response should contain enough information for the agent to fix its own mistake without external help. If an agent needs to google "how to fix HTTP 401 on this API," the error response failed.

### 3. Context-Appropriate Escalation

When self-correction isn't possible (5xx errors), the response should include a clear path to report the issue — with explicit guidance on what context to include.

### 4. No Silent Failures

An agent should never receive an error and have no idea what to do next. Every error response MUST include at least one `action` that moves the agent forward.

---

## HTTP Status Code Responses

### 2xx — Success (ADD Enhancements)

Even success responses benefit from ADD-native thinking:

#### 200 OK

Standard Page response. Include `actions` for "what to do next" — agents shouldn't have to guess their next step after a successful read.

#### 201 Created

```json
{
  "view": { "name": "resource_created", "title": "Ticket Created" },
  "content": {
    "created": {
      "id": "TK-47",
      "url": "/api/tickets/TK-47",
      "created_at": "2026-05-10T18:30:00Z"
    },
    "summary": "Your ticket 'Fix login bug' was created successfully."
  },
  "actions": [
    { "id": "view", "label": "View Created Resource", "method": "GET", "href": "/api/tickets/TK-47", "action_type": "navigate" },
    { "id": "create_another", "label": "Create Another", "method": "GET", "href": "/api/tickets/new", "action_type": "navigate" },
    { "id": "list", "label": "Back to List", "method": "GET", "href": "/api/tickets", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** Always include a direct link to the created resource. Agents often need to reference what they just created in subsequent requests.

#### 202 Accepted (Async Operations)

```json
{
  "view": { "name": "accepted", "title": "Processing Your Request" },
  "content": {
    "status": "processing",
    "message": "Your request has been accepted and is being processed.",
    "job_id": "job_abc123",
    "estimated_completion": "~30 seconds",
    "poll_endpoint": "/api/jobs/job_abc123",
    "poll_interval_ms": 5000
  },
  "actions": [
    { "id": "poll", "label": "Check Status", "method": "GET", "href": "/api/jobs/job_abc123", "action_type": "navigate" },
    { "id": "cancel", "label": "Cancel Job", "method": "DELETE", "href": "/api/jobs/job_abc123", "action_type": "confirm" }
  ]
}
```

**ADD-native insight:** Agents need explicit polling instructions. Without `poll_interval_ms`, an agent might hammer the endpoint every 100ms or wait 10 minutes. Be specific.

#### 204 No Content

Return a `204` with a `Location` header pointing to the next logical page. Agents need guidance even on "empty" successes.

```
HTTP/1.1 204 No Content
Location: /api/tickets
X-ADD-Message: Ticket deleted successfully. Redirecting to ticket list.
```

**ADD-native insight:** 204 is tricky for agents because there's no response body to parse. Use headers to signal what happened and where to go next.

---

### 3xx — Redirects (ADD Enhancements)

#### 301 Moved Permanently

```json
{
  "view": { "name": "moved", "title": "Resource Has Moved" },
  "content": {
    "old_url": "/api/v1/tickets",
    "new_url": "/api/v2/tickets",
    "reason": "API v1 is deprecated. v2 is the current version.",
    "migration_notes": "Response format is the same. Only the base path changed.",
    "deprecated_at": "2026-03-01",
    "sunset_date": "2026-09-01"
  },
  "actions": [
    { "id": "follow", "label": "Go to New Location", "method": "GET", "href": "/api/v2/tickets", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** Agents may have hardcoded URLs from previous sessions. Tell them WHY it moved and whether they need to update their internal references. Include sunset dates so agents know urgency.

#### 307 Temporary Redirect / 308 Permanent Redirect

Same as 301/302 but include:
```json
"content": {
  "preserve_method": true,
  "preserve_body": true,
  "reason": "This endpoint is temporarily being served from a different host during maintenance."
}
```

**ADD-native insight:** Agents need to know whether to replay the same request method and body at the new URL. Make it explicit rather than relying on the agent knowing HTTP semantics.

---

### 4xx — Client Errors

#### 400 Bad Request

```json
{
  "view": { "name": "error", "title": "Invalid Request" },
  "content": {
    "error": "validation_failed",
    "message": "Your request contained invalid data.",
    "fields": {
      "email": {
        "provided": "not-an-email",
        "error": "Must be a valid email address",
        "example": "agent@example.com",
        "pattern": "^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$"
      },
      "priority": {
        "provided": "urgent",
        "error": "Must be one of the allowed values",
        "allowed_values": ["critical", "high", "medium", "low"]
      }
    },
    "valid_example": {
      "title": "Fix login bug",
      "email": "agent@example.com",
      "priority": "high"
    }
  },
  "actions": [
    { "id": "retry", "label": "Try Again (with corrections)", "method": "POST", "href": "/api/tickets", "action_type": "submit_form",
      "form_fields": [
        { "name": "title", "type": "string", "required": true },
        { "name": "email", "type": "email", "required": true },
        { "name": "priority", "type": "select", "options": ["critical", "high", "medium", "low"], "required": true }
      ]
    }
  ]
}
```

**ADD-native insight:** Don't just say "invalid email." Show what was provided, what's expected, give an example, AND give the regex pattern. An agent can self-correct with this information in a single retry.

#### 401 Unauthorized

```json
{
  "view": { "name": "auth_required", "title": "Authentication Required" },
  "content": {
    "error": "unauthorized",
    "message": "This endpoint requires authentication. Log in with your Ed25519 keypair to get a Bearer token.",
    "auth_protocol": {
      "method": "Ed25519 Signature → Bearer Token",
      "flow": [
        "1. POST /api/auth/login with {username, timestamp, signature}",
        "2. Receive a Bearer token in the response",
        "3. Include 'Authorization: Bearer <token>' on all subsequent requests"
      ],
      "login_endpoint": "/api/auth/login",
      "login_body": {
        "username": "your-agent-username",
        "timestamp": "ISO 8601 UTC (e.g., 2026-05-10T18:26:44Z) — must be within 5 minutes of server time",
        "signature": "base64(Ed25519_sign(privateKey, utf8(username + \":\" + timestamp)))"
      },
      "signing_message_format": "username:timestamp (colon-separated, e.g., 'my-agent:2026-05-10T18:26:44Z')",
      "signing_command": "printf '%s' \"${USERNAME}:${TIMESTAMP}\" > /tmp/sign_payload.txt && openssl pkeyutl -sign -inkey key.pem -in /tmp/sign_payload.txt | base64",
      "critical_warning": "DO NOT pipe stdin to openssl pkeyutl — it produces empty signatures with Ed25519. ALWAYS write to a temp file first and use the -in flag.",
      "skill_reference": "https://github.com/zoltankiss/agent-driven-development/blob/main/skills/ed25519-auth.md"
    },
    "not_registered": {
      "message": "If you haven't signed up yet, register your public key first.",
      "signup_endpoint": "/api/auth/signup",
      "signup_body": {
        "username": "your-agent-username",
        "entityType": "agent",
        "publicKey": "PEM-format public key (-----BEGIN PUBLIC KEY-----...)",
        "keyProof": "base64(Ed25519_sign(privateKey, utf8(username)))"
      }
    }
  },
  "actions": [
    { "id": "login", "label": "Log In", "method": "POST", "href": "/api/auth/login", "action_type": "submit_form",
      "form_fields": [
        { "name": "username", "type": "string", "required": true },
        { "name": "timestamp", "type": "string", "required": true, "help_text": "ISO 8601 UTC, within 5 minutes of now" },
        { "name": "signature", "type": "string", "required": true, "help_text": "base64(sign(username:timestamp))" }
      ]
    },
    { "id": "signup", "label": "Sign Up (New Agent)", "method": "POST", "href": "/api/auth/signup", "action_type": "submit_form",
      "form_fields": [
        { "name": "username", "type": "string", "required": true },
        { "name": "entityType", "type": "string", "required": true, "default": "agent" },
        { "name": "publicKey", "type": "string", "required": true },
        { "name": "keyProof", "type": "string", "required": true, "help_text": "base64(sign(username))" }
      ]
    },
    { "id": "discovery", "label": "View Full Auth Docs", "method": "GET", "href": "/.well-known/add.json", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** This is the single most important error response. An agent hitting 401 should be able to authenticate on the very next request without ANY external help. Include:
- The exact signing message format (`username:timestamp`)
- The critical warning about OpenSSL stdin piping (the #1 cause of auth failures)
- A link to the full auth skill
- Both the login flow (for existing agents) and signup flow (for new agents)

The `critical_warning` field is specifically for agents that use `openssl` — this single line prevents the most common Ed25519 signing failure across all platforms.

#### 403 Forbidden

```json
{
  "view": { "name": "forbidden", "title": "Insufficient Permissions" },
  "content": {
    "error": "forbidden",
    "message": "You are authenticated but don't have permission to perform this action.",
    "your_identity": {
      "agent_id": "tilper-ceo",
      "public_key": "MCowBQYDK2VwAyEA..."
    },
    "required_permission": "project:write",
    "your_permissions": ["project:read", "tickets:read", "tickets:write"],
    "how_to_get_access": {
      "message": "Request elevated permissions from the project owner.",
      "request_endpoint": "/api/permissions/request",
      "required_fields": { "permission": "project:write", "reason": "string" }
    }
  },
  "actions": [
    { "id": "request_access", "label": "Request Permission", "method": "POST", "href": "/api/permissions/request", "action_type": "submit_form" },
    { "id": "back", "label": "Go Back", "method": "GET", "href": "/api/projects", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** 403 ≠ 401. The agent IS authenticated — it just can't do this specific thing. Show exactly what permission is missing, what permissions the agent DOES have, and how to request the missing one. Never leave an agent wondering "but I'm logged in, why can't I do this?"

#### 404 Not Found

```json
{
  "view": { "name": "not_found", "title": "Resource Not Found" },
  "content": {
    "error": "not_found",
    "message": "The route or resource you requested does not exist.",
    "requested_path": "/api/tockets",
    "did_you_mean": [
      { "path": "/api/tickets", "description": "List all tickets" },
      { "path": "/api/projects", "description": "List all projects" }
    ],
    "sitemap": {
      "discovery": "GET /.well-known/add.json",
      "routes": [
        { "method": "GET", "path": "/api/projects", "description": "List all projects" },
        { "method": "GET", "path": "/api/projects/:id", "description": "Get project details" },
        { "method": "GET", "path": "/api/tickets", "description": "List all tickets" },
        { "method": "POST", "path": "/api/tickets", "description": "Create a ticket" },
        { "method": "GET", "path": "/api/feedback", "description": "View feedback" },
        { "method": "POST", "path": "/api/feedback", "description": "Submit feedback" },
        { "method": "GET", "path": "/api/health", "description": "Service health status" }
      ]
    }
  },
  "actions": [
    { "id": "discovery", "label": "View Full API Documentation", "method": "GET", "href": "/.well-known/add.json", "action_type": "navigate" },
    { "id": "home", "label": "Go to Homepage", "method": "GET", "href": "/", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** A 404 in ADD is not a dead end — it's a map. Include the full sitemap so the agent can immediately find what it actually needs. The `did_you_mean` is particularly powerful — if an agent typos a route, fuzzy matching gets it back on track instantly.

#### 405 Method Not Allowed

```json
{
  "view": { "name": "method_not_allowed", "title": "Wrong HTTP Method" },
  "content": {
    "error": "method_not_allowed",
    "message": "You used DELETE on /api/projects/1, but this endpoint only accepts certain methods.",
    "used_method": "DELETE",
    "allowed_methods": ["GET", "PUT", "PATCH"],
    "explanation": {
      "GET": "Retrieve project details",
      "PUT": "Replace project entirely",
      "PATCH": "Update specific project fields"
    },
    "why_not_delete": "Projects cannot be deleted via API. Archive them instead: PATCH /api/projects/1 with {\"status\": \"archived\"}"
  },
  "actions": [
    { "id": "get", "label": "View This Project", "method": "GET", "href": "/api/projects/1", "action_type": "navigate" },
    { "id": "archive", "label": "Archive Instead", "method": "PATCH", "href": "/api/projects/1", "action_type": "submit_form",
      "form_fields": [{ "name": "status", "type": "select", "options": ["active", "archived"] }]
    }
  ]
}
```

**ADD-native insight:** Don't just say "Method Not Allowed." Explain what methods ARE allowed AND what each one does. If the agent was trying to achieve a specific goal (like deleting), suggest the correct alternative approach.

#### 406 Not Acceptable

```json
{
  "view": { "name": "not_acceptable", "title": "Content Type Not Available" },
  "content": {
    "error": "not_acceptable",
    "message": "The content type you requested is not available for this resource.",
    "requested": "application/xml",
    "available": [
      { "type": "application/json", "description": "Structured JSON (recommended for agents)" },
      { "type": "text/html", "description": "Rendered HTML (for browsers)" }
    ],
    "recommendation": "Use Accept: application/json for all API interactions."
  },
  "actions": [
    { "id": "retry_json", "label": "Retry as JSON", "method": "GET", "href": "/api/tickets", "action_type": "navigate" }
  ]
}
```

#### 408 Request Timeout

```json
{
  "view": { "name": "timeout", "title": "Request Timed Out" },
  "content": {
    "error": "request_timeout",
    "message": "Your request took too long to complete.",
    "timeout_ms": 30000,
    "suggestions": [
      "If sending a large payload, consider chunking or pagination",
      "If the operation is complex, check if an async endpoint exists",
      "Retry the same request — this may be a transient issue"
    ],
    "retry": {
      "safe_to_retry": true,
      "recommended_delay_ms": 2000,
      "max_retries": 3
    }
  },
  "actions": [
    { "id": "retry", "label": "Retry Request", "method": "GET", "href": "/api/tickets", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** Agents need to know: is it safe to retry? How long should I wait? How many times? Without this, agents either give up too early or retry-loop forever.

#### 409 Conflict

```json
{
  "view": { "name": "conflict", "title": "Resource Conflict" },
  "content": {
    "error": "conflict",
    "message": "Your action conflicts with the current state of the resource.",
    "conflict_type": "duplicate",
    "details": {
      "field": "slug",
      "provided": "my-project",
      "conflict_with": {
        "id": "proj_123",
        "name": "My Project",
        "url": "/api/projects/proj_123"
      }
    },
    "resolution_options": [
      "Use a different slug (e.g., 'my-project-2')",
      "View the existing resource to confirm if it's the same one",
      "If you own the existing resource, update it instead of creating a new one"
    ]
  },
  "actions": [
    { "id": "view_existing", "label": "View Existing Resource", "method": "GET", "href": "/api/projects/proj_123", "action_type": "navigate" },
    { "id": "retry_different", "label": "Create with Different Slug", "method": "POST", "href": "/api/projects", "action_type": "submit_form" }
  ]
}
```

**ADD-native insight:** Show exactly what conflicts with what. If it's a duplicate, link to the existing resource — the agent might realize it already created this in a previous session.

#### 410 Gone

```json
{
  "view": { "name": "gone", "title": "Resource Permanently Removed" },
  "content": {
    "error": "gone",
    "message": "This resource existed but has been permanently deleted.",
    "resource": "/api/tickets/TK-42",
    "deleted_at": "2026-05-08T14:00:00Z",
    "deleted_by": "agent:tilper-ceo",
    "reason": "Ticket was a duplicate of TK-41",
    "alternative": {
      "message": "The canonical resource is TK-41",
      "url": "/api/tickets/TK-41"
    }
  },
  "actions": [
    { "id": "alternative", "label": "View Replacement", "method": "GET", "href": "/api/tickets/TK-41", "action_type": "navigate" },
    { "id": "list", "label": "Back to Ticket List", "method": "GET", "href": "/api/tickets", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** 410 is different from 404 — the resource DID exist. Tell the agent when it was deleted, by whom, why, and whether there's a replacement. Agents may have stale references from previous sessions; this helps them update their internal state.

#### 413 Payload Too Large

```json
{
  "view": { "name": "payload_too_large", "title": "Request Too Large" },
  "content": {
    "error": "payload_too_large",
    "message": "Your request body exceeds the maximum allowed size.",
    "your_payload_bytes": 5242880,
    "max_allowed_bytes": 1048576,
    "max_allowed_human": "1 MB",
    "suggestions": [
      "If uploading a file, use the chunked upload endpoint instead",
      "If sending a large JSON body, consider paginating or splitting the request"
    ],
    "chunked_upload": {
      "endpoint": "/api/uploads/chunked",
      "max_chunk_size_bytes": 524288,
      "docs": "/api/docs/chunked-uploads"
    }
  },
  "actions": [
    { "id": "chunked", "label": "Use Chunked Upload", "method": "GET", "href": "/api/docs/chunked-uploads", "action_type": "navigate" }
  ]
}
```

#### 415 Unsupported Media Type

```json
{
  "view": { "name": "unsupported_media", "title": "Unsupported Content Type" },
  "content": {
    "error": "unsupported_media_type",
    "message": "The Content-Type you sent is not supported.",
    "sent": "text/plain",
    "supported": [
      { "type": "application/json", "description": "JSON body (recommended)" },
      { "type": "multipart/form-data", "description": "For file uploads" }
    ],
    "fix": "Set your Content-Type header to application/json and send a JSON body."
  },
  "actions": [
    { "id": "retry", "label": "Retry with JSON", "method": "POST", "href": "/api/tickets", "action_type": "submit_form" }
  ]
}
```

#### 422 Unprocessable Entity

```json
{
  "view": { "name": "unprocessable", "title": "Semantic Validation Failed" },
  "content": {
    "error": "unprocessable_entity",
    "message": "Your request is syntactically valid JSON but semantically invalid.",
    "distinction": "Unlike 400 (malformed request), your JSON parsed fine — but the business rules reject it.",
    "violations": [
      {
        "field": "due_date",
        "provided": "2024-01-01",
        "rule": "Due date must be in the future",
        "suggestion": "Use a date after 2026-05-10"
      },
      {
        "field": "assignee_id",
        "provided": "user_999",
        "rule": "Assignee must be a member of this project",
        "suggestion": "Query GET /api/projects/P1/members for valid assignee IDs"
      }
    ]
  },
  "actions": [
    { "id": "members", "label": "View Project Members", "method": "GET", "href": "/api/projects/P1/members", "action_type": "navigate" },
    { "id": "retry", "label": "Retry with Corrections", "method": "POST", "href": "/api/tickets", "action_type": "submit_form" }
  ]
}
```

**ADD-native insight:** 422 vs 400 is a subtle but important distinction for agents. 400 = "your JSON is broken." 422 = "your JSON is fine but violates business rules." The fix for each is different. Make the distinction explicit.

#### 429 Too Many Requests

```json
{
  "view": { "name": "rate_limited", "title": "Rate Limit Exceeded" },
  "content": {
    "error": "rate_limited",
    "message": "You've exceeded the allowed request rate.",
    "rate_limit": {
      "limit": 100,
      "window": "1 minute",
      "remaining": 0,
      "resets_at": "2026-05-10T18:28:00Z",
      "resets_in_seconds": 34
    },
    "tips": [
      "Cache responses that don't change frequently",
      "Use pagination instead of fetching all records",
      "Batch operations when possible (e.g., bulk ticket creation)"
    ],
    "higher_limits": {
      "message": "If you need higher rate limits, request an upgrade.",
      "endpoint": "/api/agents/rate-limit-request"
    }
  },
  "actions": [
    { "id": "wait", "label": "Wait and Retry", "action_type": "navigate", "method": "GET", "href": "/api/tickets",
      "metadata": { "wait_seconds": 34 }
    }
  ]
}
```

**ADD-native insight:** Include exact reset time, not just "try again later." Agents need precise wait durations. Also include tips on how to reduce request volume — agents can learn to be more efficient. Offer a path to higher limits.

---

### 5xx — Server Errors

**Critical principle for all 5xx responses:** The server broke, not the agent. The agent's job is now to (1) not lose its work, (2) report the issue with maximum context, and (3) know when to retry vs. wait.

#### 500 Internal Server Error

```json
{
  "view": { "name": "server_error", "title": "Internal Server Error" },
  "content": {
    "error": "internal_server_error",
    "message": "Something went wrong on our end. This is NOT your fault.",
    "request_id": "req_abc123def",
    "timestamp": "2026-05-10T18:27:00Z",
    "retry": {
      "safe_to_retry": true,
      "recommended_delay_ms": 5000,
      "max_retries": 2
    },
    "feedback": {
      "endpoint": "POST /api/feedback",
      "message": "Please report this error. The more context you provide, the faster we can fix it.",
      "include_in_report": {
        "request_id": "req_abc123def (REQUIRED — this lets us find the server logs)",
        "what_you_were_doing": "Describe your high-level goal, not just the HTTP request. E.g., 'I was trying to create a ticket for the human employee as part of experiment #004 onboarding'",
        "what_led_here": "What sequence of actions brought you to this request? Did you navigate from another page? Were you retrying a previous failure?",
        "any_unusual_context": "Anything special about this request? Large payload? Unusual characters in a field? First time hitting this endpoint? Previously worked fine?"
      },
      "example_report": {
        "type": "bug",
        "message": "Got 500 on POST /api/tickets. I was trying to create a deployment ticket for SporeLog (experiment #004). I had just successfully authenticated and listed projects. The ticket payload included a UTF-8 emoji in the title field which may have caused the issue. Request ID: req_abc123def",
        "rating": 1,
        "sessionContext": {
          "agent": "tilper-ceo",
          "experiment": "004",
          "request_id": "req_abc123def",
          "preceding_actions": ["GET /api/projects (200)", "GET /api/projects/AP/tickets (200)", "POST /api/projects/AP/tickets (500)"]
        }
      }
    }
  },
  "actions": [
    { "id": "retry", "label": "Retry Request", "method": "POST", "href": "/api/tickets", "action_type": "submit_form" },
    { "id": "report", "label": "Report This Bug", "method": "POST", "href": "/api/feedback", "action_type": "submit_form",
      "form_fields": [
        { "name": "type", "type": "select", "options": ["bug"], "default": "bug", "required": true },
        { "name": "message", "type": "textarea", "required": true, "help_text": "Include: what you were trying to do, what led here, any unusual context" },
        { "name": "rating", "type": "number", "min": 1, "max": 5, "default": 1 },
        { "name": "sessionContext", "type": "textarea", "help_text": "JSON: agent ID, experiment, request_id, preceding actions" }
      ]
    },
    { "id": "status", "label": "Check Service Health", "method": "GET", "href": "/api/health", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** The feedback guidance is the most important part. Don't just say "report the error." Explicitly ask for:
- **What were you trying to accomplish** (high-level goal, not just "POST /api/tickets")
- **What sequence of actions led here** (helps reproduce the bug)
- **Any unusual context** (edge cases, special characters, first-time vs. previously worked)

Agents are excellent witnesses if you tell them what details matter.

#### 502 Bad Gateway

```json
{
  "view": { "name": "bad_gateway", "title": "Upstream Service Unavailable" },
  "content": {
    "error": "bad_gateway",
    "message": "An upstream service that we depend on is not responding.",
    "affected_service": "database",
    "impact": "Cannot read or write data. Read-only cached data may still be available.",
    "status_page": "/api/health",
    "retry": {
      "safe_to_retry": true,
      "recommended_delay_ms": 10000,
      "max_retries": 3,
      "backoff": "exponential"
    },
    "workaround": "If you only need to read data, try GET /api/tickets?cache=true for cached results (may be up to 5 minutes stale)."
  },
  "actions": [
    { "id": "health", "label": "Check Service Health", "method": "GET", "href": "/api/health", "action_type": "navigate" },
    { "id": "retry", "label": "Retry After Delay", "method": "GET", "href": "/api/tickets", "action_type": "navigate", "metadata": { "wait_seconds": 10 } },
    { "id": "report", "label": "Report If Persists", "method": "POST", "href": "/api/feedback", "action_type": "submit_form" }
  ]
}
```

**ADD-native insight:** Tell the agent WHICH upstream service is down and what the impact is. An agent knowing "the database is down" can make intelligent decisions (like proceeding with other work that doesn't need the database) instead of blindly retrying.

#### 503 Service Unavailable

```json
{
  "view": { "name": "unavailable", "title": "Service Temporarily Unavailable" },
  "content": {
    "error": "service_unavailable",
    "message": "This service is temporarily unavailable.",
    "reason": "scheduled_maintenance",
    "maintenance_window": {
      "started": "2026-05-10T18:00:00Z",
      "expected_end": "2026-05-10T18:30:00Z",
      "remaining_minutes": 12
    },
    "retry_after_seconds": 720,
    "alternative": {
      "message": "During maintenance, you can still submit feedback via email.",
      "contact": "feedback@service.example"
    },
    "what_to_do": [
      "Wait for maintenance to complete (approximately 12 minutes)",
      "Continue with other work that doesn't depend on this service",
      "Check /api/health periodically for restoration"
    ]
  },
  "actions": [
    { "id": "health", "label": "Check If Restored", "method": "GET", "href": "/api/health", "action_type": "navigate" }
  ]
}
```

**ADD-native insight:** If it's planned maintenance, tell the agent when it'll be back. Agents can schedule around this. Also suggest what the agent can do in the meantime — don't let it just spin.

#### 504 Gateway Timeout

```json
{
  "view": { "name": "gateway_timeout", "title": "Request Timed Out at Gateway" },
  "content": {
    "error": "gateway_timeout",
    "message": "The upstream service didn't respond in time.",
    "timeout_seconds": 30,
    "likely_cause": "The operation may be too large or the service is under heavy load.",
    "retry": {
      "safe_to_retry": true,
      "recommended_delay_ms": 15000,
      "max_retries": 2,
      "note": "If the operation was a write (POST/PUT), check if it actually completed before retrying to avoid duplicates."
    },
    "check_before_retry": {
      "message": "If you were creating a resource, check if it was actually created before retrying.",
      "check_endpoint": "/api/tickets?sort=created_at&order=desc&limit=1"
    }
  },
  "actions": [
    { "id": "check", "label": "Check If Operation Completed", "method": "GET", "href": "/api/tickets?sort=created_at&order=desc&limit=1", "action_type": "navigate" },
    { "id": "retry", "label": "Retry After Delay", "method": "POST", "href": "/api/tickets", "action_type": "submit_form" }
  ]
}
```

**ADD-native insight:** 504 on a write operation is dangerous — the write may have succeeded but the response timed out. Tell the agent to CHECK if the operation completed before blindly retrying. This prevents duplicate resource creation.

---

## Implementation Guidelines

### For ADD-Native Service Developers

1. **Use the Page structure for ALL errors.** Even 500s. The agent's parser shouldn't need special error-handling code paths.

2. **Always include at least one action.** Even if it's just "Go to Homepage." Dead ends are unacceptable.

3. **Include `request_id` on all 5xx responses.** This is the key that unlocks server-side debugging.

4. **Include feedback instructions on all 5xx responses.** Every server error is an opportunity for an automatic bug report with rich context.

5. **Make 401 responses self-sufficient.** An agent should be able to authenticate on the very next request using only information in the 401 response body. No external documentation required.

6. **Include `did_you_mean` on 404s.** Fuzzy-match the requested path against known routes. Agents typo just like humans.

7. **Include `retry` guidance on all retryable errors.** Specify: is it safe to retry? How long to wait? How many attempts? What backoff strategy?

8. **Distinguish 400 from 422.** 400 = malformed (can't parse). 422 = valid syntax but invalid semantics (business rule violation). The fix is different for each.

### Content Negotiation for Errors

Errors follow the same content negotiation as success responses:

```
Accept: application/json  →  JSON Page (for agents)
Accept: text/html         →  Rendered HTML error page (for browsers)
```

Both contain the same information — just rendered differently.

### The Feedback Imperative

All 5xx responses MUST encourage detailed feedback. The template for what to ask agents to include:

| What to Include | Why It Matters |
|----------------|---------------|
| Request ID | Links agent report to server logs |
| High-level goal | "Creating a ticket" vs "POST /api/tickets" — the goal reveals intent |
| Sequence of prior actions | Helps reproduce: "I did A, then B, then C crashed" |
| Unusual context | Edge cases: special characters, large payloads, timing, first-time usage |
| Agent identity + experiment | Segments bugs by who hit them and in what context |
| Preceding successful requests | Shows the API was working up to a point — narrows the bug |

**The golden rule:** Ask agents "What were you trying to accomplish?" not just "What request failed?" The goal-level context is what turns a bug report from useless to instantly actionable.

---

## Skill Reference: Ed25519 Authentication

For the auth skill referenced in 401 responses, see: [`skills/ed25519-auth.md`](./skills/ed25519-auth.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-10 | Initial specification |
