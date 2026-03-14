# Feedback

**Status:** Recommended | **Version:** 0.0.1

ADD-native apps SHOULD provide a feedback endpoint where both humans and agents can submit structured feedback. This closes the loop between users and the platform, and is especially valuable for agents who may encounter edge cases during autonomous operation.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Submit Feedback

```
POST {manifest.feedback_url}
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | One of: `"bug"`, `"feature"`, `"general"` |
| `message` | string | Yes | The feedback content |
| `rating` | integer | No | Experience rating from 1 (poor) to 5 (excellent) |
| `sessionContext` | object | No | Arbitrary metadata — agents can attach request traces, model info, error context, etc. |

### Example Request

```json
{
  "type": "bug",
  "message": "The /api/gigs endpoint returns 500 when the date filter uses YYYY-MM-DD format instead of ISO 8601",
  "rating": 2,
  "sessionContext": {
    "endpoint": "/api/gigs",
    "method": "GET",
    "params": { "date": "2026-01-01" },
    "responseStatus": 500,
    "agentRuntime": "claude-code",
    "timestamp": "2026-03-14T10:30:00.000Z"
  }
}
```

### Success Response (201)

```json
{
  "data": {
    "id": "uuid",
    "type": "bug",
    "message": "The /api/gigs endpoint returns 500 when the date filter uses YYYY-MM-DD format instead of ISO 8601",
    "createdAt": "2026-03-14T10:31:00.000Z"
  },
  "ui": {
    "title": "Feedback Received",
    "message": "Thank you for your feedback. Your bug report has been logged."
  }
}
```

### Error Responses

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `INVALID_FEEDBACK_TYPE` | The `type` field is not one of the allowed values |
| 400 | `MISSING_MESSAGE` | The `message` field is required |
| 400 | `INVALID_RATING` | The `rating` must be an integer between 1 and 5 |
| 401 | `UNAUTHORIZED` | Authentication is required |

## View Feedback History

Apps SHOULD also provide a `GET` endpoint for users to view their own submission history:

```
GET {manifest.feedback_url}
Authorization: Bearer <token>
```

### Response (200)

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "bug",
      "message": "...",
      "rating": 2,
      "createdAt": "2026-03-14T10:31:00.000Z"
    }
  ],
  "ui": {
    "title": "Your Feedback",
    "message": "You have submitted 1 feedback item.",
    "actions": [
      {
        "label": "Submit New Feedback",
        "method": "POST",
        "href": "/api/feedback",
        "description": "Submit new feedback about the platform"
      }
    ]
  }
}
```

## Schema

See [`../schemas/feedback.schema.json`](../schemas/feedback.schema.json).
