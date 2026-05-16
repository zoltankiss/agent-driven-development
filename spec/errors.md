# Errors

**Status:** Required | **Version:** 0.0.1

ADD-native apps MUST return errors in a standard format so agents can handle failures programmatically.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Error Response Format

All error responses MUST include an `error` object and SHOULD include a `ui` block:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "A human/agent-readable description of what went wrong."
  },
  "ui": {
    "title": "Error Title",
    "message": "What went wrong and what you can do about it."
  }
}
```

### Error Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Machine-readable error code (UPPER_SNAKE_CASE) |
| `message` | string | Yes | Human/agent-readable error description |
| `details` | object | No | Additional context (e.g., field-level validation errors, server timestamps) |

See [`../schemas/error-response.schema.json`](../schemas/error-response.schema.json).

## Standard Error Codes

These error codes are defined by the ADD spec. Apps MAY define additional app-specific codes.

### Authentication Errors (400/401)

ADD 1.0 uses RFC 9421 / Web Bot Auth signing on every request. See [spec/auth.md](./auth.md) for the full signing procedure.

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | No authentication present (no signature headers, no Bearer token) |
| `INVALID_SIGNATURE_HEADERS` | `Signature-Agent`, `Signature-Input`, or `Signature` is missing or malformed (400) |
| `INVALID_SIGNATURE` | The Ed25519 signature did not verify against the discovered key |
| `SIGNATURE_EXPIRED` | The `expires` parameter has passed, or `expires - created` exceeds 300 seconds |
| `DIRECTORY_FETCH_FAILED` | The agent's key directory at `<signature-agent>/.well-known/http-message-signatures-directory` could not be fetched |
| `KEY_NOT_IN_DIRECTORY` | The `keyid` is not present in the agent's directory and no inline `publicKey` was provided |
| `AUTH_UNREGISTERED_AGENT` | The `(signature-agent, keyid)` pair is not registered with this app |
| `TOKEN_EXPIRED` | An optional Bearer token has expired |

### Signup/Registration Errors (400/409)

| Code | Description |
|------|-------------|
| `INVALID_PUBLIC_KEY` | The provided key is not a valid Ed25519 public key |
| `USERNAME_TAKEN` | The requested username is already registered (409) |
| `INVALID_ENTITY_TYPE` | The entityType is not `"agent"` or `"human"` |

### Resource Errors (404/400)

| Code | Description |
|------|-------------|
| `NOT_FOUND` | The requested resource does not exist |
| `USER_NOT_FOUND` | No user found with the given identifier |

### Validation Errors (400)

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Generic validation failure |
| `MISSING_FIELD` | A required field is missing |
| `INVALID_FEEDBACK_TYPE` | Feedback type is not one of the allowed values |
| `MISSING_MESSAGE` | The message field is required |
| `INVALID_RATING` | Rating is outside the 1-5 range |

### Server Errors (500)

| Code | Description |
|------|-------------|
| `INTERNAL_ERROR` | An unexpected server error occurred |

## Validation Error Details

For validation errors, the `details` field SHOULD include per-field errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "fields": {
        "username": "Username must be between 3 and 30 characters",
        "publicKey": "Not a valid Ed25519 public key"
      }
    }
  },
  "ui": {
    "title": "Invalid Request",
    "message": "Please fix the following issues and try again."
  }
}
```

## Rate Limiting (429)

ADD-native apps SHOULD implement rate limiting and communicate it via standard headers:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710421800
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please wait before retrying.",
    "details": {
      "retryAfter": 30
    }
  },
  "ui": {
    "title": "Rate Limited",
    "message": "You are making requests too quickly. Please wait 30 seconds."
  }
}
```

Agents MUST respect `Retry-After` headers and MUST NOT retry immediately on 429 responses.
